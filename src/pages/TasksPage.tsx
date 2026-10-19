import { useMemo, useState } from 'react';
import { Link, NavLink, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { PageBody, PageHeader, ScreenTitle, SectionTitle } from '@/components/layout/PageHeader';
import { TaskRow } from '@/components/tasks/TaskRow';
import { QuickTaskInput } from '@/components/tasks/QuickTaskInput';
import { groupTasks, useDoneTasks, useOpenTasks, byPriorityThenDeadline } from '@/data/tasks';
import { useLists, listColorVar } from '@/data/lists';
import type { ListRow, Task } from '@/data/types';
import { relativeDayLabel, startOfDay, toDateKey } from '@/lib/dates';
import { cn } from '@/lib/utils';

type View = 'upcoming' | 'nodate' | 'deferred' | 'done';

const VIEWS: { key: View; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'nodate', label: 'No date' },
  { key: 'deferred', label: 'Deferred' },
  { key: 'done', label: 'Done' },
];

export default function TasksPage() {
  const { listId } = useParams();
  const [params, setParams] = useSearchParams();
  const view = (params.get('v') as View) ?? 'upcoming';
  const { data: lists = [] } = useLists();
  const list = lists.find((l) => l.id === listId);
  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  return (
    <>
      <PageHeader back={listId ? '/tasks' : undefined} />
      <PageBody>
        <ScreenTitle>
          {list ? (
            <span className="inline-flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ background: listColorVar(list.color) }} />
              {list.name}
            </span>
          ) : (
            'Tasks'
          )}
        </ScreenTitle>

        <ListRail lists={lists} />

        {list ? (
          <ListView list={list} listById={listById} />
        ) : (
          <>
            <div className="mb-5 flex gap-1 border-b border-border">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setParams(v.key === 'upcoming' ? {} : { v: v.key }, { replace: true })}
                  className={cn(
                    '-mb-px border-b-2 px-2.5 pb-2 text-sm transition-colors',
                    view === v.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {view === 'upcoming' && <UpcomingView listById={listById} />}
            {view === 'nodate' && <FlatView pick="noDate" listById={listById} empty="Every task has a date." />}
            {view === 'deferred' && <FlatView pick="deferred" listById={listById} empty="Nothing deferred." />}
            {view === 'done' && <DoneView listId={null} listById={listById} />}
          </>
        )}
      </PageBody>
    </>
  );
}

function ListRail({ lists }: { lists: ListRow[] }) {
  return (
    <div className="scrollbar-none -mx-5 mb-5 flex gap-2 overflow-x-auto px-5 md:hidden">
      <NavLink
        to="/tasks"
        end
        className={({ isActive }) =>
          cn('shrink-0 rounded-full border px-3 py-1 text-sm', isActive ? 'border-foreground/40 bg-muted' : 'border-border text-muted-foreground')
        }
      >
        All
      </NavLink>
      {lists.map((l) => (
        <NavLink
          key={l.id}
          to={`/tasks/list/${l.id}`}
          className={({ isActive }) =>
            cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm',
              isActive ? 'border-foreground/40 bg-muted' : 'border-border text-muted-foreground',
            )
          }
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: listColorVar(l.color) }} />
          {l.name}
        </NavLink>
      ))}
    </div>
  );
}

function Rows({ tasks, listById, showList = true }: { tasks: Task[]; listById: Map<string, ListRow>; showList?: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {tasks.map((t) => (
        <TaskRow key={t.page_id} task={t} list={t.list_id ? listById.get(t.list_id) : undefined} showList={showList} />
      ))}
    </AnimatePresence>
  );
}

function Loading() {
  return (
    <div className="space-y-3 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-9 animate-pulse rounded bg-muted/50" />
      ))}
    </div>
  );
}

