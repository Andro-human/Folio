import { RRule } from 'rrule';

export const REPEAT_PRESETS: { label: string; rrule: string }[] = [
  { label: 'Every day', rrule: 'FREQ=DAILY' },
  { label: 'Every weekday', rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Every week', rrule: 'FREQ=WEEKLY' },
  { label: 'Every 2 weeks', rrule: 'FREQ=WEEKLY;INTERVAL=2' },
  { label: 'Every month', rrule: 'FREQ=MONTHLY' },
  { label: 'Every year', rrule: 'FREQ=YEARLY' },
];

function ruleFrom(rrule: string, dtstart: Date): RRule {
  const opts = RRule.parseString(rrule);
  return new RRule({ ...opts, dtstart });
}

/** Next occurrence strictly after now, anchored on the current deadline. */
export function nextOccurrence(rrule: string, deadline: string | null, now = new Date()): Date | null {
  const anchor = deadline ? new Date(deadline) : now;
  const rule = ruleFrom(rrule, anchor);
  const after = anchor > now ? anchor : now;
  return rule.after(after, false);
}

/** First occurrence on or after `from` — used when a repeat is set without a deadline. */
export function firstOccurrence(rrule: string, from: Date): Date | null {
  return ruleFrom(rrule, from).after(from, true);
}

export function describeRRule(rrule: string): string {
  const preset = REPEAT_PRESETS.find((p) => p.rrule === rrule);
  if (preset) return preset.label;
  try {
    const text = RRule.fromString(rrule).toText();
    return text.charAt(0).toUpperCase() + text.slice(1);
  } catch {
    return 'Repeats';
  }
}
