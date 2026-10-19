import { useMemo, useState } from 'react';
import { CalendarClock, Flag, Plus, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { parseQuickTask } from '@/lib/quickSyntax';
import { createTask } from '@/data/tasks';
import { useLists, listColorVar } from '@/data/lists';
import { formatDeadline } from '@/lib/dates';
import { describeRRule } from '@/lib/recurrence';

/** One-line add with quick syntax: "pay rent friday #home !high every month". */
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
  const { data: lists = [] } = useLists();
  const parsed = useMemo(() => (text.trim() ? parseQuickTask(text, lists) : null), [text, lists]);
  const parsedList = parsed?.listId ? lists.find((l) => l.id === parsed.listId) : undefined;

  const submit = async () => {
    if (!parsed || !parsed.title) return;
    const draft = text;
    setText('');
    try {
      await createTask({
        title: parsed.title,
        listId: parsed.listId ?? listId,
        priority: parsed.priority,
        deadline: parsed.deadline ?? defaultDeadline ?? null,
        deadlineHasTime: parsed.deadline ? parsed.deadlineHasTime : false,
        rrule: parsed.rrule ?? null,
      });
    } catch {
      setText(draft);
      toast.error("Couldn't add the task");
    }
  };

  return (
    <div className="mb-2 rounded-lg border border-border bg-card/40 focus-within:border-muted-foreground/50">
      <div className="flex items-center gap-2.5 px-3">
        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={placeholder}
          enterKeyHint="done"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
        />
      </div>
      {parsed && (parsed.deadline || parsed.priority || parsedList || parsed.rrule) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 px-3 py-1.5 font-mono text-2xs text-muted-foreground">
          {parsed.deadline && (
            <span className="inline-flex items-center gap-1 text-foreground">
              <CalendarClock className="h-3 w-3" />
              {formatDeadline(parsed.deadline, parsed.deadlineHasTime)}
            </span>
          )}
          {parsed.rrule && (
            <span className="inline-flex items-center gap-1">
              <Repeat className="h-3 w-3" />
              {describeRRule(parsed.rrule)}
            </span>
          )}
          {parsed.priority && (
            <span className="inline-flex items-center gap-1">
              <Flag className="h-3 w-3" />
              {parsed.priority}
            </span>
          )}
          {parsedList && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: listColorVar(parsedList.color) }} />
              {parsedList.name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
