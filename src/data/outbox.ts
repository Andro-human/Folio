import { useSyncExternalStore } from 'react';
import { createStore, del, entries, set } from 'idb-keyval';
import { format } from 'date-fns';
import { keys, queryClient, supabase } from './client';
import { appendToJot, ensureJot } from './pages';
import { createTask } from './tasks';
import { fetchLists } from './lists';
import { parseQuickTask } from '@/lib/quickSyntax';
import { jotTitle, toDateKey } from '@/lib/dates';

/**
 * Quick captures wait here until the server has them. Only unsent captures live on
 * the device; once delivered they are deleted (PLAN §6, offline capture).
 */
export interface OutboxItem {
  /** Becomes the task's page id, or the note line's captureId, so retries never duplicate. */
  id: string;
  kind: 'task' | 'note';
  text: string;
  /** Relative dates ("tomorrow") resolve against this, not the sync time. */
  capturedAt: string;
  jotDate: string;
  attempts: number;
  lastError?: string;
}

const store = createStore('notes-outbox', 'items');
let items: OutboxItem[] = [];
const listeners = new Set<() => void>();

function publish(next: OutboxItem[]) {
  items = next;
  listeners.forEach((l) => l());
}

const loaded = (async () => {
  try {
    const all = await entries<string, OutboxItem>(store);
    publish(all.map(([, v]) => v).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)));
  } catch {
    // IndexedDB unavailable (private mode): captures still queue in memory for this session.
  }
})();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOutbox(): OutboxItem[] {
  return useSyncExternalStore(subscribe, () => items);
}

export function isPending(id: string): boolean {
  return items.some((i) => i.id === id);
}

async function persist(item: OutboxItem) {
  try {
    await set(item.id, item, store);
  } catch {
    // memory copy still syncs this session
  }
}

async function remove(id: string) {
  publish(items.filter((i) => i.id !== id));
  try {
    await del(id, store);
  } catch {
    // nothing left to clean up in memory
  }
}

export async function enqueueCapture(kind: OutboxItem['kind'], text: string): Promise<OutboxItem> {
  await loaded;
  const now = new Date();
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    kind,
    text,
    capturedAt: now.toISOString(),
    jotDate: toDateKey(now),
    attempts: 0,
  };
  publish([...items, item]);
  await persist(item);
  return item;
}

async function deliver(item: OutboxItem, lists: { id: string; name: string }[]) {
  const title = jotTitle(item.jotDate);
  const at = new Date(item.capturedAt);

  if (item.kind === 'task') {
    const parsed = parseQuickTask(item.text, lists, at);
    const jot = await ensureJot(item.jotDate, title);
    await createTask({
      id: item.id,
      title: parsed.title,
      listId: parsed.listId,
      priority: parsed.priority,
      deadline: parsed.deadline ?? null,
      deadlineHasTime: parsed.deadlineHasTime,
      rrule: parsed.rrule ?? null,
      originPageId: jot.id,
    });
    await appendToJot(item.jotDate, title, {
      type: 'taskLine',
      attrs: { taskId: item.id },
      content: [{ type: 'text', text: parsed.title }],
    });
    return;
  }

  await appendToJot(item.jotDate, title, {
    type: 'paragraph',
    attrs: { indent: 0, captureId: item.id },
    content: [{ type: 'text', text: `${format(at, 'HH:mm')} — ${item.text}` }],
  });
}

const looksOffline = (e: unknown) =>
  !navigator.onLine || /failed to fetch|load failed|networkerror|network request failed/i.test(String(e));

export interface FlushResult {
  sent: number;
  left: number;
}

let running: Promise<FlushResult> | null = null;

/** Sends queued captures oldest-first. Concurrent calls share one run. */
export function flushOutbox(): Promise<FlushResult> {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run(): Promise<FlushResult> {
  await loaded;
  if (!items.length || !navigator.onLine) return { sent: 0, left: items.length };
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { sent: 0, left: items.length };

  let sent = 0;
  let lists: { id: string; name: string }[] = [];
  try {
    lists = await fetchLists();
  } catch (e) {
    if (looksOffline(e)) return { sent, left: items.length };
  }

  for (const item of [...items]) {
    try {
      await deliver(item, lists);
      await remove(item.id);
      sent++;
    } catch (e) {
      const updated = { ...item, attempts: item.attempts + 1, lastError: String(e) };
      publish(items.map((i) => (i.id === item.id ? updated : i)));
      await persist(updated);
      if (looksOffline(e)) break;
    }
  }

  if (sent) {
    queryClient.invalidateQueries({ queryKey: keys.tasks });
    queryClient.invalidateQueries({ queryKey: keys.pages });
  }
  return { sent, left: items.length };
}
