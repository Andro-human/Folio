import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { createTask, updateTask } from '@/data/tasks';
import { savePage } from '@/data/pages';
import { useLists } from '@/data/lists';
import type { Priority, TaskStatus } from '@/data/types';
import { DeadlineField, ListField, PriorityField, RepeatField, STATUSES, StatusField, withRepeat, type Schedule } from './fields';

export interface TaskDraft extends Schedule {
  title: string;
  priority: Priority;
  listId: string | null;
}

interface Props {
  open: boolean;
  initial: TaskDraft;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

/** The full add-task form: title, notes and every property. Opened from the quick-add input's expand button. */
export function NewTaskSheet({ open, initial, onOpenChange, onCreated }: Props) {
  const desktop = useMediaQuery('(min-width: 768px)');
  const body = <NewTaskForm key={String(open)} initial={initial} onCancel={() => onOpenChange(false)} onCreated={onCreated} />;

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="top-[18%] translate-y-0 gap-0 p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">New task</DialogTitle>
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="border-border bg-card">
        <DrawerTitle className="sr-only">New task</DrawerTitle>
        {body}
      </DrawerContent>
    </Drawer>
  );
}

const textToDoc = (text: string) => ({
  type: 'doc',
  content: text.split('\n').map((line) => (line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' })),
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-16 shrink-0 text-[13px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function NewTaskForm({ initial, onCancel, onCreated }: { initial: TaskDraft; onCancel: () => void; onCreated: () => void }) {
  const { data: lists = [] } = useLists();
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<TaskDraft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const submit = async () => {
    const title = draft.title.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      const id = await createTask({
        title,
        listId: draft.listId,
        priority: draft.priority,
        deadline: draft.deadline,
        deadlineHasTime: draft.hasTime,
        rrule: draft.rrule,
      });
      if (status !== 'todo') await updateTask(id, { status });
      if (notes.trim()) {
        await savePage({ id, baseVersion: 1, title, content: textToDoc(notes.trim()), contentText: notes.trim(), linkIds: [] });
      }
      onCreated();
    } catch {
      setBusy(false);
      toast.error("Couldn't add the task");
    }
  };

  return (
    <form
      className="px-4 pb-4 pt-3 md:px-5 md:pt-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        ref={titleRef}
        value={draft.title}
        onChange={(e) => set({ title: e.target.value })}
        placeholder="Task"
        enterKeyHint="done"
        className="w-full bg-transparent text-[19px] font-medium outline-none placeholder:text-muted-foreground/60"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Notes"
        className="mt-2 w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
      />

      <div className="mt-2 border-t border-border/60 pt-2">
        <Field label="Priority">
          <PriorityField value={draft.priority} onChange={(priority) => set({ priority })} />
        </Field>
        <Field label="List">
          <ListField value={draft.listId} lists={lists} onChange={(listId) => set({ listId })} />
        </Field>
        <Field label="Deadline">
          <DeadlineField deadline={draft.deadline} hasTime={draft.hasTime} onChange={(deadline, hasTime) => set({ deadline, hasTime })} />
        </Field>
        <Field label="Repeat">
          <RepeatField value={draft.rrule} onChange={(rrule) => set(withRepeat(draft, rrule))} />
        </Field>
        <Field label="Status">
          <StatusField value={status} onChange={setStatus} options={STATUSES.filter((s) => s.value !== 'done')} />
        </Field>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-9 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!draft.title.trim() || busy}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Add task
        </button>
      </div>
    </form>
  );
}
