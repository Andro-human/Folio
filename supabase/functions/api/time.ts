const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface Zoned {
  /** yyyy-MM-dd in the zone */
  date: string;
  /** HH:mm in the zone */
  time: string;
  weekday: string;
  /** minutes east of UTC at that instant */
  offset: number;
}

export function zoned(at: Date, tz: string): Zoned {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: parts.weekday,
    offset: Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000),
  };
}

/** Wall-clock date (and optional HH:mm) in `tz` → UTC ISO string. */
export function localToUtc(date: string, time: string | null, tz: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time ?? '00:00').split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall - zoned(new Date(wall), tz).offset * 60000;
  guess = wall - zoned(new Date(guess), tz).offset * 60000;
  return new Date(guess).toISOString();
}

export function jotTitle(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[dow]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function weekdayCode(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "Today", "Tomorrow", "Fri" or "24 Oct", plus ", 5:00 pm" when timed — for Siri's reply. */
export function describeDeadline(date: string, time: string | null, today: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const diff = Math.round((Date.UTC(y, m - 1, d) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  const day =
    diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : diff > 1 && diff < 7 ? DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] : `${d} ${MONTHS[m - 1]}`;
  return time ? `${day}, ${clock(time)}` : day;
}

/** "HH:mm" or Postgres "HH:mm:ss" (including "24:00:00") → "5:00 pm". */
export function clock(time: string): string {
  const [hh, mm] = time.split(':').map(Number);
  const h = hh % 24;
  return `${h % 12 || 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** How far off a schedule item is when its alert fires: "Now", "In 10 min", "In 1 hour". */
export function describeLead(minutes: number): string {
  if (minutes === 0) return 'Now';
  if (minutes < 60) return `In ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `In ${h} hour${h === 1 ? '' : 's'}${m ? ` ${m} min` : ''}`;
}
