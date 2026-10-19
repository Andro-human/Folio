import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarClock, Check, Flag, ListTodo, Repeat, X } from 'lucide-react';
import { toast } from 'sonner';
import type { TaskRow, Priority, TaskStatus } from '@/data/types';
import { updateTask } from '@/data/tasks';
import { useLists, listColorVar } from '@/data/lists';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { REPEAT_PRESETS, describeRRule, firstOccurrence } from '@/lib/recurrence';
import { addDays, formatDeadline, isOverdue, startOfDay } from '@/lib/dates';
import { TaskCheck } from './TaskRow';
import { cn } from '@/lib/utils';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'done', label: 'Done' },
];

function save(pageId: string, patch: Partial<TaskRow>) {
  updateTask(pageId, patch).catch(() => toast.error("Couldn't update the task"));
}

/** The property strip shown above a task page's body. */
export function TaskProperties({ task }: { task: TaskRow }) {
  const { data: lists = [] } = useLists();
  const list = lists.find((l) => l.id === task.list_id);

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <div className="mr-1 flex items-center">
        <TaskCheck task={task} size="lg" />
      </div>

      <Chip
        icon={<Check className="h-3.5 w-3.5" />}
        label={STATUSES.find((s) => s.value === task.status)?.label ?? 'To do'}
        active={task.status !== 'todo'}
      >
        {(close) =>
          STATUSES.map((s) => (
            <MenuRow
              key={s.value}
              selected={task.status === s.value}
              onClick={() => {
                save(task.page_id, { status: s.value });
                close();
              }}
            >
              {s.label}
            </MenuRow>
          ))
        }
      </Chip>

      <Chip
        icon={<Flag className={cn('h-3.5 w-3.5', task.priority === 'high' && 'text-primary')} />}
        label={PRIORITIES.find((p) => p.value === task.priority)?.label ?? 'Medium'}
        active={task.priority !== 'medium'}
      >
        {(close) =>
          PRIORITIES.map((p) => (
            <MenuRow
              key={p.value}
              selected={task.priority === p.value}
              onClick={() => {
                save(task.page_id, { priority: p.value });
                close();
              }}
            >
              {p.label}
            </MenuRow>
          ))
        }
      </Chip>

      <Chip
        icon={
          <span className="h-2 w-2 rounded-full" style={{ background: list ? listColorVar(list.color) : 'transparent' }} />
        }
        label={list?.name ?? 'No list'}
        active={!!list}
      >
        {(close) => (
          <>
            {lists.map((l) => (
              <MenuRow
                key={l.id}
                selected={task.list_id === l.id}
                onClick={() => {
                  save(task.page_id, { list_id: l.id });
                  close();
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: listColorVar(l.color) }} />
                {l.name}
              </MenuRow>
            ))}
            {!lists.length && (
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                <ListTodo className="h-4 w-4" /> No lists
              </div>
            )}
          </>
        )}
      </Chip>

      <DeadlineChip task={task} />

      <Chip
        icon={<Repeat className="h-3.5 w-3.5" />}
        label={task.rrule ? describeRRule(task.rrule) : 'Repeat'}
        active={!!task.rrule}
      >
        {(close) => (
          <>
            {REPEAT_PRESETS.map((p) => (
              <MenuRow
                key={p.rrule}
                selected={task.rrule === p.rrule}
                onClick={() => {
                  const patch: Partial<TaskRow> = { rrule: p.rrule };
                  if (!task.deadline) {
                    const first = firstOccurrence(p.rrule, startOfDay(new Date()));
                    if (first) Object.assign(patch, { deadline: first.toISOString(), deadline_has_time: false });
                  }
                  save(task.page_id, patch);
                  close();
                }}
              >
                {p.label}
              </MenuRow>
            ))}
            {task.rrule && (
              <MenuRow
                onClick={() => {
                  save(task.page_id, { rrule: null });
                  close();
                }}
              >
                <X className="h-3.5 w-3.5" /> Doesn't repeat
              </MenuRow>
            )}
          </>
        )}
      </Chip>
    </div>
  );
}

function DeadlineChip({ task }: { task: TaskRow }) {
  const [open, setOpen] = useState(false);
  const deadline = task.deadline ? new Date(task.deadline) : undefined;
  const [time, setTime] = useState(task.deadline && task.deadline_has_time ? format(new Date(task.deadline), 'HH:mm') : '');
  const overdue = task.status !== 'done' && isOverdue(task.deadline, task.deadline_has_time);

  const apply = (day: Date | undefined, hhmm: string) => {
    if (!day) {
      save(task.page_id, { deadline: null, deadline_has_time: false });
      return;
    }
    const d = startOfDay(day);
    if (hhmm) {
      const [h, m] = hhmm.split(':').map(Number);
      d.setHours(h, m);
    }
    save(task.page_id, { deadline: d.toISOString(), deadline_has_time: !!hhmm });
  };

  const today = startOfDay(new Date());
  const quick: { label: string; day: Date }[] = [
    { label: 'Today', day: today },
    { label: 'Tomorrow', day: addDays(today, 1) },
    { label: 'Next week', day: addDays(today, 7 - ((today.getDay() + 6) % 7)) },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={chipClass(!!task.deadline)}>
          <CalendarClock className={cn('h-3.5 w-3.5', overdue && 'text-primary')} />
          <span className={cn(overdue && 'text-primary')}>
            {task.deadline ? formatDeadline(task.deadline, task.deadline_has_time) : 'Deadline'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex gap-1.5 border-b border-border p-2">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                apply(q.day, time);
                setOpen(false);
              }}
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            >
              {q.label}
            </button>
          ))}
        </div>
        <Calendar
          mode="single"
          selected={deadline}
          defaultMonth={deadline}
          onSelect={(d) => {
            apply(d, time);
            if (d) setOpen(false);
          }}
          weekStartsOn={1}
        />
        <div className="flex items-center gap-2 border-t border-border p-2">
          <input
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              if (deadline) apply(deadline, e.target.value);
            }}
            className="h-8 rounded-md border border-border bg-transparent px-2 text-sm"
          />
          {time && (
            <button
              type="button"
              onClick={() => {
                setTime('');
                if (deadline) apply(deadline, '');
              }}
              className="text-xs text-muted-foreground underline underline-offset-4"
            >
              No time
            </button>
          )}
          <div className="flex-1" />
          {task.deadline && (
            <button
              type="button"
              onClick={() => {
                apply(undefined, '');
                setTime('');
                setOpen(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const chipClass = (active: boolean) =>
  cn(
    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors',
    active ? 'border-border bg-muted text-foreground' : 'border-dashed border-border text-muted-foreground hover:text-foreground',
  );

function Chip({
  icon,
  label,
  active,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={chipClass(active)}>
          {icon}
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1">
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

function MenuRow({
  children,
  selected,
  onClick,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
    >
      <span className="flex flex-1 items-center gap-2">{children}</span>
      {selected && <Check className="h-3.5 w-3.5 text-gold" />}
    </button>
  );
}
