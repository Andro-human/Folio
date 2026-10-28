import { describe, expect, it } from 'vitest';
import { basicParse, deadlineUtc, modelParse, readModelFields } from './parse.ts';
import { clock, describeDeadline, describeLead, jotTitle, localToUtc, zoned } from './time.ts';

const tz = 'Asia/Kolkata';
const lists = [
  { id: 'p', name: 'Personal' },
  { id: 'w', name: 'Work' },
  { id: 'e', name: 'Errands' },
];
// Mon 19 Oct 2026, 23:30 IST — already Tuesday in some zones, still Monday in UTC (18:00).
const now = new Date('2026-10-19T18:00:00Z');

describe('time helpers', () => {
  it('reads the wall clock in the user zone', () => {
    expect(zoned(now, tz)).toMatchObject({ date: '2026-10-19', time: '23:30', weekday: 'Mon', offset: 330 });
  });

  it('converts IST wall time to UTC', () => {
    expect(localToUtc('2026-10-20', '17:00', tz)).toBe('2026-10-20T11:30:00.000Z');
    expect(localToUtc('2026-10-23', null, tz)).toBe('2026-10-22T18:30:00.000Z');
  });

  it('formats jot titles and spoken deadlines', () => {
    expect(jotTitle('2026-10-20')).toBe('Tue, 20 Oct 2026');
    expect(describeDeadline('2026-10-20', '17:00', '2026-10-19')).toBe('tomorrow, 5:00 pm');
    expect(describeDeadline('2026-10-23', null, '2026-10-19')).toBe('Fri');
  });

  it('formats schedule alerts', () => {
    expect(clock('07:05:00')).toBe('7:05 am');
    expect(clock('12:00:00')).toBe('12:00 pm');
    expect(clock('00:30:00')).toBe('12:30 am');
    expect(clock('24:00:00')).toBe('12:00 am');
    expect(describeLead(0)).toBe('Now');
    expect(describeLead(10)).toBe('In 10 min');
    expect(describeLead(60)).toBe('In 1 hour');
    expect(describeLead(90)).toBe('In 1 hour 30 min');
  });
});

describe('basicParse (server, zone-aware)', () => {
  it('resolves "tomorrow 5pm" in IST, not UTC', () => {
    const c = basicParse('call the bank tomorrow 5pm #work !high', 'task', lists, now, tz);
    expect(c).toMatchObject({ title: 'call the bank', listId: 'w', priority: 'high', date: '2026-10-20', time: '17:00' });
    expect(deadlineUtc(c, tz)).toBe('2026-10-20T11:30:00.000Z');
  });

  it('keeps date-only deadlines as IST midnight', () => {
    const c = basicParse('pay rent friday', 'task', lists, now, tz);
    expect(c).toMatchObject({ title: 'pay rent', date: '2026-10-23' });
    expect(c.time).toBeUndefined();
    expect(deadlineUtc(c, tz)).toBe('2026-10-22T18:30:00.000Z');
  });

  it('turns "every monday" into a weekly repeat starting on the next monday', () => {
    const c = basicParse('water plants every monday', 'task', lists, now, tz);
    expect(c).toMatchObject({ title: 'water plants', rrule: 'FREQ=WEEKLY;BYDAY=MO', date: '2026-10-19' });
  });

  it('drops spoken lead-ins and reads a bare "at 5" as 5 pm', () => {
    expect(basicParse('remind me to call mom tomorrow at 5', 'task', lists, now, tz)).toMatchObject({
      title: 'call mom',
      date: '2026-10-20',
      time: '17:00',
    });
    expect(basicParse('gym tomorrow 6am', 'task', lists, now, tz).time).toBe('06:00');
  });

  it('passes notes through untouched', () => {
    expect(basicParse('idea: tomorrow is a good day', 'note', lists, now, tz)).toMatchObject({
      kind: 'note',
      title: 'idea: tomorrow is a good day',
    });
  });
});

describe('Apple Intelligence fields from the Shortcut', () => {
  it('reads JSON text, even fenced', () => {
    expect(readModelFields('```json\n{"title":"buy milk","when":null}\n```')).toEqual({ title: 'buy milk', when: null });
    expect(readModelFields({ title: 'x' })).toEqual({ title: 'x' });
  });

  it('rejects output it cannot use', () => {
    expect(readModelFields('Sure! Here is your task.')).toBeNull();
    expect(readModelFields('{"title":""}')).toBeNull();
    expect(readModelFields(undefined)).toBeNull();
  });

  it('resolves the spoken "when" in the user zone and matches the list loosely', () => {
    const f = { title: 'call the bank', when: 'tomorrow at 5', list: 'work', priority: 'high', repeat: 'null' };
    const c = modelParse(f, lists, now, tz);
    expect(c).toMatchObject({ title: 'call the bank', listId: 'w', priority: 'high', date: '2026-10-20', time: '17:00', parser: 'model' });
    expect(c.rrule).toBeUndefined();
  });

  it('starts a bare repeat today and ignores junk values', () => {
    const c = modelParse({ title: 'stretch', repeat: 'daily', priority: 'urgent', list: 'nope' }, lists, now, tz);
    expect(c).toMatchObject({ date: '2026-10-19', rrule: 'FREQ=DAILY' });
    expect(c.priority).toBeUndefined();
    expect(c.listId).toBeUndefined();
  });
});
