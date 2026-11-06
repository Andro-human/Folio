// Pure helpers behind the MCP tools: task grouping, repeats, schedule times and days.

import * as rrulePkg from 'rrule';

// rrule ships CommonJS: Deno exposes it as a default export, Vite (tests) as named exports.
const { RRule } = ((rrulePkg as unknown as { default?: typeof rrulePkg }).default ?? rrulePkg) as typeof rrulePkg;
import { zoned } from './time.ts';

export type Bucket = 'overdue' | 'today' | 'upcoming' | 'no_date';

/** The same grouping as the app's Today and Tasks screens, in the user's zone. */
export function bucketOf(deadline: string | null, hasTime: boolean, now: Date, tz: string): Bucket {
  if (!deadline) return 'no_date';
  const at = new Date(deadline);
  const today = zoned(now, tz).date;
  const day = zoned(at, tz).date;
  if (hasTime ? at < now : day < today) return 'overdue';
  return day === today ? 'today' : 'upcoming';
}

/** Next occurrence strictly after now, anchored on the current deadline — as the app computes it. */
export function nextOccurrence(rrule: string, deadline: string | null, now = new Date()): Date | null {
  const anchor = deadline ? new Date(deadline) : now;
  const rule = new RRule({ ...RRule.parseString(rrule), dtstart: anchor });
  return rule.after(anchor > now ? anchor : now, false);
}

const DAY_CODES: Record<string, string> = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };

export function describeRule(rrule: string): string {
  const p = Object.fromEntries(rrule.split(';').map((kv) => kv.split('=')));
  const every = Number(p.INTERVAL ?? 1);
  const days = p.BYDAY?.split(',') ?? [];
  if (p.FREQ === 'DAILY') return every > 1 ? `every ${every} days` : 'daily';
  if (p.FREQ === 'WEEKLY') {
    if (days.join() === 'MO,TU,WE,TH,FR') return 'weekdays';
    const on = days.length ? ` on ${days.map((d: string) => DAY_CODES[d] ?? d).join(', ')}` : '';
    return (every > 1 ? `every ${every} weeks` : 'weekly') + on;
  }
  if (p.FREQ === 'MONTHLY') return every > 1 ? `every ${every} months` : 'monthly';
  if (p.FREQ === 'YEARLY') return 'yearly';
  return rrule;
}

// ---------------------------------------------------------------- schedule

/** "7", "7am", "7:30 pm", "19:30", "24:00" → minutes from midnight. */
export function parseClock(s: string): number | null {
  const m = /^\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*$/i.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const period = m[3]?.toLowerCase().replace(/\./g, '');
  if (period) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (period === 'pm' ? 12 : 0);
  }
  if (min > 59 || h > 24 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const WEEKDAY_NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** ["mon","wed"], ["weekdays"], ["daily"], ["Tuesday"] → ISO weekdays (1 = Monday). Null if any word is unknown. */
export function parseDays(words: string[]): number[] | null {
  const out = new Set<number>();
  for (const raw of words) {
    const w = raw.trim().toLowerCase();
    if (w === 'daily' || w === 'every day' || w === 'everyday') [1, 2, 3, 4, 5, 6, 7].forEach((d) => out.add(d));
    else if (w === 'weekdays') [1, 2, 3, 4, 5].forEach((d) => out.add(d));
    else if (w === 'weekends' || w === 'weekend') [6, 7].forEach((d) => out.add(d));
    else {
      const i = WEEKDAY_NAMES.findIndex((n) => w.startsWith(n));
      if (i === -1) return null;
      out.add(i + 1);
    }
  }
  return [...out].sort();
}

export interface ScheduleItem {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  on_date: string | null;
  days: number[] | null;
  starts_on: string;
  ends_on: string | null;
  skip_dates: string[];
  alert_minutes: number | null;
}

const isoWeekday = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
};

/** Mirrors the app's occursOn. */
export function occursOn(e: ScheduleItem, date: string): boolean {
  if (e.on_date) return e.on_date === date;
  if (date < e.starts_on || (e.ends_on && date > e.ends_on) || e.skip_dates.includes(date)) return false;
  return !!e.days?.includes(isoWeekday(date));
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** "7:00 – 8:00 am" */
export function timeRange(start: string, end: string): string {
  const fmt = (min: number, period: boolean) => {
    const h = Math.floor(min / 60) % 24;
    const s = `${h % 12 || 12}:${String(min % 60).padStart(2, '0')}`;
    return period ? `${s} ${h < 12 ? 'am' : 'pm'}` : s;
  };
  const a = toMinutes(start);
  const b = toMinutes(end);
  const samePeriod = Math.floor(a / 720) === Math.floor((b % 1440) / 720) && b !== 1440;
  return `${fmt(a, !samePeriod)} – ${fmt(b, true)}`;
}

export function describeDays(days: number[] | null): string {
  if (!days?.length) return '';
  const j = [...days].sort().join();
  if (j === '1,2,3,4,5,6,7') return 'every day';
  if (j === '1,2,3,4,5') return 'weekdays';
  if (j === '6,7') return 'weekends';
  return `every ${[...days].sort().map((d) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d - 1]).join(', ')}`;
}

// ---------------------------------------------------------------- search

/** ~160 characters of a page's text around the first word of the query that appears in it. */
export function snippet(text: string, query: string, width = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const lower = flat.toLowerCase();
  const hit = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .map((w) => lower.indexOf(w))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0];
  if (hit === undefined) return flat.slice(0, width) + (flat.length > width ? '…' : '');
  const start = Math.max(0, hit - Math.floor(width / 3));
  return (start > 0 ? '…' : '') + flat.slice(start, start + width) + (start + width < flat.length ? '…' : '');
}
