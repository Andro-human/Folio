import * as chrono from 'chrono-node';
import { startOfDay } from 'date-fns';
import { firstOccurrence } from './recurrence';

export type Priority = 'high' | 'medium' | 'low';

export interface ParsedTask {
  title: string;
  listId?: string;
  priority?: Priority;
  deadline?: string;
  deadlineHasTime: boolean;
  rrule?: string;
}

interface ListRef {
  id: string;
  name: string;
}

const PRIORITY_TOKENS: Record<string, Priority> = {
  '!high': 'high',
  '!h': 'high',
  '!1': 'high',
  '!medium': 'medium',
  '!med': 'medium',
  '!m': 'medium',
  '!2': 'medium',
  '!low': 'low',
  '!l': 'low',
  '!3': 'low',
};

const DAY_CODES: Record<string, string> = {
  monday: 'MO',
  tuesday: 'TU',
  wednesday: 'WE',
  thursday: 'TH',
  friday: 'FR',
  saturday: 'SA',
  sunday: 'SU',
};

const REPEAT_RE =
  /\bevery\s+(day|weekday|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

function repeatToRRule(word: string): string {
  const w = word.toLowerCase();
  if (w === 'day') return 'FREQ=DAILY';
  if (w === 'weekday') return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
  if (w === 'week') return 'FREQ=WEEKLY';
  if (w === 'month') return 'FREQ=MONTHLY';
  if (w === 'year') return 'FREQ=YEARLY';
  return `FREQ=WEEKLY;BYDAY=${DAY_CODES[w]}`;
}

const squash = (s: string) => s.replace(/\s{2,}/g, ' ').trim();

/**
 * "call bank tomorrow 5pm #work !high" → title "call bank", list Work,
 * priority high, deadline tomorrow 17:00. Unmatched #tags stay in the title.
 */
export function parseQuickTask(input: string, lists: ListRef[], now = new Date()): ParsedTask {
  let text = ` ${input} `;
  const result: ParsedTask = { title: '', deadlineHasTime: false };

  text = text.replace(/(^|\s)(![a-z0-9]+)(?=\s)/gi, (whole, lead: string, tok: string) => {
    const p = PRIORITY_TOKENS[tok.toLowerCase()];
    if (!p) return whole;
    result.priority = p;
    return lead;
  });

  text = text.replace(/(^|\s)#([\p{L}\p{N}_-]+)(?=\s)/gu, (whole, lead: string, name: string) => {
    const lower = name.toLowerCase();
    const match =
      lists.find((l) => l.name.toLowerCase() === lower) ??
      lists.find((l) => l.name.toLowerCase().startsWith(lower));
    if (!match) return whole;
    result.listId = match.id;
    return lead;
  });

  const repeat = text.match(REPEAT_RE);
  if (repeat) {
    result.rrule = repeatToRRule(repeat[1]);
    text = text.replace(repeat[0], ' ');
  }

  const parsed = chrono.parse(text, now, { forwardDate: true })[0];
  if (parsed) {
    const date = parsed.start.date();
    const hasTime = parsed.start.isCertain('hour');
    result.deadlineHasTime = hasTime;
    result.deadline = (hasTime ? date : startOfDay(date)).toISOString();
    text = text.slice(0, parsed.index) + ' ' + text.slice(parsed.index + parsed.text.length);
    text = text.replace(/\s(by|on|at|due)\s*$/i, ' ');
  }

  if (result.rrule && !result.deadline) {
    const first = firstOccurrence(result.rrule, startOfDay(now));
    if (first) result.deadline = first.toISOString();
  }

  result.title = squash(text) || squash(input);
  return result;
}
