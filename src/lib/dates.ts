import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  isSameYear,
  parseISO,
  startOfDay,
} from 'date-fns';

// v1 treats the browser's timezone as the user's timezone (profiles.timezone
// defaults to the same, Asia/Kolkata). Date-only deadlines are local midnight.

export function toDateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function fromDateKey(key: string): Date {
  return parseISO(key);
}

export function jotTitle(key: string): string {
  return format(fromDateKey(key), 'EEE, d MMM yyyy');
}

export function relativeDayLabel(d: Date, now = new Date()): string {
  const diff = differenceInCalendarDays(d, now);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return format(d, 'EEEE');
  return isSameYear(d, now) ? format(d, 'd MMM') : format(d, 'd MMM yyyy');
}

export function formatDeadline(deadline: string, hasTime: boolean, now = new Date()): string {
  const d = new Date(deadline);
  const day = relativeDayLabel(d, now);
  return hasTime ? `${day}, ${format(d, 'h:mm a').toLowerCase()}` : day;
}

export function isOverdue(deadline: string | null, hasTime: boolean, now = new Date()): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  return hasTime ? d < now : d < startOfDay(now);
}

export function isDueBy(deadline: string | null, day: Date): boolean {
  if (!deadline) return false;
  return new Date(deadline) <= endOfDay(day);
}

export function dateOnlyToISO(d: Date): string {
  return startOfDay(d).toISOString();
}

export { addDays, startOfDay, endOfDay, format, differenceInCalendarDays };
