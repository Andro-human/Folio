import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Bell, BellOff, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Chip, MenuRow, chipClass } from '@/components/tasks/fields';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  ALERTS,
  WEEKDAYS,
  createEvent,
  deleteEvent,
  draftFrom,
  fromMinutes,
  isoWeekday,
  skipOccurrence,
  toMinutes,
  updateEvent,
  type EventDraft,
  type Occurrence,
} from '@/data/events';
import { fromDateKey, relativeDayLabel, toDateKey, todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';

export type EventSheetState = { mode: 'new'; draft: EventDraft } | { mode: 'edit'; occ: Occurrence } | null;

/** Add or edit a schedule item. A Dialog on desktop, a bottom sheet on phones. */
export function EventSheet({ state, onClose }: { state: EventSheetState; onClose: () => void }) {
  const desktop = useMediaQuery('(min-width: 768px)');
  const open = state !== null;
  const title = state?.mode === 'edit' ? 'Edit schedule item' : 'New schedule item';
  const body = state && (
    <EventForm key={state.mode === 'edit' ? state.occ.event.id + state.occ.date : 'new'} state={state} onDone={onClose} />
  );
  const onOpenChange = (o: boolean) => !o && onClose();

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="top-[18%] translate-y-0 gap-0 p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="border-border bg-card">
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        {body}
      </DrawerContent>
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-16 shrink-0 text-[13px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

const timeInput = 'h-8 rounded-md border border-border bg-transparent px-2 text-[15px] tabular';

function EventForm({ state, onDone }: { state: NonNullable<EventSheetState>; onDone: () => void }) {
  const editing = state.mode === 'edit' ? state.occ : null;
  const [draft, setDraft] = useState<EventDraft>(() => (state.mode === 'new' ? state.draft : draftFrom(state.occ.event)));
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<EventDraft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    if (editing) return;
    const t = setTimeout(() => titleRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [editing]);

  const start = toMinutes(draft.start);
  const end = draft.end === '00:00' ? 1440 : toMinutes(draft.end);
  const endsBeforeStart = end <= start;
  const repeats = draft.days.length > 0;
  const canSave = !!draft.title.trim() && !endsBeforeStart && !busy;

  // Moving the start keeps the length, so 7–8 becomes 9–10 rather than 9–8.
  const setStart = (value: string) => {
    if (!value) return;
    const length = Math.max(end - start, 15);
    set({ start: value, end: fromMinutes(Math.min(toMinutes(value) + length, 1440)) });
  };

  const toggleDay = (iso: number) =>
    set({ days: draft.days.includes(iso) ? draft.days.filter((d) => d !== iso) : [...draft.days, iso] });

  const run = async (action: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await action();
      onDone();
    } catch {
      setBusy(false);
      toast.error(failure);
    }
  };

  const submit = () => {
    if (!canSave) return;
    void run(() => (editing ? updateEvent(editing.event.id, draft) : createEvent(draft)), "Couldn't save the schedule item");
  };

  return (
    <form
      className="px-4 pb-4 pt-3 md:px-5 md:pt-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        ref={titleRef}
        value={draft.title}
        onChange={(e) => set({ title: e.target.value })}
        placeholder="Title"
        enterKeyHint="done"
        className="w-full bg-transparent text-[19px] font-medium outline-none placeholder:text-muted-foreground/60"
      />

      <div className="mt-3 border-t border-border/60 pt-2">
        <Field label="Time">
          <input type="time" value={draft.start} onChange={(e) => setStart(e.target.value)} className={timeInput} />
          <span className="text-muted-foreground">–</span>
          <input
            type="time"
            value={draft.end}
            onChange={(e) => e.target.value && set({ end: e.target.value })}
            className={cn(timeInput, endsBeforeStart && 'border-destructive text-destructive')}
          />
        </Field>
        <Field label="Repeat">
          <div className="flex gap-1">
            {WEEKDAYS.map((d) => (
              <button
                key={d.iso}
                type="button"
                aria-label={d.short}
                aria-pressed={draft.days.includes(d.iso)}
                onClick={() => toggleDay(d.iso)}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-full border text-[13px] transition-colors',
                  draft.days.includes(d.iso)
                    ? 'border-primary bg-primary font-medium text-primary-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {d.letter}
              </button>
            ))}
          </div>
        </Field>
        <Field label={repeats ? 'From' : 'Date'}>
          <DateChip value={draft.date} onChange={(date) => set({ date })} />
          {!repeats && (
            <button
              type="button"
              onClick={() => set({ days: [isoWeekday(draft.date)] })}
              className="text-[13px] text-primary"
            >
              Every {format(fromDateKey(draft.date), 'EEEE')}
            </button>
          )}
        </Field>
        <Field label="Alert">
          <Chip
            icon={draft.alertMinutes === null ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
            label={ALERTS.find((a) => a.value === draft.alertMinutes)?.label ?? `${draft.alertMinutes} min before`}
            active={draft.alertMinutes !== null}
          >
            {(close) =>
              ALERTS.map((a) => (
                <MenuRow
                  key={String(a.value)}
                  selected={draft.alertMinutes === a.value}
                  onClick={() => {
                    set({ alertMinutes: a.value });
                    close();
                  }}
                >
                  {a.label}
                </MenuRow>
              ))
            }
          </Chip>
        </Field>
        {endsBeforeStart && <p className="pt-1 text-[13px] text-destructive">It ends before it starts.</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {editing && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                confirmDelete
                  ? void run(() => deleteEvent(editing.event.id), "Couldn't delete it")
                  : setConfirmDelete(true)
              }
              className="h-9 rounded-md px-2 text-sm text-destructive"
            >
              {confirmDelete ? (editing.event.days?.length ? 'Delete every day?' : 'Delete?') : 'Delete'}
            </button>
            {!!editing.event.days?.length && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => skipOccurrence(editing.event, editing.date), "Couldn't skip it")}
                className="h-9 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Skip {editing.date === todayKey() ? 'today' : format(fromDateKey(editing.date), 'EEE d MMM')}
              </button>
            )}
          </>
        )}
        <div className="flex-1" />
        <button type="button" onClick={onDone} className="h-9 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSave}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {editing ? 'Save' : 'Add'}
        </button>
      </div>
    </form>
  );
}

function DateChip({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const day = fromDateKey(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={chipClass(true)}>
          <CalendarDays className="h-3.5 w-3.5" />
          {relativeDayLabel(day)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={day}
          defaultMonth={day}
          onSelect={(d) => {
            if (!d) return;
            onChange(toDateKey(d));
            setOpen(false);
          }}
          weekStartsOn={1}
        />
      </PopoverContent>
    </Popover>
  );
}
