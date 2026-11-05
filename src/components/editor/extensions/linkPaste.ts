import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { soleUrl } from '@/lib/embeds';

export interface PastedLink {
  url: string;
  /** Start of the line the link was pasted on. */
  pos: number;
}

/**
 * A link pasted on its own empty line goes in as a plain link, and `onPaste` lets the editor
 * offer to turn the line into a preview card or an embed.
 */
export const LinkPaste = Extension.create<{ onPaste: (link: PastedLink) => void }>({
  name: 'linkPaste',
  // Ahead of the Link extension's own paste handling.
  priority: 1000,

  addOptions() {
    return { onPaste: () => {} };
  },

  addProseMirrorPlugins() {
    const { onPaste } = this.options;
    return [
      new Plugin({
        key: new PluginKey('linkPaste'),
        props: {
          handlePaste: (view, event) => {
            if (event.clipboardData?.files.length) return false;
            const url = soleUrl(event.clipboardData?.getData('text/plain') ?? '');
            const { $from, empty } = view.state.selection;
            if (!url || !empty || $from.depth !== 1 || $from.parent.type.name !== 'paragraph' || $from.parent.content.size > 0) {
              return false;
            }
            const link = view.state.schema.marks.link.create({ href: url });
            view.dispatch(view.state.tr.insert($from.pos, view.state.schema.text(url, [link])));
            onPaste({ url, pos: $from.before(1) });
            return true;
          },
        },
      }),
    ];
  },
});
