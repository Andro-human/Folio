import { NavLink, useLocation } from 'react-router-dom';
import { ListTodo, NotebookPen, Plus, Search, Sun } from 'lucide-react';
import { useCapture } from './capture';
import { cn } from '@/lib/utils';

const items = [
  { to: '/', icon: Sun, label: 'Today', match: (p: string) => p === '/' },
  { to: '/tasks', icon: ListTodo, label: 'Tasks', match: (p: string) => p.startsWith('/tasks') },
  {
    to: '/notes',
    icon: NotebookPen,
    label: 'Notes',
    match: (p: string) => p.startsWith('/notes') || p.startsWith('/jots'),
  },
  { to: '/search', icon: Search, label: 'Search', match: (p: string) => p.startsWith('/search') },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const { openCapture } = useCapture();

  return (
    <div className="bottom-nav md:hidden">
      <button
        type="button"
        aria-label="Quick capture"
        onClick={() => openCapture('task')}
        className="fixed right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[56px] max-w-md items-stretch">
          {items.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.8} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
