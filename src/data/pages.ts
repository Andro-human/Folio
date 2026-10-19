import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { JSONContent } from '@tiptap/react';
import { keys, queryClient, supabase, unwrap, unwrapOne } from './client';
import type { FullPage, PageSummary, TaskRow } from './types';
import type { Json } from '@/integrations/supabase/types';
import { docLinkIds, docToText } from '@/lib/docText';

const SUMMARY = 'id, title, folder_id, parent_page_id, origin_page_id, jot_date, updated_at, deleted_at';

export function usePage(id: string | undefined) {
  return useQuery({
    queryKey: keys.page(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const row = unwrap(
        await supabase.from('pages').select('*, task:tasks(*)').eq('id', id!).maybeSingle(),
      );
      if (!row) return null;
      const { task, ...page } = row as typeof row & { task: TaskRow | TaskRow[] | null };
      return { ...page, task: Array.isArray(task) ? (task[0] ?? null) : task } as FullPage;
    },
  });
}

export type FolderEntry = PageSummary & { is_task: boolean; task_status: string | null };

export function useFolderPages(folderId: string | null) {
  return useQuery({
    queryKey: keys.folderPages(folderId),
    queryFn: async () => {
      let q = supabase
        .from('pages')
        .select(`${SUMMARY}, task:tasks(status)`)
        .is('parent_page_id', null)
        .is('jot_date', null)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
      q = folderId ? q.eq('folder_id', folderId) : q.is('folder_id', null);
      const rows = unwrap(await q) as (PageSummary & { task: { status: string } | { status: string }[] | null })[];
      const entries: FolderEntry[] = rows.map(({ task, ...p }) => {
        const t = Array.isArray(task) ? task[0] : task;
        return { ...p, is_task: !!t, task_status: t?.status ?? null };
      });
      // Unfiled task pages belong to the task views, not the notes tree.
      return folderId ? entries : entries.filter((e) => !e.is_task);
    },
  });
}

export function useChildPages(id: string | undefined) {
  return useQuery({
    queryKey: keys.children(id ?? ''),
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('pages')
          .select(SUMMARY)
          .eq('parent_page_id', id!)
          .is('deleted_at', null)
          .order('position')
          .order('created_at'),
      ) as PageSummary[],
  });
}

export function useBacklinks(id: string | undefined) {
  return useQuery({
    queryKey: keys.backlinks(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const rows = unwrap(
        await supabase
          .from('page_links')
          .select(`from:pages!page_links_from_page_id_fkey(${SUMMARY})`)
          .eq('to_page_id', id!),
      ) as unknown as { from: PageSummary | null }[];
      return rows.map((r) => r.from).filter((p): p is PageSummary => !!p && !p.deleted_at);
    },
  });
}

export function useRecentPages() {
  return useQuery({
    queryKey: keys.recent,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('pages')
          .select(SUMMARY)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(12),
      ) as PageSummary[],
  });
}

export function useSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: keys.search(query),
    enabled: query.length > 0,
    queryFn: async () => unwrap(await supabase.rpc('search_pages', { p_query: query })),
    placeholderData: (prev) => prev,
  });
}

export async function searchPagesByTitle(q: string, limit = 8): Promise<PageSummary[]> {
  let req = supabase.from('pages').select(SUMMARY).is('deleted_at', null).is('jot_date', null);
  if (q.trim()) req = req.ilike('title', `%${q.trim().replace(/[%_]/g, '')}%`);
  return unwrap(await req.order('updated_at', { ascending: false }).limit(limit)) as PageSummary[];
}

// ---------------------------------------------------------------- mutations

export function invalidatePages() {
  queryClient.invalidateQueries({ queryKey: keys.pages });
}

export async function createPage(input: {
  folderId?: string | null;
  parentPageId?: string | null;
  title?: string;
}): Promise<string> {
  const row = unwrapOne(
    await supabase
      .from('pages')
      .insert({
        folder_id: input.folderId ?? null,
        parent_page_id: input.parentPageId ?? null,
        title: input.title ?? '',
      })
      .select('id')
      .single(),
  );
  invalidatePages();
  return row.id;
}

/** Returns the new version, or null when the page changed elsewhere. */
export async function savePage(args: {
  id: string;
  baseVersion: number;
  title: string;
  content: JSONContent;
  contentText: string;
  linkIds: string[];
}): Promise<number | null> {
  const version = unwrap(
    await supabase.rpc('save_page', {
      p_id: args.id,
      p_base_version: args.baseVersion,
      p_title: args.title,
      p_content: args.content as Json,
      p_content_text: args.contentText,
      p_link_ids: args.linkIds,
    }),
  );
  return version ?? null;
}

