import type { Database } from '@/integrations/supabase/types';

type T = Database['public']['Tables'];

export type PageRow = T['pages']['Row'];
export type TaskRow = T['tasks']['Row'];
export type ListRow = T['lists']['Row'];
export type FolderRow = T['folders']['Row'];
export type EventRow = T['events']['Row'];
export type Priority = Database['public']['Enums']['task_priority'];
export type TaskStatus = Database['public']['Enums']['task_status'];

/** The page columns list views need; content stays out of list queries. */
export type PageSummary = Pick<
  PageRow,
  'id' | 'title' | 'folder_id' | 'parent_page_id' | 'origin_page_id' | 'jot_date' | 'updated_at' | 'deleted_at'
>;

export type Task = TaskRow & {
  page: Pick<PageRow, 'id' | 'title' | 'origin_page_id' | 'deleted_at' | 'updated_at'>;
};

export type FullPage = PageRow & { task: TaskRow | null };
