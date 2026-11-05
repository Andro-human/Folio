import type { Editor } from '@tiptap/core';
import { toast } from 'sonner';
import { isImageFile, uploadImage } from '@/data/images';
import { fetchLinkPreview } from '@/data/links';

// Media blocks carry an `id` so async work (uploads, previews) can find them again
// after the doc has moved on.

function findById(editor: Editor, type: string, id: string): number | null {
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type.name === type && node.attrs.id === id) found = pos;
    return found === null;
  });
  return found;
}

export function updateNodeById(editor: Editor, type: string, id: string, attrs: Record<string, unknown>) {
  if (editor.isDestroyed) return;
  const pos = findById(editor, type, id);
  if (pos === null) return;
  const node = editor.state.doc.nodeAt(pos)!;
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }).setMeta('addToHistory', false));
}

function removeNodeById(editor: Editor, type: string, id: string) {
  if (editor.isDestroyed) return;
  const pos = findById(editor, type, id);
  if (pos === null) return;
  const node = editor.state.doc.nodeAt(pos)!;
  editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize).setMeta('addToHistory', false));
}

/** Local previews of images still uploading, by block id. */
export const pendingImages = new Map<string, string>();

export function insertImageFiles(editor: Editor, files: File[], at?: number) {
  const images = files.filter(isImageFile);
  if (!images.length) return false;
  const items = images.map((file) => ({ file, id: crypto.randomUUID() }));
  for (const { file, id } of items) pendingImages.set(id, URL.createObjectURL(file));
  const content = items.map(({ id }) => ({ type: 'image', attrs: { id } }));
  const chain = editor.chain().focus();
  (at === undefined ? chain.insertContent(content) : chain.insertContentAt(at, content)).run();

  for (const { file, id } of items) {
    uploadImage(file)
      .then(({ path, width, height }) => updateNodeById(editor, 'image', id, { path, w: width, h: height }))
      .catch(() => {
        toast.error("Couldn't upload the image");
        removeNodeById(editor, 'image', id);
      })
      // Keep the local copy a little longer, so the image doesn't blink while its signed link loads.
      .finally(() =>
        setTimeout(() => {
          URL.revokeObjectURL(pendingImages.get(id) ?? '');
          pendingImages.delete(id);
        }, 60_000),
      );
  }
  return true;
}

/** Puts a preview card or an embed at the cursor, or in place of `range` (the pasted link's line). */
export function insertLinkBlock(editor: Editor, kind: 'bookmark' | 'embed', url: string, range?: { from: number; to: number }) {
  const id = crypto.randomUUID();
  const node = kind === 'bookmark' ? { type: 'bookmark', attrs: { id, url, loading: true } } : { type: 'embed', attrs: { id, url } };
  const chain = editor.chain().focus();
  (range ? chain.insertContentAt(range, node) : chain.insertContent(node)).run();
  if (kind !== 'bookmark') return;
  fetchLinkPreview(url)
    .then((p) =>
      updateNodeById(editor, 'bookmark', id, {
        title: p.title,
        description: p.description,
        image: p.image,
        site: p.site,
        icon: p.icon,
        loading: false,
      }),
    )
    .catch(() => updateNodeById(editor, 'bookmark', id, { loading: false }));
}