export async function renamePage(id: string, title: string) {
  unwrap(await supabase.rpc('rename_page', { p_id: id, p_title: title }));
  queryClient.invalidateQueries({ queryKey: keys.tasks });
  invalidatePages();
}

export async function movePage(id: string, to: { folderId?: string | null; parentPageId?: string | null }) {
  const patch: { folder_id?: string | null; parent_page_id?: string | null } = {};
  if ('folderId' in to) patch.folder_id = to.folderId ?? null;
  if ('parentPageId' in to) patch.parent_page_id = to.parentPageId ?? null;
  unwrap(await supabase.from('pages').update(patch).eq('id', id));
  invalidatePages();
}

export async function deletePage(id: string) {
  unwrap(await supabase.from('pages').update({ deleted_at: new Date().toISOString() }).eq('id', id));
  invalidatePages();
  queryClient.invalidateQueries({ queryKey: keys.tasks });
}

export async function restorePage(id: string) {
  unwrap(await supabase.from('pages').update({ deleted_at: null }).eq('id', id));
  invalidatePages();
  queryClient.invalidateQueries({ queryKey: keys.tasks });
}

// --------------------------------------------------------------------- jots

export function useJot(date: string) {
  return useQuery({
    queryKey: keys.jot(date),
    queryFn: async () => {
      const row = unwrap(
        await supabase.from('pages').select('*').eq('jot_date', date).is('deleted_at', null).maybeSingle(),
      );
      return row ? ({ ...row, task: null } as FullPage) : null;
    },
  });
}

export async function ensureJot(date: string, title: string): Promise<FullPage> {
  const existing = queryClient.getQueryData<FullPage | null>(keys.jot(date));
  if (existing) return existing;
  const { data: { user } } = await supabase.auth.getUser();
  unwrap(
    await supabase
      .from('pages')
      .upsert(
        { jot_date: date, title, user_id: user!.id },
        { onConflict: 'user_id,jot_date', ignoreDuplicates: true },
      ),
  );
  const row = unwrapOne(await supabase.from('pages').select('*').eq('jot_date', date).single());
  const page = { ...row, task: null } as FullPage;
  queryClient.setQueryData(keys.jot(date), page);
  queryClient.invalidateQueries({ queryKey: keys.jots });
  return page;
}

const JOTS_PAGE = 14;

export type JotSummary = Pick<FullPage, 'id' | 'jot_date' | 'title' | 'content_text' | 'updated_at'>;

export function useJotsFeed() {
  return useInfiniteQuery({
    queryKey: keys.jots,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await supabase
          .from('pages')
          .select('id, jot_date, title, content_text, updated_at')
          .not('jot_date', 'is', null)
          .is('deleted_at', null)
          .order('jot_date', { ascending: false })
          .range(pageParam, pageParam + JOTS_PAGE - 1),
      ) as JotSummary[],
    getNextPageParam: (last, all) => (last.length < JOTS_PAGE ? undefined : all.length * JOTS_PAGE),
  });
}

const isBlankLine = (n: JSONContent) =>
  (n.type === 'taskLine' || n.type === 'paragraph') && !n.content?.length && !n.attrs?.taskId;

/**
 * Appends a line to a day's jot, server copy first. Retries once if the jot moved
 * underneath us; an editor open on the same jot picks the new version up on refetch.
 */
export async function appendToJot(date: string, title: string, line: JSONContent) {
  const jot = await ensureJot(date, title);
  for (let attempt = 0; attempt < 2; attempt++) {
    const fresh = unwrapOne(await supabase.from('pages').select('*').eq('id', jot.id).single());
    const doc = (fresh.content as JSONContent | null) ?? { type: 'doc', content: [] };
    const content = [...(doc.content ?? [])];
    while (content.length && isBlankLine(content[content.length - 1])) content.pop();
    content.push(line);
    const next: JSONContent = { ...doc, type: 'doc', content };
    const version = await savePage({
      id: fresh.id,
      baseVersion: fresh.version,
      title: fresh.title,
      content: next,
      contentText: docToText(next),
      linkIds: docLinkIds(next),
    });
    if (version !== null) {
      queryClient.invalidateQueries({ queryKey: keys.jot(date) });
      queryClient.invalidateQueries({ queryKey: keys.page(fresh.id) });
      queryClient.invalidateQueries({ queryKey: keys.jots });
      return fresh.id;
    }
  }
  throw new Error('The jot kept changing; try again');
}
