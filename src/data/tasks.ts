import { useMutation, useQuery } from '@tanstack/react-query';
import { endOfDay, startOfDay } from 'date-fns';
import { keys, queryClient, supabase, unwrap } from './client';
import type { FullPage, Priority, Task, TaskRow } from './types';
import { nextOccurrence } from '@/lib/recurrence';

const TASK_SELECT = '*, page:pages!inner(id, title, origin_page_id, deleted_at, updated_at)';

export function useOpenTasks() {
  return useQuery({
    queryKey: keys.openTasks,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('tasks')
          .select(TASK_SELECT)
          .in('status', ['todo', 'deferred'])
          .is('page.deleted_at', null)
          .order('deadline', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true }),
      ) as unknown as Task[],
  });
}

export function useDoneTasks(listId: string | null, enabled = true) {
  return useQuery({
    queryKey: keys.doneTasks(listId),
    enabled,
    queryFn: async () => {
      let q = supabase
        .from('tasks')
        .select(TASK_SELECT)
        .eq('status', 'done')
        .is('page.deleted_at', null)
        .order('completed_at', { ascending: false })
        .limit(50);
      if (listId) q = q.eq('list_id', listId);
      return unwrap(await q) as unknown as Task[];
    },
  });
}

/** Tasks referenced by chips in a doc — done and deleted ones included. */
export function useTasksByIds(ids: string[]) {
  return useQuery({
    queryKey: keys.tasksByIds(ids),
    enabled: ids.length > 0,
    queryFn: async () =>
      unwrap(await supabase.from('tasks').select(TASK_SELECT).in('page_id', ids)) as unknown as Task[],
    placeholderData: (prev) => prev,
  });
}

// ------------------------------------------------------------------ grouping

export interface TaskGroups {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  noDate: Task[];
  deferred: Task[];
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function byPriorityThenDeadline(a: Task, b: Task): number {
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (p !== 0) return p;
  return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
}

export function groupTasks(tasks: Task[], now = new Date()): TaskGroups {
  const groups: TaskGroups = { overdue: [], today: [], upcoming: [], noDate: [], deferred: [] };
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  for (const t of tasks) {
    if (t.status === 'deferred') {
      groups.deferred.push(t);
      continue;
    }
    if (t.status !== 'todo') continue;
    if (!t.deadline) {
      groups.noDate.push(t);
      continue;
    }
    const d = new Date(t.deadline);
    const late = t.deadline_has_time ? d < now : d < todayStart;
    if (late) groups.overdue.push(t);
    else if (d <= todayEnd) groups.today.push(t);
    else groups.upcoming.push(t);
  }
  groups.today.sort(byPriorityThenDeadline);
  groups.noDate.sort(byPriorityThenDeadline);
  return groups;
}

// ---------------------------------------------------------------- mutations

function patchCachedTask(pageId: string, patch: Partial<TaskRow> | ((t: Task) => Task)) {
  const apply = (t: Task) =>
    t.page_id !== pageId ? t : typeof patch === 'function' ? patch(t) : { ...t, ...patch };
  queryClient.setQueriesData<Task[]>({ queryKey: keys.tasks }, (old) => old?.map(apply));
  if (typeof patch !== 'function') {
    queryClient.setQueryData<FullPage | null>(keys.page(pageId), (old) =>
      old?.task ? { ...old, task: { ...old.task, ...patch } } : old,
    );
  }
}

function refreshTasks(pageId?: string) {
  queryClient.invalidateQueries({ queryKey: keys.tasks });
  if (pageId) queryClient.invalidateQueries({ queryKey: keys.page(pageId) });
}

export interface NewTask {
  id?: string;
  title: string;
  listId?: string | null;
  priority?: Priority;
  deadline?: string | null;
  deadlineHasTime?: boolean;
  rrule?: string | null;
  originPageId?: string | null;
  folderId?: string | null;
  parentPageId?: string | null;
}

export async function createTask(t: NewTask): Promise<string> {
  const id = t.id ?? crypto.randomUUID();
  unwrap(
    await supabase.rpc('create_task', {
      p_id: id,
      p_title: t.title,
      p_list_id: t.listId ?? undefined,
      p_priority: t.priority ?? 'medium',
      p_deadline: t.deadline ?? undefined,
      p_deadline_has_time: t.deadlineHasTime ?? false,
      p_rrule: t.rrule ?? undefined,
      p_origin_page_id: t.originPageId ?? undefined,
      p_folder_id: t.folderId ?? undefined,
      p_parent_page_id: t.parentPageId ?? undefined,
    }),
  );
  refreshTasks();
  return id;
}

export function useCreateTask() {
  return useMutation({ mutationFn: createTask });
}

export async function updateTask(pageId: string, patch: Partial<TaskRow>) {
  const full: Partial<TaskRow> = { ...patch };
  if ('deadline' in patch || 'deadline_has_time' in patch || 'rrule' in patch) {
    full.gcal_dirty = true;
  }
  // Callers send deadline and deadline_has_time together.
  if ('deadline' in patch) {
    full.remind_at = patch.deadline && patch.deadline_has_time ? patch.deadline : null;
    full.reminded_at = null;
  }
  if (patch.status === 'done') full.completed_at = new Date().toISOString();
  if (patch.status && patch.status !== 'done') full.completed_at = null;

  patchCachedTask(pageId, full);
  const res = await supabase.from('tasks').update(full).eq('page_id', pageId);
  if (res.error) {
    refreshTasks(pageId);
    throw new Error(res.error.message);
  }
  refreshTasks(pageId);
}

export function useUpdateTask() {
  return useMutation({
    mutationFn: ({ pageId, patch }: { pageId: string; patch: Partial<TaskRow> }) =>
      updateTask(pageId, patch),
  });
}

/** Returns the next deadline when the task repeats, so callers can say so. */
export async function completeTask(task: Pick<TaskRow, 'page_id' | 'rrule' | 'deadline' | 'deadline_has_time'>) {
  let next: Date | null = null;
  if (task.rrule) next = nextOccurrence(task.rrule, task.deadline);

  if (next) {
    const iso = next.toISOString();
    patchCachedTask(task.page_id, { deadline: iso });
    unwrap(
      await supabase.rpc('complete_task', {
        p_page_id: task.page_id,
        p_next_deadline: iso,
        p_next_remind_at: task.deadline_has_time ? iso : undefined,
      }),
    );
  } else {
    patchCachedTask(task.page_id, { status: 'done', completed_at: new Date().toISOString() });
    unwrap(await supabase.rpc('complete_task', { p_page_id: task.page_id }));
  }
  refreshTasks(task.page_id);
  return next;
}

export async function uncompleteTask(pageId: string) {
  await updateTask(pageId, { status: 'todo' });
}

export async function makeTask(pageId: string, listId: string | null) {
  unwrap(await supabase.from('tasks').insert({ page_id: pageId, list_id: listId }));
  refreshTasks(pageId);
}

export async function unmakeTask(pageId: string) {
  unwrap(await supabase.from('tasks').delete().eq('page_id', pageId));
  refreshTasks(pageId);
}
