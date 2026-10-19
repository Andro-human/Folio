import { NavLink, useLocation } from 'react-router-dom';
import { ListTodo, NotebookPen, Plus, Search, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCapture } from './capture';
import { cn } from '@/lib/utils';

const items = [
  { to: '/', icon: Sun, label: 'Today', match: (p: string) => p === '/' },
  { to: '/tasks', icon: ListTodo, label: 'Tasks', match: (p: string) => p.startsWith('/tasks') },
  null,
  {
    to: '/notes',
    icon: NotebookPen,
    label: 'Notes',
    match: (p: string) => p.startsWith('/notes') || p.startsWith('/jots') || p.startsWith('/p/'),
  },
  { to: '/search', icon: Search, label: 'Search', match: (p: string) => p.startsWith('/search') },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const { openCapture } = useCapture();

  return (
    <nav className="bottom-nav safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-2 md:hidden">
      <div className="pointer-events-auto mx-auto flex h-16 max-w-md items-center justify-around rounded-2xl border border-border bg-card/95 px-1 shadow-2xl backdrop-blur">
        {items.map((item) => {
          if (!item) {
            return (
              <button
                key="capture"
                type="button"
                aria-label="Quick capture"
                onClick={() => openCapture('task')}
                className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
              >
                <Plus className="h-6 w-6" strokeWidth={2.4} />
              </button>
            );
          }
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className="relative flex h-full w-14 flex-col items-center justify-center">
              <Icon
                className={cn('h-5 w-5 transition-colors', active ? 'text-foreground' : 'text-muted-foreground')}
                strokeWidth={active ? 2.4 : 2}
              />
              <span
                className={cn(
                  'mt-1 font-mono text-[9px] uppercase tracking-widest',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {item.label}
              </span>
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute bottom-1 h-0.5 w-6 bg-primary"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
