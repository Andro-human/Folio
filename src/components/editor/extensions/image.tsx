import { useRef, useState } from 'react';
import { mergeAttributes, Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { ImageOff, Loader2 } from 'lucide-react';
import { useImageUrl } from '@/data/images';
import { insertImageFiles, pendingImages } from './media';
import { cn } from '@/lib/utils';

const MIN_WIDTH = 15; // percent of the page

/** An image stored in the private bucket. `width` is a percentage of the page (null = full width). */
export const PageImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      id: { default: null },
      path: { default: null },
      width: { default: null },
      w: { default: null },
      h: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="image"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes, { 'data-type': 'image' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const files = (data: DataTransfer | null) => [...(data?.files ?? [])];
    return [
      new Plugin({
        key: new PluginKey('imageDrop'),
        props: {
          handlePaste: (_view, event) => insertImageFiles(editor, files(event.clipboardData)),
          handleDrop: (view, event, _slice, moved) => {
            if (moved) return false;
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
            return insertImageFiles(editor, files(event.dataTransfer), at);
          },
        },
      }),
    ];
  },
});

function ImageView({ node, selected, editor, updateAttributes }: ReactNodeViewProps) {
  const { id, path, width, w, h } = node.attrs as { id: string | null; path: string | null; width: number | null; w: number | null; h: number | null };
  const local = id ? pendingImages.get(id) : undefined;
  const link = useImageUrl(path);
  const [broken, setBroken] = useState(false);
  const retried = useRef(false);
  const src = broken ? undefined : (link.data ?? local);
  const [dragging, setDragging] = useState<number | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const percent = dragging ?? width ?? 100;
  const ratio = w && h ? `${w} / ${h}` : undefined;

  // Images stay centred, so each side moves half the change: drag by twice the pointer distance.
  const startResize = (side: 1 | -1) => (e: React.PointerEvent<HTMLSpanElement>) => {
    const full = frame.current?.parentElement?.getBoundingClientRect().width;
    if (!full) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const start = percent;
    let latest = start;
    const move = (ev: PointerEvent) => {
      latest = Math.min(100, Math.max(MIN_WIDTH, start + ((side * (ev.clientX - startX) * 2) / full) * 100));
      setDragging(latest);
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      setDragging(null);
      const rounded = Math.round(latest);
      if (rounded !== Math.round(start)) updateAttributes({ width: rounded >= 99 ? null : rounded });
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  const handle = (side: 1 | -1) => (
    <span
      role="separator"
      aria-label={side === 1 ? 'Resize from right' : 'Resize from left'}
      onPointerDown={startResize(side)}
      className={cn(
        'absolute top-1/2 grid h-14 w-6 -translate-y-1/2 cursor-ew-resize touch-none place-items-center transition-opacity',
        side === 1 ? 'right-0' : 'left-0',
        selected || dragging !== null ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}
    >
      <span className="h-10 w-1.5 rounded-full border border-background/80 bg-foreground/60 shadow" />
    </span>
  );

  return (
    <NodeViewWrapper className="my-3" contentEditable={false}>
      <div ref={frame} className="group relative mx-auto" style={{ width: `${percent}%` }}>
        {src ? (
          <img
            src={src}
            alt=""
            draggable={false}
            onError={() => {
              // An expired link gets one fresh try; after that, show the placeholder.
              if (retried.current || !path) return setBroken(true);
              retried.current = true;
              void link.refetch();
            }}
            style={{ aspectRatio: ratio }}
            className={cn('block w-full rounded-md bg-muted', (selected || dragging !== null) && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
          />
        ) : (
          <div
            style={{ aspectRatio: ratio ?? '16 / 9' }}
            className={cn(
              'grid w-full place-items-center rounded-md bg-muted text-sm text-muted-foreground',
              link.isLoading && !broken && 'animate-pulse',
              selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
            )}
          >
            {(!link.isLoading || broken) && (
              <span className="flex items-center gap-2">
                <ImageOff className="h-4 w-4" /> {path ? "Couldn't load this image" : "This image didn't finish uploading"}
              </span>
            )}
          </div>
        )}
        {!path && local && (
          <span className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-background/85 px-2 py-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Uploading
          </span>
        )}
        {editor.isEditable && src && (
          <>
            {handle(-1)}
            {handle(1)}
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}