function UpcomingView({ listById }: { listById: Map<string, ListRow> }) {
  const { data, isLoading } = useOpenTasks();
  const groups = useMemo(() => groupTasks(data ?? []), [data]);

  const days = useMemo(() => {
    const horizon = startOfDay(new Date());
    horizon.setDate(horizon.getDate() + 14);
    const byDay = new Map<string, Task[]>();
    const later: Task[] = [];
    for (const t of groups.upcoming) {
      const d = new Date(t.deadline!);
      if (d >= horizon) {
        later.push(t);
        continue;
      }
      const key = toDateKey(d);
      byDay.set(key, [...(byDay.get(key) ?? []), t]);
    }
    return { byDay: [...byDay.entries()], later };
  }, [groups.upcoming]);

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-7">
      <QuickTaskInput placeholder="Add a task… try “dentist tue 10am #personal”" />
      {groups.overdue.length > 0 && (
        <section>
          <SectionTitle>
            <span className="text-primary">Overdue</span>
          </SectionTitle>
          <Rows tasks={groups.overdue} listById={listById} />
        </section>
      )}
      <section>
        <SectionTitle>Today</SectionTitle>
        {groups.today.length ? (
          <Rows tasks={groups.today} listById={listById} />
        ) : (
          <p className="py-2 text-sm text-muted-foreground">Nothing due today.</p>
        )}
      </section>
      {days.byDay.map(([key, tasks]) => (
        <section key={key}>
          <SectionTitle>{relativeDayLabel(new Date(`${key}T00:00`))}</SectionTitle>
          <Rows tasks={tasks.sort(byPriorityThenDeadline)} listById={listById} />
        </section>
      ))}
      {days.later.length > 0 && (
        <section>
          <SectionTitle>Later</SectionTitle>
          <Rows tasks={days.later} listById={listById} />
        </section>
      )}
      {groups.noDate.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {groups.noDate.length} task{groups.noDate.length === 1 ? '' : 's'} without a date ·{' '}
          <Link to="/tasks?v=nodate" className="underline underline-offset-4">
            review
          </Link>
        </p>
      )}
    </div>
  );
}

function FlatView({ pick, listById, empty }: { pick: 'noDate' | 'deferred'; listById: Map<string, ListRow>; empty: string }) {
  const { data, isLoading } = useOpenTasks();
  const tasks = useMemo(() => groupTasks(data ?? [])[pick], [data, pick]);
  if (isLoading) return <Loading />;
  return (
    <>
      {pick === 'noDate' && <QuickTaskInput />}
      {tasks.length ? <Rows tasks={tasks} listById={listById} /> : <p className="py-2 text-sm text-muted-foreground">{empty}</p>}
    </>
  );
}

function DoneView({ listId, listById }: { listId: string | null; listById: Map<string, ListRow> }) {
  const { data, isLoading } = useDoneTasks(listId);
  if (isLoading) return <Loading />;
  if (!data?.length) return <p className="py-2 text-sm text-muted-foreground">Nothing completed yet.</p>;
  return <Rows tasks={data} listById={listById} showList={!listId} />;
}

function ListView({ list, listById }: { list: ListRow; listById: Map<string, ListRow> }) {
  const { data, isLoading } = useOpenTasks();
  const [showDone, setShowDone] = useState(false);
  const groups = useMemo(() => groupTasks((data ?? []).filter((t) => t.list_id === list.id)), [data, list.id]);
  const dated = [...groups.overdue, ...groups.today, ...groups.upcoming];

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-7">
      <QuickTaskInput listId={list.id} placeholder={`Add to ${list.name}…`} />
      {dated.length > 0 && (
        <section>
          <SectionTitle>Scheduled</SectionTitle>
          <Rows tasks={dated} listById={listById} showList={false} />
        </section>
      )}
      {groups.noDate.length > 0 && (
        <section>
          <SectionTitle>No date</SectionTitle>
          <Rows tasks={groups.noDate} listById={listById} showList={false} />
        </section>
      )}
      {groups.deferred.length > 0 && (
        <section>
          <SectionTitle>Deferred</SectionTitle>
          <Rows tasks={groups.deferred} listById={listById} showList={false} />
        </section>
      )}
      {!dated.length && !groups.noDate.length && !groups.deferred.length && (
        <p className="text-sm text-muted-foreground">No open tasks in {list.name}.</p>
      )}
      <section>
        <button
          type="button"
          onClick={() => setShowDone((s) => !s)}
          className="inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform', !showDone && '-rotate-90')} />
          Completed
        </button>
        {showDone && (
          <div className="mt-2">
            <DoneView listId={list.id} listById={listById} />
          </div>
        )}
      </section>
    </div>
  );
}
