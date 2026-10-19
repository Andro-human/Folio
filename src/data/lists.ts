import { useMutation, useQuery } from '@tanstack/react-query';
import { keys, queryClient, supabase, unwrap, unwrapOne } from './client';
import type { ListRow } from './types';

export function useLists() {
  return useQuery({
    queryKey: keys.lists,
    queryFn: async () =>
      unwrap(await supabase.from('lists').select('*').order('position')) as ListRow[],
    staleTime: 5 * 60_000,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: keys.profile,
    queryFn: async () => unwrap(await supabase.from('profiles').select('*').maybeSingle()),
    staleTime: 5 * 60_000,
  });
}

export const LIST_COLORS = ['gold', 'info', 'success', 'warning', 'primary', 'muted'] as const;

export function listColorVar(color: string): string {
  const known = (LIST_COLORS as readonly string[]).includes(color) ? color : 'gold';
  return known === 'muted' ? 'hsl(var(--muted-foreground))' : `hsl(var(--${known}))`;
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
