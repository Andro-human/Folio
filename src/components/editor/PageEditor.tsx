import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react';
import type { Range } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { toast } from 'sonner';
import { TaskLine } from './extensions/taskLine';
import { LineBehavior } from './extensions/lineBehavior';
import { SlashCommand } from './extensions/slashCommand';
import { PageMention } from './extensions/pageMention';
import { SubPage } from './extensions/subPage';
import { ChipContext } from './chipContext';
import { MobileToolbar } from './MobileToolbar';
import {
  EMPTY_JOT_DOC,
  EMPTY_PAGE_DOC,
  docLinkIds,
  docTaskIds,
  docToText,
  reconcileTaskTitles,
} from '@/lib/docText';
import { parseQuickTask } from '@/lib/quickSyntax';
import { jotTitle, formatDeadline } from '@/lib/dates';
import { keys, queryClient } from '@/data/client';
import { createPage, ensureJot, renamePage, savePage } from '@/data/pages';
import { completeTask, createTask, uncompleteTask, useOpenTasks, useTasksByIds } from '@/data/tasks';
import { useLists } from '@/data/lists';
import type { FullPage, ListRow, Task } from '@/data/types';
import { cn } from '@/lib/utils';

type Mode = 'jot' | 'page';

interface PageEditorProps {
  page: FullPage | null;
  mode: Mode;
  /** Required in jot mode: the day this jot belongs to (yyyy-MM-dd). */
  jotDate?: string;
  autoFocus?: boolean;
  className?: string;
  /** Rendered between the title and the body, e.g. a task's properties. */
  belowTitle?: React.ReactNode;
}

