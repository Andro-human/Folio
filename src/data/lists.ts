import { useMutation, useQuery } from '@tanstack/react-query';
import { keys, queryClient, supabase, unwrap, unwrapOne } from './client';
import type { ListRow } from './types';

const listsQuery = {
  queryKey: keys.lists,
  queryFn: async () => unwrap(await supabase.from('lists').select('*').order('position')) as ListRow[],
  staleTime: 5 * 60_000,
};

export function useLists() {
  return useQuery(listsQuery);
}

export function fetchLists(): Promise<ListRow[]> {
  return queryClient.fetchQuery(listsQuery);
}

export function useProfile() {
  return useQuery({
    queryKey: keys.profile,
    queryFn: async () => unwrap(await supabase.from('profiles').select('*').maybeSingle()),
    staleTime: 5 * 60_000,
  });
}

export const LIST_COLORS = ['blue', 'green', 'orange', 'red', 'purple', 'teal', 'gray'] as const;

// Names the signup trigger used before the palette existed.
const LEGACY: Record<string, string> = { gold: 'orange', info: 'blue', success: 'green', warning: 'orange', primary: 'red', muted: 'gray' };

export function listColorVar(color: string): string {
  const name = LEGACY[color] ?? color;
  return `hsl(var(--c-${(LIST_COLORS as readonly string[]).includes(name) ? name : 'gray'}))`;
}

export function useCreateList() {
  return useMutation({
    mutationFn: async (name: string) => {
      const lists = queryClient.getQueryData<ListRow[]>(keys.lists) ?? [];
      const color = LIST_COLORS[lists.length % LIST_COLORS.length];
      return unwrapOne(
        await supabase
          .from('lists')
          .insert({ name, color, position: lists.length })
          .select()
          .single(),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.lists }),
  });
}

export function useUpdateList() {
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ListRow> & { id: string }) =>
      unwrap(await supabase.from('lists').update(patch).eq('id', id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.lists }),
  });
}

export function useDeleteList() {
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('lists').delete().eq('id', id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.lists });
      queryClient.invalidateQueries({ queryKey: keys.tasks });
    },
  });
}
