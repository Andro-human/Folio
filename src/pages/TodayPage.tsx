import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { format } from 'date-fns';
import { PageBody, PageHeader, SectionTitle } from '@/components/layout/PageHeader';
import { PrioritySections } from '@/components/tasks/PrioritySections';
import { QuickTaskInput } from '@/components/tasks/QuickTaskInput';
import { UpNext } from '@/components/schedule/UpNext';
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
          <h1 className="text-[2.125rem] font-bold leading-tight md:text-[2.5rem]">Today</h1>
          <p className="text-[15px] text-muted-foreground">{format(now, 'EEEE, d MMMM')}</p>
        </div>

        <UpNext />

        <section className="mb-9">
          {groups.overdue.length > 0 && (
            <div className="mb-5">
              <SectionTitle>
                <span className="text-destructive">Overdue · {groups.overdue.length}</span>
              </SectionTitle>
              <PrioritySections tasks={groups.overdue} listById={listById} />
            </div>
          )}

          <SectionTitle right={<Link to="/tasks" className="text-[13px] text-primary">All tasks</Link>}>
            Due today{today.length ? ` · ${today.length}` : ''}
          </SectionTitle>
          <QuickTaskInput defaultDeadline={dateOnlyToISO(now)} placeholder="Add a task for today…" />
          <PrioritySections tasks={today} listById={listById} />
          {nothing && <p className="py-3 text-sm text-muted-foreground">Nothing due today.</p>}
        </section>

        <section>
          <SectionTitle
            right={
              <Link to="/jots" className="text-[13px] text-primary">
                Past jots
              </Link>
            }
          >
            Today’s jot
          </SectionTitle>
          <div className="rounded-xl bg-card px-4 py-3 md:px-5 md:py-4">
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
