import type { JSONContent } from '@tiptap/react';

const BLOCKS = new Set([
  'paragraph',
  'heading',
  'taskLine',
  'listItem',
  'taskItem',
  'blockquote',
  'codeBlock',
  'subPage',
]);

/** Plain text for search/MCP: one line per block, mentions as their label. */
export function docToText(doc: JSONContent | null | undefined): string {
  if (!doc) return '';
  const lines: string[] = [];
  let current = '';

  const walk = (node: JSONContent) => {
    if (node.type === 'text') {
      current += node.text ?? '';
      return;
    }
    if (node.type === 'mention') {
      current += `@${node.attrs?.label ?? ''}`;
      return;
    }
    if (node.type === 'hardBreak') {
      current += '\n';
      return;
    }
    node.content?.forEach(walk);
    if (node.type && BLOCKS.has(node.type)) {
      if (current.trim()) lines.push(current.trim());
      current = '';
    }
  };

  walk(doc);
  if (current.trim()) lines.push(current.trim());
  return lines.join('\n');
}

/** Every page this doc points at: @mentions, task chips and sub-page blocks. */
export function docLinkIds(doc: JSONContent | null | undefined): string[] {
  const ids = new Set<string>();
  const walk = (node: JSONContent) => {
    if (node.type === 'mention' && node.attrs?.id) ids.add(node.attrs.id);
    if (node.type === 'taskLine' && node.attrs?.taskId) ids.add(node.attrs.taskId);
    if (node.type === 'subPage' && node.attrs?.pageId) ids.add(node.attrs.pageId);
    node.content?.forEach(walk);
  };
  if (doc) walk(doc);
  return [...ids];
}

export function docTaskIds(doc: JSONContent | null | undefined): string[] {
  const ids: string[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === 'taskLine' && node.attrs?.taskId) ids.push(node.attrs.taskId);
    node.content?.forEach(walk);
  };
  if (doc) walk(doc);
  return ids;
}

/** Task chips show the task's current title, which may have been renamed elsewhere. */
export function reconcileTaskTitles(
  doc: JSONContent,
  titleOf: (taskId: string) => string | undefined,
): JSONContent {
  const map = (node: JSONContent): JSONContent => {
    if (node.type === 'taskLine' && node.attrs?.taskId) {
      const title = titleOf(node.attrs.taskId);
      const currentText = (node.content ?? []).map((c) => c.text ?? '').join('');
      if (title !== undefined && title !== currentText) {
        return { ...node, content: title ? [{ type: 'text', text: title }] : [] };
      }
      return node;
    }
    return node.content ? { ...node, content: node.content.map(map) } : node;
  };
  return map(doc);
}

export const EMPTY_PAGE_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
export const EMPTY_JOT_DOC: JSONContent = { type: 'doc', content: [{ type: 'taskLine' }] };
