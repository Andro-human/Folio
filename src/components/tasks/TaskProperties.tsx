import { toast } from 'sonner';
import type { TaskRow } from '@/data/types';
import { updateTask } from '@/data/tasks';
import { useLists } from '@/data/lists';
import { isOverdue } from '@/lib/dates';
import { TaskCheck } from './TaskRow';
import { DeadlineField, ListField, PriorityField, RepeatField, StatusField, withRepeat } from './fields';

function save(pageId: string, patch: Partial<TaskRow>) {
  updateTask(pageId, patch).catch(() => toast.error("Couldn't update the task"));
}

/** The property strip shown above a task page's body. */
export function TaskProperties({ task }: { task: TaskRow }) {
  const { data: lists = [] } = useLists();
  const schedule = { deadline: task.deadline, hasTime: task.deadline_has_time, rrule: task.rrule };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <div className="mr-1 flex items-center">
        <TaskCheck task={task} size="lg" />
      </div>
      <StatusField value={task.status} onChange={(status) => save(task.page_id, { status })} />
      <PriorityField value={task.priority} onChange={(priority) => save(task.page_id, { priority })} />
      <ListField value={task.list_id} lists={lists} onChange={(list_id) => save(task.page_id, { list_id })} />
      <DeadlineField
        deadline={task.deadline}
        hasTime={task.deadline_has_time}
        overdue={task.status !== 'done' && isOverdue(task.deadline, task.deadline_has_time)}
        onChange={(deadline, deadline_has_time) => save(task.page_id, { deadline, deadline_has_time })}
      />
      <RepeatField
        value={task.rrule}
        onChange={(rrule) => {
          const next = withRepeat(schedule, rrule);
          // Only send the deadline when the repeat filled one in, so an existing reminder isn't reset.
          save(
            task.page_id,
            next.deadline === task.deadline
              ? { rrule: next.rrule }
              : { rrule: next.rrule, deadline: next.deadline, deadline_has_time: next.hasTime },
          );
        }}
      />
    </div>
  );
}
