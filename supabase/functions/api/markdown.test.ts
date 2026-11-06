import { describe, expect, it } from 'vitest';
import { docToMarkdown, docToText, markdownToBlocks, type PMNode } from './markdown.ts';
import { docToText as appDocToText } from '../../../src/lib/docText';

const t = (text: string, marks?: PMNode['marks']): PMNode => (marks ? { type: 'text', text, marks } : { type: 'text', text });
const doc = (...content: PMNode[]): PMNode => ({ type: 'doc', content });

describe('markdownToBlocks', () => {
  it('turns an assistant reply into editor blocks', () => {
    const blocks = markdownToBlocks(
      [
        '# Trip to Goa',
        '',
        'Book **flights** by *Friday*, see [the sheet](https://example.com/s) and `PNR-42`.',
        '',
        '- sunscreen',
        '- swimsuit',
        '  1. blue',
        '  2. black',
        '',
        '- [ ] passport',
        '- [x] tickets',
        '',
        '> pack light',
        '',
        '```js',
        'const x = 1;',
        '```',
        '',
        '---',
        '#### deep heading',
      ].join('\n'),
    );
    expect(blocks.map((b) => b.type)).toEqual([
      'heading',
      'paragraph',
      'bulletList',
      'taskList',
      'blockquote',
      'codeBlock',
      'horizontalRule',
      'heading',
    ]);
    expect(blocks[1].content).toEqual([
      t('Book '),
      t('flights', [{ type: 'bold' }]),
      t(' by '),
      t('Friday', [{ type: 'italic' }]),
      t(', see '),
      t('the sheet', [{ type: 'link', attrs: { href: 'https://example.com/s' } }]),
      t(' and '),
      t('PNR-42', [{ type: 'code' }]),
      t('.'),
    ]);
    const nested = blocks[2].content![1].content!;
    expect(nested.map((n) => n.type)).toEqual(['paragraph', 'orderedList']);
    expect(blocks[3].content!.map((i) => i.attrs?.checked)).toEqual([false, true]);
    expect(blocks[5]).toEqual({ type: 'codeBlock', attrs: { language: 'js' }, content: [t('const x = 1;')] });
    expect(blocks[7].attrs?.level).toBe(3);
  });

  it('splits a loose list into bullets and a checklist, without stray checkbox text', () => {
    const blocks = markdownToBlocks('- Baga\n- Palolem\n\n- [ ] book flights\n- [x] pick dates');
    expect(blocks.map((b) => b.type)).toEqual(['bulletList', 'taskList']);
    expect(blocks[1].content!.map((i) => [i.attrs?.checked, i.content![0].content])).toEqual([
      [false, [t('book flights')]],
      [true, [t('pick dates')]],
    ]);
  });

  it('keeps ampersands and quotes as typed', () => {
    expect(markdownToBlocks('Tom & Jerry "quoted"')[0].content).toEqual([t('Tom & Jerry "quoted"')]);
  });
});

describe('docToMarkdown', () => {
  it('renders a jot with live task status, notes and Folio blocks', () => {
    const jot = doc(
      { type: 'taskLine', attrs: { taskId: 'a' }, content: [t('old title')] },
      { type: 'taskLine', attrs: { taskId: 'b' }, content: [t('pay rent')] },
      { type: 'paragraph', attrs: { indent: 1 }, content: [t('due on the 5th')] },
      { type: 'taskLine', attrs: { taskId: null } },
      { type: 'subPage', attrs: { pageId: 'p1' } },
      { type: 'bookmark', attrs: { url: 'https://paulgraham.com/greatwork.html', title: 'How to Do Great Work' } },
      { type: 'image', attrs: { path: 'u/x.webp' } },
      { type: 'paragraph', content: [t('see '), { type: 'mention', attrs: { id: 'p2', label: 'Budget' } }] },
    );
    const md = docToMarkdown(jot, {
      task: (id) => ({ a: { title: 'call the bank', done: true }, b: { title: 'pay rent', done: false } })[id],
      page: (id) => (id === 'p1' ? 'Packing list' : undefined),
    });
    expect(md).toBe(
      [
        '- [x] call the bank',
        '- [ ] pay rent',
        '',
        '  due on the 5th',
        '',
        '[[Packing list]]',
        '',
        '[How to Do Great Work](https://paulgraham.com/greatwork.html)',
        '',
        '[image]',
        '',
        'see @Budget',
      ].join('\n'),
    );
  });

  it('round-trips the common markdown an assistant writes', () => {
    const src = '## Plan\n\n**Bold** and *italic* with `code`.\n\n- one\n- two\n\n1. first\n2. second\n\n- [ ] todo\n- [x] done\n\n> quote';
    expect(docToMarkdown(doc(...markdownToBlocks(src)))).toBe(src);
  });
});

describe('docToText', () => {
  it('matches the app, so search behaves the same for assistant-written pages', () => {
    const d = doc(...markdownToBlocks('# Title\n\nSome **bold** text\n\n- a\n- b\n\n> q'), {
      type: 'bookmark',
      attrs: { url: 'https://x.com', title: 'X' },
    });
    expect(docToText(d)).toBe(appDocToText(d as never));
    expect(docToText(d)).toBe('Title\nSome bold text\na\nb\nq\nX https://x.com');
  });
});
