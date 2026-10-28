import { useQuery } from '@tanstack/react-query';
import { keys, queryClient, supabase, unwrap } from './client';
import type { EventRow } from './types';
import { fromDateKey } from '@/lib/dates';

// Schedule items: wall-clock times on a date (one-off) or on weekdays (repeating).
// The database works out when each alert is due; the client only lays out occurrences.

export const WEEKDAYS = [
  { iso: 1, letter: 'M', short: 'Mon' },
  { iso: 2, letter: 'T', short: 'Tue' },
  { iso: 3, letter: 'W', short: 'Wed' },
  { iso: 4, letter: 'T', short: 'Thu' },
  { iso: 5, letter: 'F', short: 'Fri' },
  { iso: 6, letter: 'S', short: 'Sat' },
  { iso: 7, letter: 'S', short: 'Sun' },
];

export const ALERTS: { value: number | null; label: string }[] = [
  { value: null, label: 'No alert' },
  { value: 0, label: 'At start' },
  { value: 5, label: '5 min before' },
  { value: 10, label: '10 min before' },
  { value: 15, label: '15 min before' },
  { value: 30, label: '30 min before' },
  { value: 60, label: '1 hour before' },
];

export interface Occurrence {
  event: EventRow;
  /** yyyy-MM-dd */
  date: string;
  /** Minutes from midnight. */
  start: number;
  end: number;
}

/** "07:30" or "07:30:00" → 450; "24:00:00" → 1440. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 450 → "07:30", for <input type="time">; midnight at the end of a day is "00:00". */
export function fromMinutes(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** 450 → "7:30", 780 → "1:00"; add the am/pm with `withPeriod`. */
export function clockLabel(min: number, withPeriod = false): string {
  const h = Math.floor(min / 60) % 24;
  const label = `${h % 12 || 12}:${String(min % 60).padStart(2, '0')}`;
  return withPeriod ? `${label} ${h < 12 ? 'am' : 'pm'}` : label;
}

export const isoWeekday = (key: string) => ((fromDateKey(key).getDay() + 6) % 7) + 1;

export function occursOn(e: EventRow, key: string): boolean {
  if (e.on_date) return e.on_date === key;
  if (key < e.starts_on || (e.ends_on && key > e.ends_on) || e.skip_dates.includes(key)) return false;
  return !!e.days?.includes(isoWeekday(key));
}

export function occurrencesOn(events: EventRow[], key: string): Occurrence[] {
  return events
    .filter((e) => occursOn(e, key))
    .map((e) => ({ event: e, date: key, start: toMinutes(e.start_time), end: toMinutes(e.end_time) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

export function describeDays(days: number[] | null): string {
  if (!days?.length) return '';
  const sorted = [...days].sort();
  if (sorted.length === 7) return 'Every day';
  if (sorted.join() === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join() === '6,7') return 'Weekends';
  return `Every ${sorted.map((d) => WEEKDAYS[d - 1].short).join(', ')}`;
}

export function useEvents() {
  return useQuery({
    queryKey: keys.events,
    queryFn: async (): Promise<EventRow[]> => unwrap(await supabase.from('events').select('*').order('start_time')) ?? [],
  });
}

export interface EventDraft {
  title: string;
  /** HH:mm */
  start: string;
  end: string;
  /** The one-off date, or the first day a repeating item can occur. */
  date: string;
  /** ISO weekdays; empty means it happens once, on `date`. */
  days: number[];
  alertMinutes: number | null;
}

function toRow(d: EventDraft) {
  const repeats = d.days.length > 0;
  return {
    title: d.title.trim(),
    start_time: d.start,
    // An item that runs until midnight ends at 24:00, so it still ends after it starts.
    end_time: d.end === '00:00' ? '24:00' : d.end,
    on_date: repeats ? null : d.date,
    days: repeats ? [...d.days].sort() : null,
    starts_on: d.date,
    alert_minutes: d.alertMinutes,
  };
}

export function draftFrom(e: EventRow): EventDraft {
  return {
    title: e.title,
    start: fromMinutes(toMinutes(e.start_time)),
    end: fromMinutes(toMinutes(e.end_time)),
    date: e.on_date ?? e.starts_on,
    days: e.days ?? [],
    alertMinutes: e.alert_minutes,
  };
}

function refreshEvents() {
  return queryClient.invalidateQueries({ queryKey: keys.events });
}

function patchCached(update: (events: EventRow[]) => EventRow[]) {
  queryClient.setQueryData<EventRow[]>(keys.events, (old) => (old ? update(old) : old));
}

export async function createEvent(d: EventDraft) {
  unwrap(await supabase.from('events').insert(toRow(d)));
  await refreshEvents();
}

export async function updateEvent(id: string, d: EventDraft) {
  unwrap(await supabase.from('events').update(toRow(d)).eq('id', id));
  await refreshEvents();
}

export async function deleteEvent(id: string) {
  patchCached((all) => all.filter((e) => e.id !== id));
  unwrap(await supabase.from('events').delete().eq('id', id));
  await refreshEvents();
}

/** Drops one day of a repeating item ("no gym this Wednesday"). */
export async function skipOccurrence(e: EventRow, date: string) {
  const skip_dates = [...new Set([...e.skip_dates, date])].sort();
  patchCached((all) => all.map((x) => (x.id === e.id ? { ...x, skip_dates } : x)));
  unwrap(await supabase.from('events').update({ skip_dates }).eq('id', e.id));
  await refreshEvents();
}
