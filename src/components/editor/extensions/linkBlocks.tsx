import { useEffect, useState } from 'react';
import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { ArrowUpRight, Globe } from 'lucide-react';
import { fetchLinkPreview } from '@/data/links';
import { domainOf, isShortMapsLink, toEmbed } from '@/lib/embeds';
import { cn } from '@/lib/utils';

const attr = (name: string) => ({ default: null, parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`), renderHTML: (a: Record<string, unknown>) => ({ [`data-${name}`]: a[name] }) });

/** A link shown as a card: title, description, site, thumbnail. The preview is saved with the page. */
export const Bookmark = Node.create({
  name: 'bookmark',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: attr('id'),
      url: attr('url'),
      title: attr('title'),
      description: attr('description'),
      image: attr('image'),
      site: attr('site'),
      icon: attr('icon'),
      loading: { default: false, renderHTML: () => ({}) },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="bookmark"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'bookmark' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkView);
  },
});

function BookmarkView({ node, selected }: ReactNodeViewProps) {
  const a = node.attrs as Record<string, string | null> & { loading: boolean };
  const url = a.url ?? '';
  const domain = domainOf(url);
  const [imageFailed, setImageFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);

  return (
    <NodeViewWrapper className="my-3" contentEditable={false}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/60',
          selected ? 'border-ring ring-1 ring-ring' : 'border-border',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col justify-center px-3.5 py-3">
          {a.loading ? (
            <>
              <span className="h-4 w-3/5 animate-pulse rounded bg-muted" />
              <span className="mt-2 h-3 w-4/5 animate-pulse rounded bg-muted" />
            </>
          ) : (
            <>
              <span className="line-clamp-1 text-[15px] font-medium leading-snug">{a.title || domain}</span>
              {a.description && <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{a.description}</span>}
            </>
          )}
          <span className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {a.icon && !iconFailed ? (
              <img src={a.icon} alt="" referrerPolicy="no-referrer" onError={() => setIconFailed(true)} className="h-3.5 w-3.5 shrink-0 rounded-sm" />
            ) : (
              <Globe className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{domain}</span>
          </span>
        </span>
        {a.image && !imageFailed && (
          <span className="relative w-28 shrink-0 border-l border-border sm:w-44">
            <img
              src={a.image}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </span>
        )}
      </a>
    </NodeViewWrapper>
  );
}

/** A video, map, player or document framed inline. Only hosts known to `toEmbed` are ever framed. */
export const Embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return { id: attr('id'), url: attr('url') };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'embed' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedView);
  },
});

function EmbedView({ node, selected, updateAttributes }: ReactNodeViewProps) {
  const url = (node.attrs.url as string | null) ?? '';
  const embed = toEmbed(url);
  const [failed, setFailed] = useState(false);

  // Short Maps links (maps.app.goo.gl) only become embeddable once the server follows them.
  useEffect(() => {
    if (embed || !isShortMapsLink(url)) return;
    let live = true;
    fetchLinkPreview(url)
      .then((p) => {
        if (!live) return;
        if (toEmbed(p.finalUrl)) updateAttributes({ url: p.finalUrl });
        else setFailed(true);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [embed, url, updateAttributes]);

  return (
    <NodeViewWrapper className="my-3" contentEditable={false}>
      <div className={cn('overflow-hidden rounded-lg border bg-card', selected ? 'border-ring ring-1 ring-ring' : 'border-border')}>
        {embed ? (
          <iframe
            src={embed.src}
            title={embed.provider}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            className="block w-full border-0 bg-muted"
            style={embed.aspect ? { aspectRatio: String(embed.aspect) } : { height: embed.height }}
          />
        ) : (
          <div className={cn('grid h-28 place-items-center text-sm text-muted-foreground', !failed && 'animate-pulse')}>
            {failed || !isShortMapsLink(url) ? "This link can't be embedded" : 'Loading map…'}
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{embed?.provider ?? 'Link'}</span>
          <span className="min-w-0 flex-1 truncate">{domainOf(url)}</span>
          <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-primary">
            Open <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
