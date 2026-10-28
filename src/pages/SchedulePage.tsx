import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { WeekStrip } from '@/components/schedule/WeekStrip';
import { DayTimeline } from '@/components/schedule/DayTimeline';
import { EventSheet, type EventSheetState } from '@/components/schedule/EventSheet';
import { fromMinutes, occursOn, occurrencesOn, useEvents } from '@/data/events';
import { useOpenTasks } from '@/data/tasks';
import { useNow } from '@/hooks/useNow';
import { fromDateKey, relativeDayLabel, toDateKey, todayKey } from '@/lib/dates';

export default function SchedulePage() {
  const [params, setParams] = useSearchParams();
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(params.get('d') ?? '') ? params.get('d')! : todayKey();
  const select = (key: string) => setParams(key === todayKey() ? {} : { d: key }, { replace: true });

  const { data: events = [] } = useEvents();
  const { data: tasks = [] } = useOpenTasks();
  const now = useNow();
  const [sheet, setSheet] = useState<EventSheetState>(null);

  // Open tasks with a time, by day.
  const timedTasks = useMemo(() => {
    const byDay = new Map<string, typeof tasks>();
    for (const t of tasks) {
      if (t.status !== 'todo' || !t.deadline || !t.deadline_has_time) continue;
      const key = toDateKey(new Date(t.deadline));
      byDay.set(key, [...(byDay.get(key) ?? []), t]);
    }
    return byDay;
  }, [tasks]);

  const occurrences = useMemo(() => occurrencesOn(events, selected), [events, selected]);
  const isToday = selected === todayKey();
  const day = fromDateKey(selected);
  const near = relativeDayLabel(day);
  const subtitle = ['Today', 'Tomorrow', 'Yesterday'].includes(near) ? `${near} · ${format(day, 'EEEE, d MMMM')}` : format(day, 'EEEE, d MMMM');

  const newAt = (start: number) =>
    setSheet({
      mode: 'new',
      draft: {
        title: '',
        start: fromMinutes(start),
        end: fromMinutes(Math.min(start + 60, 1440)),
        date: selected,
        days: [],
        alertMinutes: 10,
      },
    });
  // The header button starts at the next full hour today, or 9 am on other days.
  const newFromButton = () => newAt(isToday ? Math.min((now.getHours() + 1) * 60, 23 * 60) : 9 * 60);

  const addButton = (
    <button
      type="button"
      aria-label="New schedule item"
      onClick={newFromButton}
      className="grid h-9 w-9 place-items-center rounded-md text-primary hover:bg-muted"
    >
      <Plus className="h-5 w-5" />
    </button>
  );

  return (
    <>
      <PageHeader className="md:hidden" actions={addButton} />
      <PageBody>
        <div className="mb-5 mt-1 flex items-end md:mt-12">
          <div className="flex-1">
            <h1 className="text-[2.125rem] font-bold leading-tight md:text-[2.5rem]">Schedule</h1>
            <p className="text-[15px] text-muted-foreground">{subtitle}</p>
          </div>
          <div className="hidden md:block">{addButton}</div>
        </div>

        <WeekStrip
          selected={selected}
          onSelect={select}
          busy={(key) => events.some((e) => occursOn(e, key)) || timedTasks.has(key)}
        />

        {occurrences.length === 0 && !timedTasks.has(selected) && (
          <p className="text-sm text-muted-foreground">Nothing scheduled. Tap an hour to add something.</p>
        )}
        <DayTimeline
          occurrences={occurrences}
          tasks={timedTasks.get(selected) ?? []}
          now={isToday ? now.getHours() * 60 + now.getMinutes() : null}
          onNew={newAt}
          onOpen={(occ) => setSheet({ mode: 'edit', occ })}
        />
      </PageBody>
      <EventSheet state={sheet} onClose={() => setSheet(null)} />
    </>
  );
}
