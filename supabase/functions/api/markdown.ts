// Markdown ↔ the editor's stored JSON, for the MCP tools. Assistants read and write
// markdown; pages are stored as TipTap JSON with a few Folio-specific blocks.

import { marked, type Token, type Tokens } from 'marked';

export interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: PMMark[];
}
interface PMMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface ReadContext {
  /** A task chip's current title and whether it's done. */
  task?: (id: string) => { title: string; done: boolean } | undefined;
  /** A sub-page's title. */
  page?: (id: string) => string | undefined;
}

// ---------------------------------------------------------------- doc → markdown

function inlineMd(nodes: PMNode[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === 'hardBreak') return '\n';
      if (n.type === 'mention') return `@${n.attrs?.label ?? ''}`;
      if (n.type !== 'text') return inlineMd(n.content);
      let s = n.text ?? '';
      const marks = n.marks ?? [];
      const has = (t: string) => marks.some((m) => m.type === t);
      if (has('code')) s = `\`${s}\``;
      if (has('bold')) s = `**${s}**`;
      if (has('italic')) s = `*${s}*`;
      if (has('strike')) s = `~~${s}~~`;
      const link = marks.find((m) => m.type === 'link');
      if (link) s = `[${s}](${link.attrs?.href ?? ''})`;
      return s;
    })
    .join('');
}

const indentLines = (s: string, pad: string) =>
  s
    .split('\n')
    .map((l, i) => (i === 0 || !l ? l : pad + l))
    .join('\n');

function listMd(node: PMNode, ctx: ReadContext): string {
  const ordered = node.type === 'orderedList';
  let n = Number(node.attrs?.start ?? 1);
  return (node.content ?? [])
    .map((item) => {
      const marker =
        item.type === 'taskItem' ? `- [${item.attrs?.checked ? 'x' : ' '}] ` : ordered ? `${n++}. ` : '- ';
      const body = (item.content ?? []).map((c) => blockMd(c, ctx)).join('\n');
      return marker + indentLines(body, ' '.repeat(marker.length));
    })
    .join('\n');
}

function blockMd(node: PMNode, ctx: ReadContext): string {
  switch (node.type) {
    case 'paragraph': {
      const indent = Number(node.attrs?.indent ?? 0);
      return '  '.repeat(indent) + inlineMd(node.content);
    }
    case 'heading':
      return `${'#'.repeat(Number(node.attrs?.level ?? 1))} ${inlineMd(node.content)}`;
    case 'taskLine': {
      const id = node.attrs?.taskId as string | null;
      const task = id ? ctx.task?.(id) : undefined;
      return `- [${task?.done ? 'x' : ' '}] ${task?.title ?? inlineMd(node.content)}`;
    }
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return listMd(node, ctx);
    case 'blockquote':
      return (node.content ?? [])
        .map((c) => blockMd(c, ctx))
        .join('\n\n')
        .split('\n')
        .map((l) => `> ${l}`.trimEnd())
        .join('\n');
    case 'codeBlock':
      return `\`\`\`${node.attrs?.language ?? ''}\n${inlineMd(node.content)}\n\`\`\``;
    case 'horizontalRule':
      return '---';
    case 'subPage': {
      const id = node.attrs?.pageId as string | null;
      return `[[${(id && ctx.page?.(id)) || 'Untitled page'}]]`;
    }
    case 'image':
      return '[image]';
    case 'bookmark':
      return `[${node.attrs?.title || node.attrs?.url}](${node.attrs?.url})`;
    case 'embed':
      return `[embed](${node.attrs?.url})`;
    default:
      return inlineMd(node.content);
  }
}

/** One line per task line (as in a jot), a blank line between everything else. */
export function docToMarkdown(doc: PMNode | null | undefined, ctx: ReadContext = {}): string {
  const blocks = (doc?.content ?? []).filter((b) => !(b.type === 'paragraph' || b.type === 'taskLine') || b.content?.length || b.attrs?.taskId);
  let out = '';
  blocks.forEach((b, i) => {
    const prev = blocks[i - 1];
    if (i > 0) out += prev.type === 'taskLine' && b.type === 'taskLine' ? '\n' : '\n\n';
    out += blockMd(b, ctx);
  });
  return out.trim();
}

// ---------------------------------------------------------------- markdown → blocks

function inline(tokens: Token[] = [], marks: PMMark[] = []): PMNode[] {
  const out: PMNode[] = [];
  const text = (t: string, m = marks) => {
    if (t) out.push(m.length ? { type: 'text', text: t, marks: m } : { type: 'text', text: t });
  };
  for (const t of tokens) {
    switch (t.type) {
      case 'strong':
        out.push(...inline((t as Tokens.Strong).tokens, [...marks, { type: 'bold' }]));
        break;
      case 'em':
        out.push(...inline((t as Tokens.Em).tokens, [...marks, { type: 'italic' }]));
        break;
      case 'del':
        out.push(...inline((t as Tokens.Del).tokens, [...marks, { type: 'strike' }]));
        break;
      case 'codespan':
        text(decode((t as Tokens.Codespan).text), [{ type: 'code' }]);
        break;
      case 'link': {
        const l = t as Tokens.Link;
        out.push(...inline(l.tokens, [...marks, { type: 'link', attrs: { href: l.href } }]));
        break;
      }
      case 'image': {
        const img = t as Tokens.Image;
        text(img.text || img.href, [...marks, { type: 'link', attrs: { href: img.href } }]);
        break;
      }
      case 'br':
        out.push({ type: 'hardBreak' });
        break;
      case 'text': {
        const tt = t as Tokens.Text;
        if (tt.tokens?.length) out.push(...inline(tt.tokens, marks));
        else text(decode(tt.text));
        break;
      }
      case 'escape':
        text((t as Tokens.Escape).text);
        break;
      case 'checkbox':
        // In loose lists the checkbox sits inside the item's paragraph; the item already carries it.
        break;
      default:
        text(decode((t as { raw: string }).raw));
    }
  }
  return out;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ENTITIES[e]);

