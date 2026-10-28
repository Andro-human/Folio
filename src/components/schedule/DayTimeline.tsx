import { Link } from 'react-router-dom';
import { Repeat } from 'lucide-react';
import type { Task } from '@/data/types';
import { clockLabel, type Occurrence } from '@/data/events';
import { TaskCheck } from '@/components/tasks/TaskRow';
import { cn } from '@/lib/utils';

const HOUR = 56; // px per hour
const PX = HOUR / 60; // px per minute
const MIN_BLOCK = 26 / PX; // shortest drawn block, in minutes
const TASK_SPAN = 26 / PX;

type Item =
  | { kind: 'event'; key: string; start: number; end: number; occ: Occurrence }
  | { kind: 'task'; key: string; start: number; end: number; task: Task };

interface Placed {
  item: Item;
  col: number;
  cols: number;
}

/** Side-by-side columns for items that overlap, like a calendar day view. */
function layout(items: Item[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;

  const close = () => {
    for (const p of cluster) p.cols = colEnds.length;
    cluster = [];
    colEnds = [];
  };

  for (const item of sorted) {
    const end = Math.max(item.end, item.start + MIN_BLOCK);
    if (item.start >= clusterEnd) close();
    let col = colEnds.findIndex((e) => e <= item.start);
    if (col === -1) col = colEnds.push(end) - 1;
    else colEnds[col] = end;
    const p = { item, col, cols: 1 };
    cluster.push(p);
    placed.push(p);
    clusterEnd = Math.max(clusterEnd, end);
  }
  close();
  return placed;
}

const minutesOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

export function DayTimeline({
  occurrences,
  tasks,
  now,
  onNew,
  onOpen,
}: {
  occurrences: Occurrence[];
  /** Open tasks with a time on this day. */
  tasks: Task[];
  /** Minutes from midnight when the day shown is today; draws the now line. */
  now: number | null;
  onNew: (start: number) => void;
  onOpen: (occ: Occurrence) => void;
}) {
  const items: Item[] = [
    ...occurrences.map((occ) => ({ kind: 'event' as const, key: `e${occ.event.id}`, start: occ.start, end: occ.end, occ })),
    ...tasks.map((task) => {
      const start = minutesOf(task.deadline!);
      return { kind: 'task' as const, key: `t${task.page_id}`, start, end: start + TASK_SPAN, task };
    }),
  ];

  // 6 am – 11 pm, stretched to fit anything earlier or later.
  const first = Math.min(6, ...items.map((i) => Math.floor(i.start / 60)));
  const last = Math.max(23, ...items.map((i) => Math.ceil(Math.max(i.end, i.start + MIN_BLOCK) / 60)));
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const top = (min: number) => (min - first * 60) * PX;

  return (
    <div className="relative mb-10 mt-3 select-none" style={{ height: hours.length * HOUR }}>
      {hours.map((h) => (
        <button
          key={h}
          type="button"
          aria-label={`New at ${clockLabel(h * 60, true)}`}
          onClick={() => onNew(h * 60)}
          className="absolute inset-x-0 flex items-start border-t border-border/60 text-left hover:bg-muted/30"
          style={{ top: top(h * 60), height: HOUR }}
        >
          <span className="-mt-2 w-12 shrink-0 bg-background pr-2 text-right text-[11px] tabular text-muted-foreground">
            {h === 0 ? '' : `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`}
          </span>
        </button>
      ))}

      <div className="pointer-events-none absolute inset-y-0 left-12 right-0">
        {layout(items).map(({ item, col, cols }) => {
          const height = Math.max(item.end - item.start, item.kind === 'task' ? TASK_SPAN : MIN_BLOCK) * PX - 2;
          const style = {
            top: top(item.start) + 1,
            height,
            left: `calc(${(col / cols) * 100}% + 4px)`,
            width: `calc(${100 / cols}% - 6px)`,
          };
          if (item.kind === 'task') {
            return (
              <div
                key={item.key}
                style={style}
                className="pointer-events-auto absolute flex items-center gap-2 rounded-md border border-border bg-card px-2"
              >
                <TaskCheck task={item.task} />
                <Link to={`/p/${item.task.page_id}`} className="min-w-0 flex-1 truncate text-[13px]">
                  {item.task.page.title || 'Untitled task'}
                </Link>
              </div>
            );
          }
          const { occ } = item;
          const roomy = height >= 40;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onOpen(occ)}
              style={style}
              className={cn(
                'pointer-events-auto absolute flex overflow-hidden rounded-md border-l-[3px] border-primary bg-primary/10 px-2 text-left transition-colors hover:bg-primary/15',
                roomy ? 'flex-col py-1' : 'items-center gap-2',
                now !== null && occ.end <= now && 'opacity-55',
              )}
            >
              <span className="flex min-w-0 items-center gap-1 text-[13px] font-medium leading-tight">
                <span className="truncate">{occ.event.title}</span>
                {!!occ.event.days?.length && <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />}
              </span>
              {/* A short block beside others only has room for its title. */}
              {(roomy || cols === 1) && (
                <span className="shrink-0 text-[11px] tabular text-muted-foreground">
                  {clockLabel(occ.start)} – {clockLabel(occ.end, true)}
                </span>
              )}
            </button>
          );
        })}

        {now !== null && now >= first * 60 && now <= last * 60 && (
          <div className="absolute inset-x-0 z-10 flex items-center" style={{ top: top(now) - 4 }}>
            <span className="-ml-1 h-2 w-2 rounded-full bg-destructive" />
            <span className="h-px flex-1 bg-destructive" />
          </div>
        )}
      </div>
    </div>
  );
}
