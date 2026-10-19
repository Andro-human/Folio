import { Link } from 'react-router-dom';
import { CalendarClock, FileText, Repeat } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import type { ListRow, Task } from '@/data/types';
import { completeTask, uncompleteTask } from '@/data/tasks';
import { listColorVar } from '@/data/lists';
import { formatDeadline, isOverdue } from '@/lib/dates';
import { cn } from '@/lib/utils';

export function TaskCheck({
  task,
  size = 'md',
}: {
  task: Pick<Task, 'page_id' | 'status' | 'priority' | 'rrule' | 'deadline' | 'deadline_has_time'>;
  size?: 'md' | 'lg';
}) {
  const done = task.status === 'done';
  const toggle = () => {
    if (done) {
      uncompleteTask(task.page_id).catch(() => toast.error("Couldn't update the task"));
      return;
    }
    completeTask(task)
      .then((next) => {
        if (next) toast(`Repeats — next ${formatDeadline(next.toISOString(), task.deadline_has_time)}`);
      })
      .catch(() => toast.error("Couldn't complete the task"));
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={done ? 'Mark not done' : 'Mark done'}
      className={cn(
        'grid shrink-0 place-items-center rounded-full border-[1.5px] transition-colors',
        size === 'lg' ? 'h-6 w-6' : 'h-[18px] w-[18px]',
        done
          ? 'border-primary bg-primary text-primary-foreground'
          : task.priority === 'high'
            ? 'border-destructive hover:bg-destructive/10'
            : task.priority === 'low'
              ? 'border-muted-foreground/55 hover:bg-muted'
              : 'border-muted-foreground/80 hover:bg-muted',
      )}
    >
      {done && (
        <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export function TaskRow({
  task,
  list,
  originTitle,
  showList = true,
}: {
  task: Task;
  list?: ListRow;
  originTitle?: string | null;
  showList?: boolean;
}) {
  const done = task.status === 'done';
  const overdue = !done && isOverdue(task.deadline, task.deadline_has_time);

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      className="group flex items-start gap-3 border-b border-border/60 py-2.5 last:border-0"
    >
      <div className="pt-[3px]">
        <TaskCheck task={task} />
      </div>
      <Link to={`/p/${task.page_id}`} className="min-w-0 flex-1">
        <div className={cn('leading-snug', done && 'text-muted-foreground line-through decoration-muted-foreground/60')}>
          {task.page.title || <span className="text-muted-foreground">Untitled task</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
          {task.deadline && (
            <span className={cn('inline-flex items-center gap-1', overdue && 'text-destructive')}>
              <CalendarClock className="h-3 w-3" />
              {formatDeadline(task.deadline, task.deadline_has_time)}
            </span>
          )}
          {task.rrule && <Repeat className="h-3 w-3" aria-label="Repeats" />}
          {task.status === 'deferred' && <span>Deferred</span>}
          {showList && list && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: listColorVar(list.color) }} />
              {list.name}
            </span>
          )}
          {originTitle && (
            <span className="inline-flex items-center gap-1 truncate">
              <FileText className="h-3 w-3" />
              {originTitle}
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
