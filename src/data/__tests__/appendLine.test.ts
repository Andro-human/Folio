import { describe, expect, it, vi } from 'vitest';

vi.mock('../client', () => ({ supabase: {}, queryClient: {}, keys: {}, unwrap: vi.fn(), unwrapOne: vi.fn() }));

const { withAppendedLine } = await import('../pages');

const chip = { type: 'taskLine', attrs: { taskId: 't1' }, content: [{ type: 'text', text: 'pay rent' }] };
const note = { type: 'paragraph', attrs: { indent: 0, captureId: 'c1' }, content: [{ type: 'text', text: '07:43 — idea' }] };

describe('withAppendedLine', () => {
  it('appends after trimming trailing blank lines', () => {
    const doc = { type: 'doc', content: [chip, { type: 'taskLine', attrs: { taskId: null } }] };
    expect(withAppendedLine(doc, note)!.content).toEqual([chip, note]);
  });

  it('starts a doc when the jot is empty', () => {
    expect(withAppendedLine(null, chip)).toEqual({ type: 'doc', content: [chip] });
  });

  it('skips a task chip that already landed', () => {
    expect(withAppendedLine({ type: 'doc', content: [chip, note] }, chip)).toBeNull();
  });

  it('skips a note line that already landed', () => {
    expect(withAppendedLine({ type: 'doc', content: [chip, note] }, note)).toBeNull();
  });

  it('keeps an emptied task chip that still has its task', () => {
    const keep = { type: 'taskLine', attrs: { taskId: 't9' } };
    expect(withAppendedLine({ type: 'doc', content: [keep] }, note)!.content).toEqual([keep, note]);
  });
});
