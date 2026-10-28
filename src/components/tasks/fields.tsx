import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CalendarClock, Check, Flag, ListTodo, Repeat, X } from 'lucide-react';
import type { ListRow, Priority, TaskStatus } from '@/data/types';
import { listColorVar } from '@/data/lists';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { REPEAT_PRESETS, describeRRule, firstOccurrence } from '@/lib/recurrence';
import { addDays, formatDeadline, startOfDay } from '@/lib/dates';
import { cn } from '@/lib/utils';

/** Controlled pickers shared by the task page, the quick-add pills and the new-task sheet. */

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'done', label: 'Done' },
];

export interface Schedule {
  deadline: string | null;
  hasTime: boolean;
  rrule: string | null;
}

/** A repeat needs a first date; without a deadline it starts on the next matching day. */
export function withRepeat(s: Schedule, rrule: string | null): Schedule {
  if (!rrule || s.deadline) return { ...s, rrule };
  const first = firstOccurrence(rrule, startOfDay(new Date()));
  return first ? { deadline: first.toISOString(), hasTime: false, rrule } : { ...s, rrule };
}

type Size = 'md' | 'sm';

const chipClass = (active: boolean, size: Size = 'md') =>
  cn(
    'inline-flex shrink-0 items-center gap-1.5 rounded-full border transition-colors',
    size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
    active ? 'border-border bg-muted text-foreground' : 'border-dashed border-border text-muted-foreground hover:text-foreground',
  );

function Chip({
  icon,
  label,
  active,
  size,
  children,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  active: boolean;
  size?: Size;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={chipClass(active, size)}>
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
      {selected && <Check className="h-3.5 w-3.5 text-primary" />}
    </button>
  );
}

const flagClass = (p: Priority) => (p === 'high' ? 'text-destructive' : p === 'low' ? 'text-muted-foreground/60' : '');

export function PriorityField({ value, onChange, size }: { value: Priority; onChange: (p: Priority) => void; size?: Size }) {
  return (
    <Chip
      icon={<Flag className={cn('h-3.5 w-3.5', flagClass(value))} />}
      label={PRIORITIES.find((p) => p.value === value)?.label ?? 'Medium'}
      active={value !== 'medium'}
      size={size}
    >
      {(close) =>
        PRIORITIES.map((p) => (
          <MenuRow
            key={p.value}
            selected={value === p.value}
            onClick={() => {
              onChange(p.value);
              close();
            }}
          >
            <Flag className={cn('h-3.5 w-3.5', flagClass(p.value))} />
            {p.label}
          </MenuRow>
        ))
      }
    </Chip>
  );
}

export function StatusField({
  value,
  onChange,
  options = STATUSES,
  size,
}: {
  value: TaskStatus;
  onChange: (s: TaskStatus) => void;
  options?: typeof STATUSES;
  size?: Size;
}) {
  return (
    <Chip
      icon={<Check className="h-3.5 w-3.5" />}
      label={STATUSES.find((s) => s.value === value)?.label ?? 'To do'}
      active={value !== 'todo'}
      size={size}
    >
      {(close) =>
        options.map((s) => (
          <MenuRow
            key={s.value}
            selected={value === s.value}
            onClick={() => {
              onChange(s.value);
              close();
            }}
          >
            {s.label}
          </MenuRow>
        ))
      }
    </Chip>
  );
}

export function ListField({
  value,
  lists,
  onChange,
  size,
}: {
  value: string | null;
  lists: ListRow[];
  onChange: (id: string) => void;
  size?: Size;
}) {
  const list = lists.find((l) => l.id === value);
  return (
    <Chip
      icon={<span className="h-2 w-2 rounded-full" style={{ background: list ? listColorVar(list.color) : 'transparent' }} />}
      label={list?.name ?? 'No list'}
      active={!!list}
      size={size}
    >
      {(close) => (
        <>
          {lists.map((l) => (
            <MenuRow
              key={l.id}
              selected={value === l.id}
              onClick={() => {
                onChange(l.id);
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
  );
}

export function RepeatField({ value, onChange, size }: { value: string | null; onChange: (rrule: string | null) => void; size?: Size }) {
  return (
    <Chip icon={<Repeat className="h-3.5 w-3.5" />} label={value ? describeRRule(value) : 'Repeat'} active={!!value} size={size}>
      {(close) => (
        <>
          {REPEAT_PRESETS.map((p) => (
            <MenuRow
              key={p.rrule}
              selected={value === p.rrule}
              onClick={() => {
                onChange(p.rrule);
                close();
              }}
            >
              {p.label}
            </MenuRow>
          ))}
          {value && (
            <MenuRow
              onClick={() => {
                onChange(null);
                close();
              }}
            >
              <X className="h-3.5 w-3.5" /> Doesn't repeat
            </MenuRow>
          )}
        </>
      )}
    </Chip>
  );
}

export function DeadlineField({
  deadline,
  hasTime,
  overdue,
  onChange,
  size,
}: {
  deadline: string | null;
  hasTime: boolean;
  overdue?: boolean;
  onChange: (deadline: string | null, hasTime: boolean) => void;
  size?: Size;
}) {
  const [open, setOpen] = useState(false);
  const day = deadline ? new Date(deadline) : undefined;
  const [time, setTime] = useState('');
  useEffect(() => setTime(deadline && hasTime ? format(new Date(deadline), 'HH:mm') : ''), [deadline, hasTime]);

  const apply = (d: Date | undefined, hhmm: string) => {
    if (!d) return onChange(null, false);
    const at = startOfDay(d);
    if (hhmm) {
      const [h, m] = hhmm.split(':').map(Number);
      at.setHours(h, m);
    }
    onChange(at.toISOString(), !!hhmm);
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
        <button type="button" className={chipClass(!!deadline, size)}>
          <CalendarClock className={cn('h-3.5 w-3.5', overdue && 'text-destructive')} />
          <span className={cn(overdue && 'text-destructive')}>{deadline ? formatDeadline(deadline, hasTime) : 'Deadline'}</span>
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
          selected={day}
          defaultMonth={day}
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
              if (day) apply(day, e.target.value);
            }}
            className="h-8 rounded-md border border-border bg-transparent px-2 text-sm"
          />
          {time && (
            <button
              type="button"
              onClick={() => {
                setTime('');
                if (day) apply(day, '');
              }}
              className="text-xs text-muted-foreground underline underline-offset-4"
            >
              No time
            </button>
          )}
          <div className="flex-1" />
          {deadline && (
            <button
              type="button"
              onClick={() => {
                apply(undefined, '');
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
