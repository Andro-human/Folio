import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, CheckCircle2, Flag, Minus, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { parseQuickTask } from '@/lib/quickSyntax';
import { describeRRule } from '@/lib/recurrence';
import { formatDeadline } from '@/lib/dates';
import { useLists, listColorVar } from '@/data/lists';
import { enqueueCapture, flushOutbox, isPending } from '@/data/outbox';
import type { CaptureKind } from '@/components/layout/capture';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  kind: CaptureKind;
  onOpenChange: (open: boolean) => void;
}

/** Quick capture: tasks and notes both land in today's jot. */
export function CaptureSheet({ open, kind, onOpenChange }: Props) {
  const desktop = useMediaQuery('(min-width: 768px)');
  const body = <CaptureForm key={String(open)} initialKind={kind} onDone={() => onOpenChange(false)} />;

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="top-[22%] translate-y-0 gap-0 p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Quick capture</DialogTitle>
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="border-border bg-card">
        <DrawerTitle className="sr-only">Quick capture</DrawerTitle>
        {body}
      </DrawerContent>
    </Drawer>
  );
}

function CaptureForm({ initialKind, onDone }: { initialKind: CaptureKind; onDone: () => void }) {
  const [kind, setKind] = useState<CaptureKind>(initialKind);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const { data: lists = [] } = useLists();
  const parsed = useMemo(
    () => (kind === 'task' && text.trim() ? parseQuickTask(text, lists) : null),
    [kind, text, lists],
  );
  const parsedList = parsed?.listId ? lists.find((l) => l.id === parsed.listId) : undefined;

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const submit = async () => {
    const raw = text.trim();
    if (!raw || busy) return;
    setBusy(true);
    const item = await enqueueCapture(kind, raw);
    onDone();
    await flushOutbox();
    if (!isPending(item.id)) toast(kind === 'task' ? 'Task added to today' : 'Noted in today’s jot');
    else if (!navigator.onLine) toast('Saved offline — it’ll sync when you’re back online');
    else toast('Saved — it’ll sync shortly');
  };

  return (
    <div className="px-4 pb-4 pt-3 md:pt-4">
      <div className="mb-3 inline-flex rounded-full border border-border p-0.5 text-sm">
        {(['task', 'note'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              ref.current?.focus();
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors',
              kind === k ? 'bg-muted text-foreground' : 'text-muted-foreground',
            )}
          >
            {k === 'task' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
            {k === 'task' ? 'Task' : 'Note'}
          </button>
        ))}
      </div>

      <textarea
        ref={ref}
        value={text}
        rows={kind === 'note' ? 4 : 2}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (kind === 'task' ? !e.shiftKey : e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
        }}
        enterKeyHint={kind === 'task' ? 'done' : 'enter'}
        placeholder={kind === 'task' ? 'Call the bank friday 5pm #work !high' : 'What’s on your mind?'}
        className="w-full resize-none bg-transparent text-[17px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
      />

      <div className="flex min-h-[1.25rem] flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {parsed?.deadline && (
          <span className="inline-flex items-center gap-1 text-foreground">
            <CalendarClock className="h-3 w-3" />
            {formatDeadline(parsed.deadline, parsed.deadlineHasTime)}
          </span>
        )}
        {parsed?.rrule && (
          <span className="inline-flex items-center gap-1">
            <Repeat className="h-3 w-3" />
            {describeRRule(parsed.rrule)}
          </span>
        )}
        {parsed?.priority && (
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
        {kind === 'task' && !parsed && <span>Dates, #list and !priority are understood</span>}
        {kind === 'note' && <span>Added to today’s jot with the time</span>}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="mr-auto hidden text-xs text-muted-foreground md:inline">
          {kind === 'task' ? '↵ to save' : '⌘↵ to save'}
        </span>
        <button
          type="button"
          onClick={onDone}
          className="h-9 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!text.trim() || busy}
          onClick={() => void submit()}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
