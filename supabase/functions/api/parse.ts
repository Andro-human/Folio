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
  parser: 'model' | 'basic';
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

// Spoken lead-ins that aren't part of the task.
const FILLER_RE = /^\s*(?:(?:please|hey)\s+)?(?:remind me to|remember to|i need to|i have to|i should|don'?t forget to|add (?:a )?(?:task|todo|to-do)(?: to)?|new task|todo|to-do)\b[\s:,-]*/i;

// Dictation spells small numbers out ("at five"), which chrono doesn't read as a time.
const HOURS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const HOUR_WORD = `(${Object.keys(HOURS).join('|')})`;
const MINUTES: Record<string, string> = { fifteen: '15', thirty: '30', 'forty five': '45', 'forty-five': '45' };

export function spokenTimes(text: string): string {
  return text
    .replace(new RegExp(`\\bhalf past ${HOUR_WORD}\\b`, 'gi'), (_, h: string) => `${HOURS[h.toLowerCase()]}:30`)
    .replace(new RegExp(`\\bquarter past ${HOUR_WORD}\\b`, 'gi'), (_, h: string) => `${HOURS[h.toLowerCase()]}:15`)
    .replace(
      new RegExp(`\\b(at|by|around|before|after|until) ${HOUR_WORD}(?:\\s+(o'?clock|fifteen|thirty|forty[\\s-]five))?\\b`, 'gi'),
      (_, lead: string, h: string, m?: string) => {
        const min = m && !/o'?clock/i.test(m) ? MINUTES[m.toLowerCase().replace(/\s+/, ' ')] : null;
        return `${lead} ${HOURS[h.toLowerCase()]}${min ? `:${min}` : ''}`;
      },
    )
    .replace(new RegExp(`\\b${HOUR_WORD}\\s+(a\\.?m\\.?|p\\.?m\\.?)`, 'gi'), (_, h: string, ap: string) => `${HOURS[h.toLowerCase()]} ${ap}`);
}

const SPOKEN_PRIORITY: [RegExp, Priority][] = [
  [/[\s,]+(?:(?:high|top)[\s-]+priority|priority[\s-]+(?:high|one)|important|urgent)[\s,]*$/i, 'high'],
  [/[\s,]+(?:(?:medium|normal)[\s-]+priority|priority[\s-]+(?:medium|two))[\s,]*$/i, 'medium'],
  [/[\s,]+(?:low[\s-]+priority|priority[\s-]+(?:low|three)|not urgent)[\s,]*$/i, 'low'],
];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PREP = String.raw`(?:in|into|on|to|under|for)\s+(?:the\s+|my\s+)?`;

/**
 * Words that file a task into a list: "work list", "in the work category", "put it in work", "#work". Saying the
 * list's name isn't enough ("leave for work" is a personal task), so a bare name never counts.
 */
function filingPattern(name: string): RegExp {
  const n = esc(name).replace(/\s+/g, String.raw`\s+`);
  return new RegExp(
    String.raw`(^|[\s,])(?:(?:put|file|add|move|save)\s+(?:it\s+|this\s+|that\s+)?${PREP}${n}(?:\s+(?:list|category))?` +
      String.raw`|(?:${PREP})?${n}\s+(?:list|category)|(?:list|category)\s+${n}|#${n})(?=$|[\s,.!?])`,
    'iu',
  );
}

/** The list the speaker explicitly filed the task into, and the words that did it. */
export function filedList(text: string, lists: ListRef[]): { list: ListRef; index: number; length: number } | undefined {
  for (const list of [...lists].sort((a, b) => b.name.length - a.name.length)) {
    const m = text.match(filingPattern(list.name));
    if (m) return { list, index: m.index! + m[1].length, length: m[0].length - m[1].length };
  }
  return undefined;
}

/** Peels a spoken priority off the end and an explicit filing from anywhere: "call the bank work list important". */
function spokenTags(text: string, out: Capture, lists: ListRef[]): string {
  if (!out.listId) {
    const filed = filedList(text, lists);
    if (filed) {
      out.listId = filed.list.id;
      text = text.slice(0, filed.index) + ' ' + text.slice(filed.index + filed.length);
    }
  }
  for (let changed = true; changed && !out.priority; ) {
    changed = false;
    for (const [re, p] of SPOKEN_PRIORITY) {
      if (re.test(text)) {
        text = text.replace(re, ' ');
        out.priority = p;
        changed = true;
        break;
      }
    }
  }
  return text;
}

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
  let text = ` ${spokenTimes(input.replace(FILLER_RE, '').replace(/[.?!]+\s*$/, ''))} `;

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
    if (s.isCertain('hour')) {
      // "at 5" without am/pm means the afternoon when said aloud; nobody schedules 5 am that way.
      let hour = s.get('hour')!;
      if (!s.isCertain('meridiem') && hour >= 1 && hour <= 7) hour += 12;
      out.time = `${pad(hour)}:${pad(s.get('minute') ?? 0)}`;
    }
    text = text.slice(0, found.index) + ' ' + text.slice(found.index + found.text.length);
    text = text.replace(/\s(by|on|at|due)\s*$/i, ' ');
  }

  text = spokenTags(text, out, lists);

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

  out.title = squash(text).replace(/[\s,;:–-]+$/, '') || squash(input);
  return out;
}

/** What the Shortcut's Apple Intelligence step returns: the phrase split up, with dates left as spoken words. */
export interface ModelFields {
  title?: unknown;
  when?: unknown;
  list?: unknown;
  priority?: unknown;
  repeat?: unknown;
}

const REPEATS = ['daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'yearly'];
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim().slice(0, max) : undefined);

/** Accepts an object or the model's raw text (possibly wrapped in ```json fences). null when unusable. */
export function readModelFields(raw: unknown): ModelFields | null {
  let v = raw;
  if (typeof v === 'string') {
    const json = v.slice(v.indexOf('{'), v.lastIndexOf('}') + 1);
    try {
      v = JSON.parse(json);
    } catch {
      return null;
    }
  }
  return v && typeof v === 'object' && !Array.isArray(v) && str((v as ModelFields).title, 500) ? (v as ModelFields) : null;
}

/** The model splits the phrase; dates are still resolved here, in the user's zone, so it never does date maths. */
export function modelParse(f: ModelFields, lists: ListRef[], now: Date, tz: string): Capture {
  const out: Capture = { kind: 'task', title: squash(str(f.title, 500)!), parser: 'model' };
  out.listId = matchList(str(f.list, 60), lists);
  const priority = str(f.priority, 10)?.toLowerCase();
  if (priority === 'high' || priority === 'medium' || priority === 'low') out.priority = priority;

  const when = str(f.when, 120);
  if (when) {
    const w = basicParse(when, 'task', lists, now, tz);
    Object.assign(out, { date: w.date, time: w.time, rrule: w.rrule });
  }
  const repeat = str(f.repeat, 20)?.toLowerCase();
  if (!out.rrule && repeat && REPEATS.includes(repeat)) {
    out.date ??= zoned(now, tz).date;
    out.rrule = toRRule(repeat, out.date);
  }
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
