import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import type { Transaction } from '@tiptap/pm/state';
import { Globe, Link2, PlaySquare } from 'lucide-react';
import { insertLinkBlock } from './extensions/media';
import type { PastedLink } from './extensions/linkPaste';
import { canEmbed } from '@/lib/embeds';

/** After a link is pasted on its own line: keep it as a link, or make it a preview card or an embed. */
export function PasteLinkMenu({
  editor,
  pasted,
  container,
  onClose,
}: {
  editor: Editor;
  pasted: PastedLink | null;
  container: RefObject<HTMLDivElement>;
  onClose: () => void;
}) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!pasted || !container.current) return setAt(null);
    const end = Math.min(pasted.pos + 1 + pasted.url.length, editor.state.doc.content.size);
    const caret = editor.view.coordsAtPos(end);
    const box = container.current.getBoundingClientRect();
    setAt({ top: caret.bottom - box.top + 6, left: Math.max(0, Math.min(caret.left - box.left - 24, box.width - 250)) });
  }, [pasted, editor, container]);

  // Any further typing, or moving off the line, means the link stays a link.
  useEffect(() => {
    if (!pasted) return;
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      const line = editor.state.doc.nodeAt(pasted.pos);
      const head = editor.state.selection.head;
      if (transaction.docChanged || !line || head < pasted.pos || head > pasted.pos + line.nodeSize) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    editor.on('transaction', onTransaction);
    window.addEventListener('keydown', onKey);
    return () => {
      editor.off('transaction', onTransaction);
      window.removeEventListener('keydown', onKey);
    };
  }, [pasted, editor, onClose]);

  if (!pasted || !at) return null;

  const convert = (kind: 'bookmark' | 'embed') => {
    const line = editor.state.doc.nodeAt(pasted.pos);
    onClose();
    if (line?.type.name !== 'paragraph' || line.textContent !== pasted.url) return;
    insertLinkBlock(editor, kind, pasted.url, { from: pasted.pos, to: pasted.pos + line.nodeSize });
  };

  const item = 'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 hover:bg-muted';
  return (
    <div
      role="menu"
      onMouseDown={(e) => e.preventDefault()}
      style={at}
      className="absolute z-40 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 text-[13px] shadow-md"
    >
      <button type="button" role="menuitem" onClick={onClose} className={item}>
        <Link2 className="h-3.5 w-3.5" /> Link
      </button>
      <button type="button" role="menuitem" onClick={() => convert('bookmark')} className={item}>
        <Globe className="h-3.5 w-3.5" /> Preview
      </button>
      {canEmbed(pasted.url) && (
        <button type="button" role="menuitem" onClick={() => convert('embed')} className={item}>
          <PlaySquare className="h-3.5 w-3.5" /> Embed
        </button>
      )}
    </div>
  );
}
