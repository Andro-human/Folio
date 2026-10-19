import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import {
  AtSign,
  Bold,
  CheckCircle2,
  ChevronDown,
  Heading2,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListChecks,
  Minus,
  Redo2,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const coarse = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/**
 * Formatting bar pinned to the top of the iOS keyboard. Fixed elements sit on the
 * layout viewport, which the keyboard does not shrink, so the offset comes from
 * visualViewport.
 */
export function MobileToolbar({ editor, jotMode }: { editor: Editor; jotMode: boolean }) {
  const [focused, setFocused] = useState(false);
  const [bottom, setBottom] = useState(0);
  const [, force] = useState(0);

  useEffect(() => {
    if (!coarse()) return;
    const onFocus = () => setFocused(true);
    const onBlur = () => setFocused(false);
    const onTx = () => force((n) => n + 1);
    editor.on('focus', onFocus);
    editor.on('blur', onBlur);
    editor.on('selectionUpdate', onTx);
    editor.on('transaction', onTx);
    return () => {
      editor.off('focus', onFocus);
      editor.off('blur', onBlur);
      editor.off('selectionUpdate', onTx);
      editor.off('transaction', onTx);
    };
  }, [editor]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!focused || !vv) return;
    const update = () => setBottom(Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [focused]);

  if (!focused) return null;

  const { $from } = editor.state.selection;
  const block = $from.depth >= 1 ? $from.node(1) : null;
  const isTask = block?.type.name === 'taskLine';
  const indent = block?.type.name === 'paragraph' ? ((block.attrs.indent as number) ?? 0) : 0;
  const run = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };

  return createPortal(
    <div
      className="fixed inset-x-0 z-[70] border-t border-border bg-card/95 backdrop-blur"
      style={{ bottom }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="scrollbar-none flex items-center gap-0.5 overflow-x-auto px-1.5 py-1">
        <Tool
          label={isTask ? 'Make note' : 'Make task'}
          active={isTask}
          onClick={run(() => editor.chain().focus().toggleTaskLine().run())}
        >
          {isTask ? <Minus /> : <CheckCircle2 />}
          <span className="text-xs">{isTask ? 'Note' : 'Task'}</span>
        </Tool>
        <Divider />
        <Tool label="Indent" onClick={run(() => editor.chain().focus().keyboardShortcut('Tab').run())}>
          <IndentIncrease />
        </Tool>
        <Tool
          label="Outdent"
          disabled={indent === 0 && !editor.isActive('listItem') && !editor.isActive('taskItem')}
          onClick={run(() => editor.chain().focus().keyboardShortcut('Shift-Tab').run())}
        >
          <IndentDecrease />
        </Tool>
        <Divider />
        <Tool label="Bold" active={editor.isActive('bold')} onClick={run(() => editor.chain().focus().toggleBold().run())}>
          <Bold />
        </Tool>
        <Tool label="Italic" active={editor.isActive('italic')} onClick={run(() => editor.chain().focus().toggleItalic().run())}>
          <Italic />
        </Tool>
        <Tool
          label="Heading"
          active={editor.isActive('heading')}
          onClick={run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        >
          <Heading2 />
        </Tool>
        <Tool
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={run(() => editor.chain().focus().toggleBulletList().run())}
        >
          <List />
        </Tool>
        {!jotMode && (
          <Tool
            label="Checklist"
            active={editor.isActive('taskList')}
            onClick={run(() => editor.chain().focus().toggleTaskList().run())}
          >
            <ListChecks />
          </Tool>
        )}
        <Tool label="Link a page" onClick={run(() => editor.chain().focus().insertContent('@').run())}>
          <AtSign />
        </Tool>
        <Divider />
        <Tool label="Undo" disabled={!editor.can().undo()} onClick={run(() => editor.chain().focus().undo().run())}>
          <Undo2 />
        </Tool>
        <Tool label="Redo" disabled={!editor.can().redo()} onClick={run(() => editor.chain().focus().redo().run())}>
          <Redo2 />
        </Tool>
        <div className="flex-1" />
        <Tool label="Hide keyboard" onClick={run(() => editor.commands.blur())}>
          <ChevronDown />
        </Tool>
      </div>
    </div>,
    document.body,
  );
}

function Tool({
  children,
  label,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-md px-2 [&_svg]:h-[18px] [&_svg]:w-[18px]',
        active ? 'bg-muted text-foreground' : 'text-muted-foreground',
        disabled && 'opacity-35',
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
