import * as chrono from 'chrono-node';
import { addDays, localToUtc, weekdayCode, zoned, type Zoned } from './time.ts';

export type Priority = 'high' | 'medium' | 'low';

export interface Capture {
  kind: 'task' | 'note';
  title: string;
  listId?: string;
  priority?: Priority;
  /** Local wall-clock date/time in the user's zone; converted to UTC when saved. */
  date?: string;
  time?: string;
  rrule?: string;
  parser: 'gemini' | 'basic';
}

export interface ListRef {
  id: string;
  name: string;
}

const PRIORITY: Record<string, Priority> = {
  '!high': 'high', '!h': 'high', '!1': 'high',
  '!medium': 'medium', '!med': 'medium', '!m': 'medium', '!2': 'medium',
  '!low': 'low', '!l': 'low', '!3': 'low',
};

const REPEAT_RE = /\bevery\s+(day|weekday|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

const pad = (n: number) => String(n).padStart(2, '0');
const squash = (s: string) => s.replace(/\s{2,}/g, ' ').trim();

export function matchList(name: string | null | undefined, lists: ListRef[]): string | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase().replace(/^#/, '');
  return (
    lists.find((l) => l.name.toLowerCase() === lower) ?? lists.find((l) => l.name.toLowerCase().startsWith(lower))
  )?.id;
}

/** Same quick syntax as the app ("call bank tomorrow 5pm #work !high"), resolved in the user's zone. */
export function basicParse(input: string, kind: 'task' | 'note', lists: ListRef[], now: Date, tz: string): Capture {
  if (kind === 'note') return { kind, title: squash(input), parser: 'basic' };

  const local: Zoned = zoned(now, tz);
  const out: Capture = { kind, title: '', parser: 'basic' };
  let text = ` ${input} `;

  text = text.replace(/(^|\s)(![a-z0-9]+)(?=\s)/gi, (whole, lead: string, tok: string) => {
    const p = PRIORITY[tok.toLowerCase()];
    if (!p) return whole;
    out.priority = p;
    return lead;
  });

  text = text.replace(/(^|\s)#([\p{L}\p{N}_-]+)(?=\s)/gu, (whole, lead: string, name: string) => {
    const id = matchList(name, lists);
    if (!id) return whole;
    out.listId = id;
    return lead;
  });

  const repeat = text.match(REPEAT_RE);
  let repeatWord: string | null = null;
  if (repeat) {
    repeatWord = repeat[1].toLowerCase();
    text = text.replace(repeat[0], ' ');
  }

  const found = chrono.parse(text, { instant: now, timezone: local.offset }, { forwardDate: true })[0];
  if (found) {
    const s = found.start;
    out.date = `${s.get('year')}-${pad(s.get('month')!)}-${pad(s.get('day')!)}`;
    if (s.isCertain('hour')) out.time = `${pad(s.get('hour')!)}:${pad(s.get('minute') ?? 0)}`;
    text = text.slice(0, found.index) + ' ' + text.slice(found.index + found.text.length);
    text = text.replace(/\s(by|on|at|due)\s*$/i, ' ');
  }

  if (repeatWord) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    if (days.includes(repeatWord)) {
      if (!out.date) {
        const todayIdx = days.findIndex((d) => d.startsWith(local.weekday.toLowerCase()));
        const target = days.indexOf(repeatWord);
        out.date = addDays(local.date, (target - todayIdx + 7) % 7);
      }
      out.rrule = `FREQ=WEEKLY;BYDAY=${weekdayCode(out.date)}`;
    } else {
      out.rrule = toRRule(repeatWord, out.date ?? local.date);
      out.date ??= local.date;
    }
  }

  out.title = squash(text) || squash(input);
  return out;
}

export function toRRule(repeat: string, date: string): string | undefined {
  switch (repeat) {
    case 'day':
    case 'daily':
      return 'FREQ=DAILY';
    case 'weekday':
    case 'weekdays':
      return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    case 'week':
    case 'weekly':
      return `FREQ=WEEKLY;BYDAY=${weekdayCode(date)}`;
    case 'biweekly':
      return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${weekdayCode(date)}`;
    case 'month':
    case 'monthly':
      return 'FREQ=MONTHLY';
    case 'year':
    case 'yearly':
      return 'FREQ=YEARLY';
    default:
      return undefined;
  }
}

export function deadlineUtc(c: Capture, tz: string): string | null {
  return c.date ? localToUtc(c.date, c.time ?? null, tz) : null;
}
