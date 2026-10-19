import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { FileText } from 'lucide-react';
import { useChips } from '../chipContext';
import { usePage } from '@/data/pages';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    subPage: {
      insertSubPage: (pageId: string) => ReturnType;
    };
  }
}

/** A block that opens a child page. */
export const SubPage = Node.create({
  name: 'subPage',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-page-id'),
        renderHTML: (attrs) => ({ 'data-page-id': attrs.pageId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="sub-page"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'sub-page' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SubPageView);
  },

  addCommands() {
    return {
      insertSubPage:
        (pageId) =>
        ({ commands }) =>
          commands.insertContent([{ type: 'subPage', attrs: { pageId } }, { type: 'paragraph' }]),
    };
  },
});

function SubPageView({ node, selected }: ReactNodeViewProps) {
  const { open } = useChips();
  const id = node.attrs.pageId as string | null;
  const { data: page } = usePage(id ?? undefined);
  const gone = page === null || !!page?.deleted_at;

  return (
    <NodeViewWrapper className="my-1" contentEditable={false}>
      <button
        type="button"
        onClick={() => id && !gone && open(id)}
        className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted ${
          selected ? 'border-ring' : 'border-border'
        } ${gone ? 'opacity-50' : ''}`}
      >
        <FileText className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate underline decoration-border underline-offset-4">
          {gone ? 'Deleted page' : page?.title || 'Untitled'}
        </span>
      </button>
    </NodeViewWrapper>
  );
}
