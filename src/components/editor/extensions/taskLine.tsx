import { mergeAttributes, Node, InputRule } from '@tiptap/core';
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react';
import { ArrowUpRight, Repeat } from 'lucide-react';
import { useChips } from '../chipContext';
import { formatDeadline, isOverdue } from '@/lib/dates';
import { listColorVar } from '@/data/lists';
import { cn } from '@/lib/utils';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    taskLine: {
      toggleTaskLine: () => ReturnType;
    };
  }
}

/**
 * A line that is a real task: the text is the task's title, the box completes
 * it. `taskId` is null until the cursor leaves the line (see PageEditor).
 */
export const TaskLine = Node.create({
  name: 'taskLine',
  group: 'block',
  content: 'inline*',
  defining: true,
  priority: 200,

  addAttributes() {
    return {
      taskId: {
        default: null,
        keepOnSplit: false,
        parseHTML: (el) => el.getAttribute('data-task-id'),
        renderHTML: (attrs) => (attrs.taskId ? { 'data-task-id': attrs.taskId } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="task-line"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'task-line' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskLineView);
  },

  addCommands() {
    return {
      toggleTaskLine:
        () =>
        ({ state, commands }) => {
          const { $from } = state.selection;
          if ($from.parent.type.name === 'taskLine') return commands.setNode('paragraph');
          return commands.setNode('taskLine');
        },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^-\s$/,
        handler: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parent.type.name !== 'taskLine') return null;
          state.tr
            .delete(range.from, range.to)
            .setBlockType(range.from, range.from, state.schema.nodes.paragraph);
        },
      }),
    ];
  },
});

function TaskLineView({ node, editor }: ReactNodeViewProps) {
  const { tasks, lists, toggle, open } = useChips();
  const id = node.attrs.taskId as string | null;
  const task = id ? tasks.get(id) : undefined;
  const done = task?.status === 'done';
  const deferred = task?.status === 'deferred';
  const gone = !!task?.page.deleted_at;
  const list = task?.list_id ? lists.get(task.list_id) : undefined;
  const overdue = task && !done && isOverdue(task.deadline, task.deadline_has_time);

  return (
    <NodeViewWrapper
      className={cn('task-line', done && 'is-done', gone && 'is-gone')}
      data-priority={task?.priority ?? 'medium'}
    >
      <button
        type="button"
        contentEditable={false}
        className={cn('task-line-box', !id && 'is-pending', done && 'is-checked')}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => id && toggle(id)}
        aria-label={done ? 'Mark not done' : 'Mark done'}
        disabled={!id}
      >
        {done && (
          <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {node.content.size === 0 && (
        <span contentEditable={false} className="task-line-placeholder">
          {editor.view.dom.getAttribute('data-mode') === 'jot' ? 'Add a task…  (start with - for a note)' : 'New task…'}
        </span>
      )}
      <NodeViewContent className="task-line-text" />
      {task && (
        <span contentEditable={false} className="task-line-meta">
          {deferred && <span className="chip-badge">Deferred</span>}
          {task.deadline && (
            <span className={cn('chip-badge', overdue && 'text-primary')}>
              {formatDeadline(task.deadline, task.deadline_has_time)}
            </span>
          )}
          {task.rrule && <Repeat className="h-3 w-3" aria-label="Repeats" />}
          {list && (
            <span className="chip-badge inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: listColorVar(list.color) }} />
              {list.name}
            </span>
          )}
          <button
            type="button"
            className="chip-open"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => open(task.page_id)}
            aria-label="Open task"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </span>
      )}
    </NodeViewWrapper>
  );
}