const paragraph = (content: PMNode[]): PMNode => (content.length ? { type: 'paragraph', content } : { type: 'paragraph' });

function listItemContent(item: Tokens.ListItem): PMNode[] {
  const out: PMNode[] = [];
  for (const t of item.tokens) {
    if (t.type === 'text') out.push(paragraph(inline((t as Tokens.Text).tokens ?? [{ type: 'text', raw: t.raw, text: (t as Tokens.Text).text } as Token])));
    else if (t.type === 'checkbox') continue;
    else out.push(...blocks([t]));
  }
  if (out[0]?.type !== 'paragraph') out.unshift({ type: 'paragraph' });
  return out;
}

function blocks(tokens: Token[]): PMNode[] {
  const out: PMNode[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case 'space':
        break;
      case 'heading': {
        const h = t as Tokens.Heading;
        out.push({ type: 'heading', attrs: { level: Math.min(h.depth, 3) }, content: inline(h.tokens) });
        break;
      }
      case 'paragraph':
        out.push(paragraph(inline((t as Tokens.Paragraph).tokens)));
        break;
      case 'text':
        out.push(paragraph(inline((t as Tokens.Text).tokens ?? [t])));
        break;
      case 'list': {
        const l = t as Tokens.List;
        // "- a" and "- [ ] b" separated by a blank line are one list to markdown;
        // split it into runs so checklist items become a checklist.
        const runs: Tokens.ListItem[][] = [];
        for (const item of l.items) {
          const last = runs[runs.length - 1];
          if (last && !!last[0].task === !!item.task) last.push(item);
          else runs.push([item]);
        }
        for (const run of runs) {
          if (run[0].task) {
            out.push({
              type: 'taskList',
              content: run.map((i) => ({ type: 'taskItem', attrs: { checked: !!i.checked }, content: listItemContent(i) })),
            });
          } else {
            out.push({
              type: l.ordered ? 'orderedList' : 'bulletList',
              ...(l.ordered && run === runs[0] && l.start !== 1 && l.start !== '' ? { attrs: { start: Number(l.start) } } : {}),
              content: run.map((i) => ({ type: 'listItem', content: listItemContent(i) })),
            });
          }
        }
        break;
      }
      case 'blockquote': {
        const inner = blocks((t as Tokens.Blockquote).tokens);
        out.push({ type: 'blockquote', content: inner.length ? inner : [{ type: 'paragraph' }] });
        break;
      }
      case 'code': {
        const c = t as Tokens.Code;
        out.push({ type: 'codeBlock', attrs: { language: c.lang || null }, ...(c.text ? { content: [{ type: 'text', text: c.text }] } : {}) });
        break;
      }
      case 'hr':
        out.push({ type: 'horizontalRule' });
        break;
      case 'table': {
        // No table block in the editor: each row becomes a line.
        const tb = t as Tokens.Table;
        const row = (cells: Tokens.TableCell[]) => cells.map((c) => c.text).join(' | ');
        out.push(paragraph([{ type: 'text', text: row(tb.header), marks: [{ type: 'bold' }] }]));
        for (const r of tb.rows) out.push(paragraph([{ type: 'text', text: row(r) }]));
        break;
      }
      default: {
        const raw = (t as { raw?: string }).raw?.trim();
        if (raw) out.push(paragraph([{ type: 'text', text: raw }]));
      }
    }
  }
  return out;
}

export function markdownToBlocks(md: string): PMNode[] {
  return blocks(marked.lexer(md.replace(/\r\n?/g, '\n'), { gfm: true }));
}

// ---------------------------------------------------------------- plain text (search)

const TEXT_BLOCKS = new Set(['paragraph', 'heading', 'taskLine', 'listItem', 'taskItem', 'blockquote', 'codeBlock', 'subPage']);

/** One line per block, as the app's own docToText does, so search behaves the same. */
export function docToText(doc: PMNode | null | undefined): string {
  const lines: string[] = [];
  let current = '';
  const walk = (node: PMNode) => {
    if (node.type === 'text') return void (current += node.text ?? '');
    if (node.type === 'mention') return void (current += `@${node.attrs?.label ?? ''}`);
    if (node.type === 'hardBreak') return void (current += '\n');
    if (node.type === 'bookmark' || node.type === 'embed') {
      const line = [node.attrs?.title, node.attrs?.url].filter(Boolean).join(' ');
      if (line) lines.push(line as string);
      return;
    }
    node.content?.forEach(walk);
    if (TEXT_BLOCKS.has(node.type)) {
      if (current.trim()) lines.push(current.trim());
      current = '';
    }
  };
  if (doc) walk(doc);
  if (current.trim()) lines.push(current.trim());
  return lines.join('\n');
}