/** Loads the tasks referenced by chips before mounting, so chips render with real titles. */
export function PageEditor(props: PageEditorProps) {
  const { page, mode } = props;
  const initialDoc = useMemo<JSONContent>(
    () => (page?.content as JSONContent | null) ?? (mode === 'jot' ? EMPTY_JOT_DOC : EMPTY_PAGE_DOC),
    // Created once per page (or per jot day, which gains a row on first write);
    // later content arrives via the version check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode === 'jot' ? props.jotDate : page?.id, mode],
  );
  const initialIds = useMemo(() => docTaskIds(initialDoc), [initialDoc]);
  const [chipIds, setChipIds] = useState(initialIds);
  const chipQuery = useTasksByIds(chipIds);
  const openTasks = useOpenTasks();
  const lists = useLists();

  const taskMap = useMemo(() => {
    const m = new Map<string, Task>();
    chipQuery.data?.forEach((t) => m.set(t.page_id, t));
    openTasks.data?.forEach((t) => m.set(t.page_id, t));
    return m;
  }, [chipQuery.data, openTasks.data]);

  const listMap = useMemo(() => new Map((lists.data ?? []).map((l) => [l.id, l])), [lists.data]);

  const ready = (initialIds.length === 0 || chipQuery.isFetched) && lists.isFetched;
  if (!ready) {
    return (
      <div className={cn('space-y-3 py-2', props.className)}>
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <EditorInner
      key={mode === 'jot' ? `jot-${props.jotDate}` : page?.id}
      {...props}
      initialDoc={reconcileTaskTitles(initialDoc, (id) => taskMap.get(id)?.page.title)}
      taskMap={taskMap}
      lists={lists.data ?? []}
      listMap={listMap}
      onChipIds={setChipIds}
    />
  );
}

interface InnerProps extends PageEditorProps {
  initialDoc: JSONContent;
  taskMap: Map<string, Task>;
  lists: ListRow[];
  listMap: Map<string, ListRow>;
  onChipIds: (ids: string[]) => void;
}

type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

function EditorInner({
  page,
  mode,
  jotDate,
  autoFocus,
  className,
  belowTitle,
  initialDoc,
  taskMap,
  lists,
  listMap,
  onChipIds,
}: InnerProps) {
  const navigate = useNavigate();
  const target = useRef<{ id: string; version: number } | null>(
    page ? { id: page.id, version: page.version } : null,
  );
  const [title, setTitle] = useState(page?.title ?? '');
  const titleRef = useRef(title);
  const savedTitle = useRef(title);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const inFlight = useRef<Promise<void> | null>(null);
  const pendingCreates = useRef(new Set<Promise<unknown>>());
  const conflictRef = useRef(false);
  const [conflict, setConflict] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const editorRef = useRef<Editor | null>(null);
  const tasksRef = useRef(taskMap);
  tasksRef.current = taskMap;
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const chipKey = useRef(docTaskIds(initialDoc).sort().join(','));

  const ensureTarget = useCallback(async () => {
    if (target.current) return target.current;
    const jot = await ensureJot(jotDate!, jotTitle(jotDate!));
    target.current = { id: jot.id, version: jot.version };
    if (jot.content && jot.version > 1) {
      // Written on another device since this screen loaded.
      conflictRef.current = true;
      setConflict(true);
    }
    return target.current;
  }, [jotDate]);

  const save = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || conflictRef.current || !dirty.current) return;
    const json = editor.getJSON();
    const pageTitle = mode === 'jot' ? jotTitle(jotDate!) : titleRef.current;
    if (inFlight.current) await inFlight.current;
    if (!dirty.current) return;
    dirty.current = false;

    const run = (async () => {
      setStatus('saving');
      try {
        const t = await ensureTarget();
        if (conflictRef.current) return;
        await Promise.all([...pendingCreates.current]);
        const latest = editorRef.current?.isDestroyed === false ? editorRef.current.getJSON() : json;
        const version = await savePage({
          id: t.id,
          baseVersion: t.version,
          title: pageTitle,
          content: latest,
          contentText: docToText(latest),
          linkIds: docLinkIds(latest),
        });
        if (version === null) {
          conflictRef.current = true;
          setConflict(true);
          setStatus('error');
          return;
        }
        t.version = version;
        const patch = (old: FullPage | null | undefined) =>
          old ? { ...old, version, content: latest, title: pageTitle } : old;
        queryClient.setQueryData(keys.page(t.id), patch);
        if (jotDate) queryClient.setQueryData(keys.jot(jotDate), patch);
        queryClient.invalidateQueries({
          queryKey: keys.pages,
          predicate: (q) => q.queryKey[1] !== 'one' && q.queryKey[1] !== 'jot',
        });
        if (savedTitle.current !== pageTitle) {
          savedTitle.current = pageTitle;
          queryClient.invalidateQueries({ queryKey: keys.tasks });
        }
        setStatus(dirty.current ? 'dirty' : 'saved');
      } catch {
        dirty.current = true;
        setStatus('error');
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void save(), 4000);
      }
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
  }, [ensureTarget, jotDate, mode]);

  const schedule = useCallback(() => {
    dirty.current = true;
    setStatus('dirty');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 800);
  }, [save]);

  /** Runs when the cursor leaves a task line: create its task, or sync a rename. */
  const leaveLine = useCallback(
    (pos: number) => {
      const editor = editorRef.current;
      if (!editor || editor.isDestroyed) return;
      const node = editor.state.doc.nodeAt(pos);
      if (!node || node.type.name !== 'taskLine') return;
      const text = node.textContent.trim();
      const existing = node.attrs.taskId as string | null;

      if (!text) {
        // An emptied chip means the task was deleted; the next save trashes it.
        if (existing) {
          const tr = editor.state.tr;
          if (editor.state.doc.childCount > 1) tr.delete(pos, pos + node.nodeSize);
          else tr.setNodeMarkup(pos, undefined, { ...node.attrs, taskId: null });
          editor.view.dispatch(tr);
        }
        return;
      }

      if (existing) {
        const task = tasksRef.current.get(existing);
        if (task && task.page.title !== text) {
          renamePage(existing, text).catch(() => toast.error("Couldn't rename the task"));
        }
        return;
      }

      const parsed = parseQuickTask(text, listsRef.current);
      const id = crypto.randomUUID();
      const tr = editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, taskId: id });
      if (parsed.title !== node.textContent) {
        tr.replaceWith(pos + 1, pos + 1 + node.content.size, editor.schema.text(parsed.title));
      }
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);

      const job = ensureTarget()
        .then((t) =>
          createTask({
            id,
            title: parsed.title,
            listId: parsed.listId,
            priority: parsed.priority,
            deadline: parsed.deadline ?? null,
            deadlineHasTime: parsed.deadlineHasTime,
            rrule: parsed.rrule ?? null,
            originPageId: t.id,
          }),
        )
        .catch(() => toast.error("Couldn't create the task"));
      pendingCreates.current.add(job);
      job.finally(() => pendingCreates.current.delete(job));
    },
    [ensureTarget],
  );

  const onSubPage = useCallback(
    (editor: Editor, range: Range) => {
      editor.chain().focus().deleteRange(range).run();
      ensureTarget()
        .then((t) => createPage({ parentPageId: t.id, title: '' }))
        .then((childId) => {
          editor.chain().focus().insertSubPage(childId).run();
          queryClient.invalidateQueries({ queryKey: keys.children(target.current!.id) });
        })
        .catch(() => toast.error("Couldn't create the sub-page"));
    },
    [ensureTarget],
  );

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
        trailingNode:
          mode === 'jot' ? { node: 'taskLine', notAfter: ['paragraph'] } : { node: 'paragraph' },
      }),
      Placeholder.configure({
        showOnlyCurrent: true,
        includeChildren: false,
        placeholder: ({ node }) => {
          if (node.type.name === 'taskLine') return mode === 'jot' ? 'Add a task…   (- for a note)' : 'New task…';
          if (node.type.name === 'heading') return 'Heading';
          return mode === 'jot' ? 'Note…' : 'Write, or type / for commands';
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TaskLine,
      LineBehavior.configure({ jotMode: mode === 'jot' }),
      SlashCommand.configure({ jotMode: mode === 'jot', onSubPage }),
      PageMention,
      SubPage,
    ],
    content: initialDoc,
    autofocus: autoFocus && mode === 'jot' ? 'end' : false,
    editorProps: {
      attributes: { 'data-mode': mode, spellcheck: 'true' },
      handleDOMEvents: {
        click: (_view, event) => {
          const el = (event.target as HTMLElement).closest<HTMLElement>('.page-mention');
          const id = el?.getAttribute('data-id');
          if (id) {
            event.preventDefault();
            navigate(`/p/${id}`);
            return true;
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor: e }) => {
      schedule();
      const ids = docTaskIds(e.getJSON()).sort();
      const key = ids.join(',');
      if (key !== chipKey.current) {
        chipKey.current = key;
        onChipIds(ids);
      }
    },
    onFocus: () => document.documentElement.classList.add('is-editing'),
    onBlur: () => document.documentElement.classList.remove('is-editing'),
  });
  editorRef.current = editor;

  // Track the task line under the cursor; leaving it commits the line.
  useEffect(() => {
    if (!editor) return;
    let prev: number | null = null;
    const currentLine = () => {
      const { $from } = editor.state.selection;
      return $from.depth >= 1 && $from.node(1).type.name === 'taskLine' ? $from.before(1) : null;
    };
    const onTransaction = ({ transaction }: { transaction: import('@tiptap/pm/state').Transaction }) => {
      const mapped = prev === null ? null : transaction.mapping.map(prev);
      const cur = currentLine();
      if (mapped !== null && mapped !== cur) setTimeout(() => leaveLine(mapped));
      prev = cur;
    };
    const onBlur = () => {
      if (prev !== null) {
        const p = prev;
        setTimeout(() => leaveLine(p));
      }
    };
    editor.on('transaction', onTransaction);
    editor.on('blur', onBlur);
    return () => {
      editor.off('transaction', onTransaction);
      editor.off('blur', onBlur);
    };
  }, [editor, leaveLine]);

  // Flush on background/close/unmount.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden' && dirty.current) {
        clearTimeout(timer.current);
        void save();
      }
    };
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current || inFlight.current) e.preventDefault();
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('beforeunload', warn);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('beforeunload', warn);
      clearTimeout(timer.current);
      document.documentElement.classList.remove('is-editing');
      if (dirty.current) void save();
    };
  }, [save]);

  // Newer content from another device (refetch on focus), applied only when nothing is unsaved.
  useEffect(() => {
    if (!editor || !page || !target.current || page.id !== target.current.id) return;
    if (page.version > target.current.version && !dirty.current && !inFlight.current) {
      target.current.version = page.version;
      // Node views flush synchronously; swapping content mid-render warns and can drop updates.
      queueMicrotask(() => {
        if (editor.isDestroyed) return;
        editor.commands.setContent(
          reconcileTaskTitles((page.content as JSONContent) ?? EMPTY_PAGE_DOC, (id) => tasksRef.current.get(id)?.page.title),
          { emitUpdate: false },
        );
      });
      if (mode === 'page') {
        setTitle(page.title);
        titleRef.current = page.title;
        savedTitle.current = page.title;
      }
    }
  }, [editor, page, page?.version, mode]);

  const reload = async () => {
    const id = target.current?.id;
    if (!id || !editor) return;
    const key = jotDate ? keys.jot(jotDate) : keys.page(id);
    await queryClient.invalidateQueries({ queryKey: key });
    const fresh = queryClient.getQueryData<FullPage | null>(key);
    if (!fresh) return;
    editor.commands.setContent((fresh.content as JSONContent) ?? EMPTY_PAGE_DOC, { emitUpdate: false });
    target.current = { id: fresh.id, version: fresh.version };
    if (mode === 'page') {
      setTitle(fresh.title);
      titleRef.current = fresh.title;
    }
    dirty.current = false;
    conflictRef.current = false;
    setConflict(false);
    setStatus('saved');
  };

  const chips = useMemo(
    () => ({
      tasks: taskMap,
      lists: listMap,
      open: (id: string) => navigate(`/p/${id}`),
      toggle: (id: string) => {
        const task = tasksRef.current.get(id);
        if (!task) return;
        if (task.status === 'done') {
          uncompleteTask(id).catch(() => toast.error("Couldn't update the task"));
          return;
        }
        completeTask(task)
          .then((next) => {
            if (next) toast(`Next: ${formatDeadline(next.toISOString(), task.deadline_has_time)}`);
          })
          .catch(() => toast.error("Couldn't complete the task"));
      },
    }),
    [taskMap, listMap, navigate],
  );

  return (
    <ChipContext.Provider value={chips}>
      <div className={cn('relative', className)}>
        {conflict && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            <span>This page changed on another device.</span>
            <button type="button" onClick={reload} className="font-medium text-warning underline underline-offset-4">
              Reload
            </button>
          </div>
        )}

        {mode === 'page' && (
          <TitleField
            value={title}
            onChange={(v) => {
              setTitle(v);
              titleRef.current = v;
              schedule();
            }}
            onEnter={() => editor?.commands.focus('start')}
            autoFocus={autoFocus}
          />
        )}
        {belowTitle}

        <EditorContent editor={editor} className={cn('editor-root', mode === 'jot' && 'is-jot')} />

        <SaveIndicator status={status} />
        {editor && <MobileToolbar editor={editor} jotMode={mode === 'jot'} />}
      </div>
    </ChipContext.Provider>
  );
}

function TitleField({
  value,
  onChange,
  onEnter,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder="Untitled"
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ''))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onEnter();
        }
      }}
      className="mb-3 w-full resize-none overflow-hidden bg-transparent text-[1.875rem] font-bold leading-tight tracking-tight outline-none placeholder:text-muted-foreground/50 md:text-[2.25rem]"
    />
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const label =
    status === 'saving' ? 'Saving…' : status === 'dirty' ? 'Edited' : status === 'error' ? 'Not saved — retrying' : 'Saved';
  return (
    <div
      className={cn(
        'pointer-events-none mt-6 select-none text-xs font-medium transition-opacity',
        status === 'error' ? 'text-destructive' : 'text-muted-foreground/60',
        status === 'saved' && 'opacity-60',
      )}
      aria-live="polite"
    >
      {label}
    </div>
  );
}
