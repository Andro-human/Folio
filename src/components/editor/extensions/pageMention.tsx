import Mention from '@tiptap/extension-mention';
import { PluginKey } from '@tiptap/pm/state';
import { FilePlus2, FileText } from 'lucide-react';
import { suggestionRender, type MenuItem } from '../SuggestionMenu';
import { createPage, searchPagesByTitle } from '@/data/pages';

interface MentionItem extends MenuItem {
  id: string;
  isNew?: boolean;
}

export const PageMention = Mention.extend({
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-id'),
        renderHTML: (attrs) => ({ 'data-id': attrs.id }),
      },
      label: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-label'),
        renderHTML: (attrs) => ({ 'data-label': attrs.label }),
      },
    };
  },
}).configure({
  HTMLAttributes: { class: 'page-mention' },
  renderText: ({ node }) => `@${node.attrs.label ?? ''}`,
  renderHTML: ({ options, node }) => ['span', options.HTMLAttributes, `@${node.attrs.label ?? ''}`],
  suggestion: {
    char: '@',
    pluginKey: new PluginKey('pageMention'),
    allowSpaces: true,
    items: async ({ query }): Promise<MentionItem[]> => {
      const pages = await searchPagesByTitle(query, 6);
      const items: MentionItem[] = pages.map((p) => ({
        key: p.id,
        id: p.id,
        label: p.title || 'Untitled',
        icon: <FileText className="h-4 w-4" />,
      }));
      const q = query.trim();
      if (q && !pages.some((p) => p.title.toLowerCase() === q.toLowerCase())) {
        items.push({
          key: '__new',
          id: '__new',
          label: `New page “${q}”`,
          isNew: true,
          icon: <FilePlus2 className="h-4 w-4" />,
        });
      }
      return items;
    },
    command: ({ editor, range, props }) => {
      const item = props as unknown as MentionItem;
      const insert = (id: string, label: string, at: number) =>
        editor
          .chain()
          .focus()
          .insertContentAt(at, [
            { type: 'mention', attrs: { id, label } },
            { type: 'text', text: ' ' },
          ])
          .run();

      if (item.isNew) {
        const title = item.label.replace(/^New page “|”$/g, '');
        editor.chain().focus().deleteRange(range).run();
        createPage({ title }).then((id) => insert(id, title, range.from));
        return;
      }
      editor.chain().focus().deleteRange(range).run();
      insert(item.id, item.label, range.from);
    },
    render: suggestionRender<MentionItem>('Type to find a page'),
  },
});
