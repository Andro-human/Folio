import { Extension, type Editor, type Range } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import {
  AtSign,
  CheckCircle2,
  Code2,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  SeparatorHorizontal,
} from 'lucide-react';
import { suggestionRender, type MenuItem } from '../SuggestionMenu';

export interface SlashItem extends MenuItem {
  run: (editor: Editor, range: Range) => void;
  keywords?: string;
}

export interface SlashOptions {
  jotMode: boolean;
  onSubPage: (editor: Editor, range: Range) => void;
}

const ic = 'h-4 w-4';

function buildItems(opts: SlashOptions): SlashItem[] {
  const items: SlashItem[] = [
    {
      key: 'task',
      label: 'Task',
      keywords: 'todo task',
      icon: <CheckCircle2 className={ic} />,
      run: (e, r) => e.chain().focus().deleteRange(r).setNode('taskLine', { taskId: null }).run(),
    },
    {
      key: 'note',
      label: 'Note line',
      hint: '- ',
      keywords: 'text paragraph note',
      icon: <Minus className={ic} />,
      run: (e, r) => e.chain().focus().deleteRange(r).setNode('paragraph', { indent: 0 }).run(),
    },
    {
      key: 'h1',
      label: 'Heading 1',
      hint: '#',
      keywords: 'title h1',
      icon: <Heading1 className={ic} />,
      run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 1 }).run(),
    },
    {
      key: 'h2',
      label: 'Heading 2',
      hint: '##',
      keywords: 'subtitle h2',
      icon: <Heading2 className={ic} />,
      run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 2 }).run(),
    },
    {
      key: 'h3',
      label: 'Heading 3',
      hint: '###',
      keywords: 'h3',
      icon: <Heading3 className={ic} />,
      run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 3 }).run(),
    },
    {
      key: 'bullet',
      label: 'Bullet list',
      hint: '* ',
      keywords: 'unordered ul',
      icon: <List className={ic} />,
      run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
    },
    {
      key: 'numbered',
      label: 'Numbered list',
      hint: '1.',
      keywords: 'ordered ol',
      icon: <ListOrdered className={ic} />,
      run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
    },
    {
      key: 'checklist',
      label: 'Checklist',
      hint: '[] ',
      keywords: 'checkbox packing',
      icon: <ListChecks className={ic} />,
      run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
    },
    {
      key: 'quote',
      label: 'Quote',
      hint: '>',
      keywords: 'blockquote',
      icon: <Quote className={ic} />,
      run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
    },
    {
      key: 'code',
      label: 'Code block',
      hint: '```',
      keywords: 'snippet',
      icon: <Code2 className={ic} />,
      run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
    },
    {
      key: 'divider',
      label: 'Divider',
      hint: '---',
      keywords: 'hr rule line',
      icon: <SeparatorHorizontal className={ic} />,
      run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
    },
    {
      key: 'subpage',
      label: 'Sub-page',
      keywords: 'page child nested',
      icon: <FileText className={ic} />,
      run: (e, r) => opts.onSubPage(e, r),
    },
    {
      key: 'link',
      label: 'Link to page',
      hint: '@',
      keywords: 'mention reference',
      icon: <AtSign className={ic} />,
      run: (e, r) => e.chain().focus().deleteRange(r).insertContent('@').run(),
    },
  ];
  // Jots already default to tasks, so "Note line" leads there.
  if (opts.jotMode) {
    const note = items.splice(1, 1)[0];
    items.unshift(note);
  }
  return items;
}

export const SlashCommand = Extension.create<SlashOptions>({
  name: 'slashCommand',

  addOptions() {
    return { jotMode: false, onSubPage: () => {} };
  },

  addProseMirrorPlugins() {
    const all = buildItems(this.options);
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        pluginKey: new PluginKey('slashCommand'),
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        items: ({ query }) => {
          const q = query.toLowerCase();
          return all.filter(
            (i) => i.label.toLowerCase().includes(q) || i.keywords?.includes(q),
          );
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        render: suggestionRender<SlashItem>(),
      }),
    ];
  },
});
