import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export { supabase };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

export const keys = {
  lists: ['lists'] as const,
  profile: ['profile'] as const,
  folders: ['folders'] as const,
  tasks: ['tasks'] as const,
  openTasks: ['tasks', 'open'] as const,
  doneTasks: (listId: string | null) => ['tasks', 'done', listId] as const,
  tasksByIds: (ids: string[]) => ['tasks', 'ids', [...ids].sort().join(',')] as const,
  pages: ['pages'] as const,
  page: (id: string) => ['pages', 'one', id] as const,
  folderPages: (folderId: string | null) => ['pages', 'folder', folderId] as const,
  children: (id: string) => ['pages', 'children', id] as const,
  backlinks: (id: string) => ['pages', 'backlinks', id] as const,
  jot: (date: string) => ['pages', 'jot', date] as const,
  jots: ['pages', 'jots'] as const,
  recent: ['pages', 'recent'] as const,
  search: (q: string) => ['search', q] as const,
  events: ['events'] as const,
};

export function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** For `.single()`: a missing row is already an error from PostgREST. */
export function unwrapOne<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null || res.data === undefined) throw new Error('Not found');
  return res.data as NonNullable<T>;
}
