import { useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import type { ListRow, Priority, Task } from '@/data/types';
import { updateTask } from '@/data/tasks';
import { cn } from '@/lib/utils';
import { TaskRow } from './TaskRow';

const ORDER: { value: Priority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const byDeadline = (a: Task, b: Task) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');

interface RowProps {
  listById: Map<string, ListRow>;
  showList: boolean;
}

/**
 * A group of tasks split under High / Medium / Low sub-headings. Rows drag between levels to
 * change priority: mouse after a few pixels, touch after a short hold so scrolling still works.
 * Empty levels are hidden, except while dragging, when all three are drop targets.
 */
export function PrioritySections({ tasks, listById, showList = true }: { tasks: Task[] } & Partial<RowProps> & Pick<RowProps, 'listById'>) {
  const [active, setActive] = useState<Task | null>(null);
  const justDropped = useRef(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    setActive(null);
    // The row is a link; swallow the click the browser fires after the drop.
    justDropped.current = true;
    setTimeout(() => (justDropped.current = false), 0);
    const task = tasks.find((t) => t.page_id === a.id);
    const to = over?.id as Priority | undefined;
    if (!task || !to || to === task.priority) return;
    updateTask(task.page_id, { priority: to }).catch(() => toast.error("Couldn't change the priority"));
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active: a }) => setActive(tasks.find((t) => t.page_id === a.id) ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <div
        className="space-y-3"
        onClickCapture={(e) => {
          if (justDropped.current) e.preventDefault();
        }}
      >
        {ORDER.map(({ value, label }) => {
          const rows = tasks.filter((t) => t.priority === value).sort(byDeadline);
          if (!rows.length && !active) return null;
          return (
            <Section key={value} priority={value} label={label} dragging={!!active}>
              <AnimatePresence initial={false}>
                {rows.map((t) => (
                  <DraggableRow key={t.page_id} task={t} listById={listById} showList={showList} />
                ))}
              </AnimatePresence>
              {!rows.length && <div className="py-3 text-center text-xs text-muted-foreground">Drop here</div>}
            </Section>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {active && (
          <div className="rounded-lg bg-card px-3 shadow-lg ring-1 ring-border">
            <TaskRow task={active} list={active.list_id ? listById.get(active.list_id) : undefined} showList={showList} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Section({
  priority,
  label,
  dragging,
  children,
}: {
  priority: Priority;
  label: string;
  dragging: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: priority });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        '-mx-2 rounded-lg px-2 transition-colors',
        dragging && 'outline-dashed outline-1 outline-border',
        isOver && 'bg-primary/5 outline-primary/50',
      )}
    >
      <div
        className={cn(
          'pt-1 text-[11px] font-semibold uppercase tracking-wider',
          priority === 'high' ? 'text-destructive' : 'text-muted-foreground/70',
        )}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function DraggableRow({ task, listById, showList }: { task: Task } & RowProps) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: task.page_id });
  return (
    <TaskRow
      task={task}
      list={task.list_id ? listById.get(task.list_id) : undefined}
      showList={showList}
      drag={{ ref: setNodeRef, props: { ...attributes, ...listeners }, dragging: isDragging }}
    />
  );
}
