import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  CalendarDays,
  ChevronRight,
  Folder,
  ListTodo,
  NotebookPen,
  Plus,
  Search,
  Settings,
  Sun,
} from 'lucide-react';
import { useCapture } from './capture';
import { useLists, listColorVar } from '@/data/lists';
import { useOpenTasks, groupTasks } from '@/data/tasks';
import { buildFolderTree, useFolders, type FolderNode } from '@/data/folders';
import { cn } from '@/lib/utils';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[14px] transition-colors',
    isActive ? 'bg-primary/10 font-medium text-primary' : 'text-foreground/80 hover:bg-foreground/5',
  );

export function Sidebar() {
  const { openCapture } = useCapture();
  const { data: lists } = useLists();
  const { data: tasks } = useOpenTasks();
  const { data: folders } = useFolders();
  const tree = useMemo(() => buildFolderTree(folders ?? []), [folders]);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    tasks?.forEach((t) => {
      if (t.status === 'todo' && t.list_id) c.set(t.list_id, (c.get(t.list_id) ?? 0) + 1);
    });
    return c;
  }, [tasks]);

  const todayCount = useMemo(() => {
    if (!tasks) return 0;
    const g = groupTasks(tasks);
    return g.overdue.length + g.today.length;
  }, [tasks]);

  return (
    <aside className="sticky top-0 z-20 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card px-3 pb-4 pt-6 md:flex">
      <div className="mb-5 flex items-center justify-between px-2.5">
        <span className="text-lg font-semibold tracking-tight">Folio</span>
      </div>

      <button
        type="button"
        onClick={() => openCapture('task')}
        className="mb-4 flex items-center justify-between rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <span className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Quick capture
        </span>
        <kbd className="text-xs opacity-75">⌘K</kbd>
      </button>

      <nav className="space-y-0.5">
        <NavLink to="/" end className={linkClass}>
          <Sun className="h-4 w-4" />
          <span className="flex-1">Today</span>
          {todayCount > 0 && <span className="text-xs tabular">{todayCount}</span>}
        </NavLink>
        <NavLink to="/tasks" end className={linkClass}>
          <ListTodo className="h-4 w-4" /> Tasks
        </NavLink>
        <NavLink to="/notes" end className={linkClass}>
          <NotebookPen className="h-4 w-4" /> Notes
        </NavLink>
        <NavLink to="/jots" className={linkClass}>
          <CalendarDays className="h-4 w-4" /> Jots
        </NavLink>
        <NavLink to="/search" className={linkClass}>
          <Search className="h-4 w-4" /> Search
        </NavLink>
      </nav>

      <div className="mt-6 min-h-0 flex-1 space-y-6 overflow-y-auto">
        <section>
          <SectionLabel>Lists</SectionLabel>
          <div className="space-y-0.5">
            {lists?.map((l) => (
              <NavLink key={l.id} to={`/tasks/list/${l.id}`} className={linkClass}>
                <span className="h-2 w-2 rounded-full" style={{ background: listColorVar(l.color) }} />
                <span className="flex-1 truncate">{l.name}</span>
                {!!counts.get(l.id) && <span className="text-xs tabular">{counts.get(l.id)}</span>}
              </NavLink>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel>Folders</SectionLabel>
          {tree.length === 0 && <p className="px-2.5 text-xs text-muted-foreground/70">No folders yet</p>}
          <div className="space-y-0.5">
            {tree.map((f) => (
              <FolderItem key={f.id} node={f} />
            ))}
          </div>
        </section>
      </div>

      <NavLink to="/settings" className={linkClass}>
        <Settings className="h-4 w-4" /> Settings
      </NavLink>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 px-2.5 text-xs font-semibold text-muted-foreground">
      {children}
    </div>
  );
}

function FolderItem({ node }: { node: FolderNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center">
        <button
          type="button"
          aria-label={open ? 'Collapse' : 'Expand'}
          onClick={() => setOpen((o) => !o)}
          className={cn('grid h-6 w-5 place-items-center text-muted-foreground', !node.children.length && 'invisible')}
          style={{ marginLeft: node.depth * 12 }}
        >
          <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
        </button>
        <NavLink to={`/notes/f/${node.id}`} className={(s) => cn(linkClass(s), 'flex-1 pl-1')}>
          <Folder className="h-3.5 w-3.5" />
          <span className="truncate">{node.name}</span>
        </NavLink>
      </div>
      {open && node.children.map((c) => <FolderItem key={c.id} node={c} />)}
    </div>
  );
}
