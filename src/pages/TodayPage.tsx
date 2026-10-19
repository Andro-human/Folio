import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Settings } from 'lucide-react';
import { format } from 'date-fns';
import { PageBody, PageHeader, SectionTitle } from '@/components/layout/PageHeader';
import { TaskRow } from '@/components/tasks/TaskRow';
import { QuickTaskInput } from '@/components/tasks/QuickTaskInput';
import { PageEditor } from '@/components/editor/PageEditor';
import { useOpenTasks, groupTasks } from '@/data/tasks';
import { useLists } from '@/data/lists';
import { useJot } from '@/data/pages';
import { dateOnlyToISO, todayKey } from '@/lib/dates';

export default function TodayPage() {
  const date = todayKey();
  const now = new Date();
  const tasks = useOpenTasks();
  const { data: lists = [] } = useLists();
  const jot = useJot(date);
  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);
  const groups = useMemo(() => groupTasks(tasks.data ?? []), [tasks.data]);

  const today = groups.today;
  const nothing = !tasks.isLoading && groups.overdue.length === 0 && today.length === 0;

  return (
    <>
      <PageHeader
        className="md:hidden"
        actions={
          <Link to="/settings" aria-label="Settings" className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground">
            <Settings className="h-[18px] w-[18px]" />
          </Link>
        }
      />
      <PageBody>
        <div className="mb-7 mt-1 md:mt-12">
          <p className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">{format(now, 'd MMMM yyyy')}</p>
          <h1 className="text-[2.4rem] leading-tight md:text-[3rem]">{format(now, 'EEEE')}</h1>
        </div>

        <section className="mb-9">
          {groups.overdue.length > 0 && (
            <div className="mb-5">
              <SectionTitle>
                <span className="text-primary">Overdue · {groups.overdue.length}</span>
              </SectionTitle>
              <AnimatePresence initial={false}>
                {groups.overdue.map((t) => (
                  <TaskRow key={t.page_id} task={t} list={t.list_id ? listById.get(t.list_id) : undefined} />
                ))}
              </AnimatePresence>
            </div>
          )}

          <SectionTitle right={<Link to="/tasks" className="font-mono text-2xs uppercase tracking-widest text-muted-foreground hover:text-foreground">All tasks →</Link>}>
            Due today{today.length ? ` · ${today.length}` : ''}
          </SectionTitle>
          <QuickTaskInput defaultDeadline={dateOnlyToISO(now)} placeholder="Add a task for today…" />
          <AnimatePresence initial={false}>
            {today.map((t) => (
              <TaskRow key={t.page_id} task={t} list={t.list_id ? listById.get(t.list_id) : undefined} />
            ))}
          </AnimatePresence>
          {nothing && <p className="py-3 text-sm text-muted-foreground">Nothing due today.</p>}
        </section>

        <section>
          <SectionTitle
            right={
              <Link to="/jots" className="font-mono text-2xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
                Past jots →
              </Link>
            }
          >
            Today’s jot
          </SectionTitle>
          <div className="rounded-lg border border-border/70 bg-card/30 px-4 py-3 md:px-5 md:py-4">
            {jot.isLoading ? (
              <div className="h-16 animate-pulse rounded bg-muted/50" />
            ) : (
              <PageEditor page={jot.data ?? null} mode="jot" jotDate={date} />
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground/80">
            Every line is a task. Start a line with <kbd className="font-mono">-</kbd> for a note, or indent it under a task.
          </p>
        </section>
      </PageBody>
    </>
  );
}
