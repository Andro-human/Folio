import { describe, expect, it } from 'vitest';
import { bucketOf, describeDays, describeRule, nextOccurrence, occursOn, parseClock, parseDays, snippet, timeRange, type ScheduleItem } from './assist.ts';

const tz = 'Asia/Kolkata';
// Fri 6 Nov 2026, 17:00 IST
const now = new Date('2026-11-06T11:30:00Z');

describe('bucketOf', () => {
  it('groups like the Today screen, in IST', () => {
    expect(bucketOf(null, false, now, tz)).toBe('no_date');
    expect(bucketOf('2026-11-06T10:00:00Z', true, now, tz)).toBe('overdue'); // 15:30 today, passed
    expect(bucketOf('2026-11-06T13:00:00Z', true, now, tz)).toBe('today'); // 18:30 today
    expect(bucketOf('2026-11-05T18:30:00Z', false, now, tz)).toBe('today'); // date-only today
    expect(bucketOf('2026-11-04T18:30:00Z', false, now, tz)).toBe('overdue'); // date-only yesterday
    expect(bucketOf('2026-11-06T19:00:00Z', true, now, tz)).toBe('upcoming'); // 00:30 tomorrow IST
  });
});

describe('repeats', () => {
  it('moves to the next occurrence after now', () => {
    const next = nextOccurrence('FREQ=WEEKLY;BYDAY=MO', '2026-11-02T02:30:00Z', now); // Mon 8:00 IST
    expect(next?.toISOString()).toBe('2026-11-09T02:30:00.000Z');
  });
  it('reads rules aloud', () => {
    expect(describeRule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')).toBe('weekdays');
    expect(describeRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=FR')).toBe('every 2 weeks on Fri');
    expect(describeRule('FREQ=DAILY')).toBe('daily');
  });
});

describe('schedule input', () => {
  it('reads times people write', () => {
    expect(parseClock('7')).toBe(420);
    expect(parseClock('7am')).toBe(420);
    expect(parseClock('7:30 pm')).toBe(1170);
    expect(parseClock('12am')).toBe(0);
    expect(parseClock('12 p.m.')).toBe(720);
    expect(parseClock('24:00')).toBe(1440);
    expect(parseClock('13pm')).toBeNull();
    expect(parseClock('noon-ish')).toBeNull();
  });
  it('reads days', () => {
    expect(parseDays(['Mon', 'wednesday', 'fri'])).toEqual([1, 3, 5]);
    expect(parseDays(['weekdays'])).toEqual([1, 2, 3, 4, 5]);
    expect(parseDays(['daily'])).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(parseDays(['someday'])).toBeNull();
  });
  it('describes times and days', () => {
    expect(timeRange('07:00:00', '08:00:00')).toBe('7:00 – 8:00 am');
    expect(timeRange('11:00:00', '13:00:00')).toBe('11:00 am – 1:00 pm');
    expect(timeRange('23:00:00', '24:00:00')).toBe('11:00 pm – 12:00 am');
    expect(describeDays([5, 1, 3])).toBe('every Mon, Wed, Fri');
  });
});

describe('occursOn', () => {
  const gym: ScheduleItem = {
    id: 'g', title: 'Gym', start_time: '07:00', end_time: '08:00', on_date: null, days: [1, 4],
    starts_on: '2026-11-02', ends_on: null, skip_dates: ['2026-11-05'], alert_minutes: 10,
  };
  it('matches app behaviour for repeats, skips and start dates', () => {
    expect(occursOn(gym, '2026-11-02')).toBe(true); // Mon
    expect(occursOn(gym, '2026-11-05')).toBe(false); // Thu, skipped
    expect(occursOn(gym, '2026-11-12')).toBe(true); // Thu
    expect(occursOn(gym, '2026-10-29')).toBe(false); // before it starts
    expect(occursOn({ ...gym, days: null, on_date: '2026-11-06' }, '2026-11-06')).toBe(true);
  });
});

describe('snippet', () => {
  it('centres on the first matching word', () => {
    const text = 'a '.repeat(200) + 'the passport is in the drawer ' + 'b '.repeat(200);
    const s = snippet(text, 'passport');
    expect(s.startsWith('…')).toBe(true);
    expect(s).toContain('the passport is in the drawer');
    expect(snippet('short note', 'zzz')).toBe('short note');
  });
});
