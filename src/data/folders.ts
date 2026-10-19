import { useQuery } from '@tanstack/react-query';
import { keys, queryClient, supabase, unwrap, unwrapOne } from './client';
import type { FolderRow } from './types';

export function useFolders() {
  return useQuery({
    queryKey: keys.folders,
    queryFn: async () =>
      unwrap(await supabase.from('folders').select('*').order('position').order('name')) as FolderRow[],
    staleTime: 60_000,
  });
}

export interface FolderNode extends FolderRow {
  children: FolderNode[];
  depth: number;
}

export function buildFolderTree(folders: FolderRow[]): FolderNode[] {
  const byParent = new Map<string | null, FolderRow[]>();
  for (const f of folders) {
    const list = byParent.get(f.parent_id) ?? [];
    list.push(f);
    byParent.set(f.parent_id, list);
  }
  const build = (parent: string | null, depth: number): FolderNode[] =>
    (byParent.get(parent) ?? []).map((f) => ({ ...f, depth, children: build(f.id, depth + 1) }));
  return build(null, 0);
}

export function folderPath(folders: FolderRow[], id: string | null): FolderRow[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: FolderRow[] = [];
  let cur = id ? byId.get(id) : undefined;
  while (cur && path.length < 20) {
    path.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return path;
}

function refresh() {
  queryClient.invalidateQueries({ queryKey: keys.folders });
}

export async function createFolder(name: string, parentId: string | null): Promise<string> {
  const row = unwrapOne(
    await supabase.from('folders').insert({ name, parent_id: parentId }).select('id').single(),
  );
  refresh();
  return row.id;
}

export async function renameFolder(id: string, name: string) {
  unwrap(await supabase.from('folders').update({ name }).eq('id', id));
  refresh();
}

/** Pages inside fall back to Unfiled (folder_id set null), subfolders go with it. */
export async function deleteFolder(id: string) {
  unwrap(await supabase.from('folders').delete().eq('id', id));
  refresh();
  queryClient.invalidateQueries({ queryKey: keys.pages });
}
