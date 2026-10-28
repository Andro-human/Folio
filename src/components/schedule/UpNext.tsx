import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SectionTitle } from '@/components/layout/PageHeader';
import { clockLabel, occurrencesOn, useEvents } from '@/data/events';
import { useNow } from '@/hooks/useNow';
import { todayKey } from '@/lib/dates';

/** Today's schedule items that haven't ended yet — the next three. Hidden when there are none. */
export function UpNext() {
  const { data: events } = useEvents();
  const now = useNow();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const key = todayKey();
  const items = useMemo(
    () => occurrencesOn(events ?? [], key).filter((o) => o.end > minutes).slice(0, 3),
    [events, key, minutes],
  );
  if (!items.length) return null;

  return (
    <section className="mb-9">
      <SectionTitle right={<Link to="/schedule" className="text-[13px] text-primary">Schedule</Link>}>Up next</SectionTitle>
      {items.map((o) => (
        <Link key={o.event.id} to="/schedule" className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0">
          <span className="h-4 w-[3px] shrink-0 rounded-full bg-primary" />
          <span className="min-w-0 flex-1 truncate text-[15px]">{o.event.title}</span>
          {o.start <= minutes ? (
            <span className="text-[13px] font-medium text-primary">Now · until {clockLabel(o.end, true)}</span>
          ) : (
            <span className="text-[13px] tabular text-muted-foreground">
              {clockLabel(o.start)} – {clockLabel(o.end, true)}
            </span>
          )}
        </Link>
      ))}
    </section>
  );
}
