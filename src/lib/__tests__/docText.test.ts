import { describe, expect, it } from 'vitest';
import { docLinkIds, docTaskIds, docToText, reconcileTaskTitles } from '../docText';

const doc = {
  type: 'doc',
  content: [
    { type: 'taskLine', attrs: { taskId: 't1' }, content: [{ type: 'text', text: 'old title' }] },
    { type: 'paragraph', attrs: { indent: 1 }, content: [{ type: 'text', text: 'context ' }, { type: 'mention', attrs: { id: 'p1', label: 'Trip' } }] },
    { type: 'subPage', attrs: { pageId: 'p2' } },
    { type: 'taskLine', attrs: { taskId: null }, content: [{ type: 'text', text: 'pending' }] },
  ],
};

describe('doc helpers', () => {
  it('flattens to one line per block', () => {
    expect(docToText(doc)).toBe('old title\ncontext @Trip\npending');
  });

  it('collects every linked page', () => {
    expect(docLinkIds(doc).sort()).toEqual(['p1', 'p2', 't1']);
    expect(docTaskIds(doc)).toEqual(['t1']);
  });

  it('replaces chip text with the current task title', () => {
    const next = reconcileTaskTitles(doc, (id) => (id === 't1' ? 'new title' : undefined));
    expect(next.content![0].content).toEqual([{ type: 'text', text: 'new title' }]);
    expect(next.content![3]).toEqual(doc.content[3]);
  });
});
