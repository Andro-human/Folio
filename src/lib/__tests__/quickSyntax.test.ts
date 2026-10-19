import { describe, expect, it } from 'vitest';
import { parseQuickTask } from '../quickSyntax';

const lists = [
  { id: 'p', name: 'Personal' },
  { id: 'w', name: 'Work' },
  { id: 'e', name: 'Errands' },
];
// Monday 19 Oct 2026, 10:00 local
const now = new Date(2026, 9, 19, 10, 0);

describe('parseQuickTask', () => {
  it('pulls out date, time, list and priority', () => {
    const r = parseQuickTask('call the bank tomorrow 5pm #work !high', lists, now);
    expect(r.title).toBe('call the bank');
    expect(r.listId).toBe('w');
    expect(r.priority).toBe('high');
    expect(r.deadlineHasTime).toBe(true);
    const d = new Date(r.deadline!);
    expect([d.getDate(), d.getHours()]).toEqual([20, 17]);
  });

  it('keeps date-only deadlines at local midnight', () => {
    const r = parseQuickTask('pay rent friday', lists, now);
    expect(r.title).toBe('pay rent');
    expect(r.deadlineHasTime).toBe(false);
    const d = new Date(r.deadline!);
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([23, 0, 0]);
  });

  it('matches list names by prefix and leaves unknown tags in the title', () => {
    expect(parseQuickTask('milk #err', lists, now).listId).toBe('e');
    const r = parseQuickTask('read #rust book', lists, now);
    expect(r.listId).toBeUndefined();
    expect(r.title).toBe('read #rust book');
  });

  it('turns "every" phrases into a repeat with a first deadline', () => {
    const r = parseQuickTask('water plants every monday', lists, now);
    expect(r.title).toBe('water plants');
    expect(r.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
    expect(r.deadline).toBeDefined();
  });

  it('leaves plain text alone', () => {
    const r = parseQuickTask('think about the garden', lists, now);
    expect(r).toMatchObject({ title: 'think about the garden', deadlineHasTime: false });
    expect(r.deadline).toBeUndefined();
  });

  it('drops a dangling "by" left after the date', () => {
    expect(parseQuickTask('send invoice by friday', lists, now).title).toBe('send invoice');
  });
});
