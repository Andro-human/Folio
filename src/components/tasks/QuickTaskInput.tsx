import { useMemo, useState } from 'react';
import { Maximize2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { parseQuickTask } from '@/lib/quickSyntax';
import { createTask } from '@/data/tasks';
import { useLists, useProfile } from '@/data/lists';
import { DeadlineField, ListField, PriorityField, RepeatField, withRepeat } from './fields';
import { NewTaskSheet, type TaskDraft } from './NewTaskSheet';

/**
 * One-line add. Quick syntax ("pay rent friday #home !high every month") fills the pills below;
 * picking from a pill overrides what was typed. The expand button opens the full form.
 */
export function QuickTaskInput({
  listId,
  defaultDeadline,
  placeholder = 'Add a task…',
}: {
  listId?: string;
  /** Applied when the text names no date, e.g. adding from Today. */
  defaultDeadline?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<Partial<Omit<TaskDraft, 'title'>>>({});
  const [expanded, setExpanded] = useState(false);
  const { data: lists = [] } = useLists();
  const { data: profile } = useProfile();
  const parsed = useMemo(() => (text.trim() ? parseQuickTask(text, lists) : null), [text, lists]);

  const draft: TaskDraft = {
    title: parsed?.title ?? '',
    priority: picked.priority ?? parsed?.priority ?? 'medium',
    listId: 'listId' in picked ? picked.listId ?? null : (parsed?.listId ?? listId ?? profile?.default_list_id ?? null),
    deadline: 'deadline' in picked ? picked.deadline ?? null : (parsed?.deadline ?? defaultDeadline ?? null),
    hasTime: 'deadline' in picked ? !!picked.hasTime : parsed?.deadline ? parsed.deadlineHasTime : false,
    rrule: 'rrule' in picked ? picked.rrule ?? null : (parsed?.rrule ?? null),
  };
  const pick = (patch: Partial<Omit<TaskDraft, 'title'>>) => setPicked((p) => ({ ...p, ...patch }));
  const reset = () => {
    setText('');
    setPicked({});
  };

  const submit = async () => {
    if (!draft.title) return;
    const before = { text, picked };
    reset();
    try {
      await createTask({
        title: draft.title,
        listId: draft.listId,
        priority: draft.priority,
        deadline: draft.deadline,
        deadlineHasTime: draft.hasTime,
        rrule: draft.rrule,
      });
    } catch {
      setText(before.text);
      setPicked(before.picked);
      toast.error(navigator.onLine ? "Couldn't add the task" : 'You’re offline — use the + button, it saves offline');
    }
  };

  const showPills = !!text.trim() || Object.keys(picked).length > 0;

  return (
    <div className="mb-2 rounded-xl bg-muted/70 ring-primary/40 focus-within:ring-2">
      <div className="flex items-center gap-2.5 pl-3 pr-1">
        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            } else if (e.key === 'Escape') {
              reset();
            }
          }}
          placeholder={placeholder}
          enterKeyHint="done"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
        />
        <button
          type="button"
          aria-label="More options"
          onClick={() => setExpanded(true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
      {showPills && (
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto px-3 pb-2.5">
          <DeadlineField
            size="sm"
            deadline={draft.deadline}
            hasTime={draft.hasTime}
            onChange={(deadline, hasTime) => pick({ deadline, hasTime })}
          />
          <PriorityField size="sm" value={draft.priority} onChange={(priority) => pick({ priority })} />
          <ListField size="sm" value={draft.listId} lists={lists} onChange={(id) => pick({ listId: id })} />
          <RepeatField size="sm" value={draft.rrule} onChange={(rrule) => pick(withRepeat(draft, rrule))} />
        </div>
      )}
      <NewTaskSheet
        open={expanded}
        initial={draft}
        onOpenChange={setExpanded}
        onCreated={() => {
          setExpanded(false);
          reset();
        }}
      />
    </div>
  );
}
