import { Extension } from '@tiptap/core';

const MAX_INDENT = 2;

export interface LineBehaviorOptions {
  /** Jot pages: a new top-level line is a task unless marked as a note. */
  jotMode: boolean;
}

/**
 * Line rules shared by jots and pages:
 *  - Enter on a task line starts another task line; Enter on an empty one exits to text.
 *  - Tab turns a line into an indented note (indented lines are never tasks).
 *  - Backspace at the start of a task line turns it back into text.
 */
export const LineBehavior = Extension.create<LineBehaviorOptions>({
  name: 'lineBehavior',
  priority: 300,

  addOptions() {
    return { jotMode: false };
  },

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          indent: {
            default: 0,
            keepOnSplit: true,
            parseHTML: (el) => Number(el.getAttribute('data-indent') ?? 0) || 0,
            renderHTML: (attrs) => (attrs.indent ? { 'data-indent': String(attrs.indent) } : {}),
          },
        },
      },
    ];
  },

  addKeyboardShortcuts() {
    const jot = this.options.jotMode;

    return {
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.depth !== 1) return false;
        const node = $from.parent;

        if (node.type.name === 'taskLine') {
          if (node.content.size === 0) return editor.commands.setNode('paragraph', { indent: 0 });
          return editor.chain().splitBlock({ keepMarks: false }).setNode('taskLine', { taskId: null }).run();
        }

        if (node.type.name === 'paragraph') {
          const indent = (node.attrs.indent as number) ?? 0;
          if (node.content.size === 0 && indent > 0) {
            return editor.commands.updateAttributes('paragraph', { indent: indent - 1 });
          }
          if (jot && indent === 0) {
            if (node.content.size === 0) return editor.commands.setNode('taskLine', { taskId: null });
            return editor.chain().splitBlock({ keepMarks: false }).setNode('taskLine', { taskId: null }).run();
          }
        }
        return false;
      },

      Tab: ({ editor }) => {
        const { $from } = editor.state.selection;
        if ($from.depth !== 1) return false;
        const node = $from.parent;
        if (node.type.name === 'taskLine') {
          return editor.commands.setNode('paragraph', { indent: 1 });
        }
        if (node.type.name === 'paragraph') {
          const indent = (node.attrs.indent as number) ?? 0;
          if (indent < MAX_INDENT) editor.commands.updateAttributes('paragraph', { indent: indent + 1 });
          return true;
        }
        return false;
      },

      'Shift-Tab': ({ editor }) => {
        const { $from } = editor.state.selection;
        if ($from.depth !== 1) return false;
        const node = $from.parent;
        if (node.type.name === 'paragraph') {
          const indent = (node.attrs.indent as number) ?? 0;
          if (indent > 0) editor.commands.updateAttributes('paragraph', { indent: indent - 1 });
          return true;
        }
        return false;
      },

      Backspace: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.depth !== 1 || $from.parentOffset !== 0) return false;
        if ($from.parent.type.name === 'taskLine') {
          return editor.commands.setNode('paragraph', { indent: 0 });
        }
        return false;
      },
    };
  },
});
