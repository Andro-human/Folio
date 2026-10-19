import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  FilePlus2,
  FileText,
  FolderInput,
  MoreHorizontal,
  Trash2,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader, SectionTitle } from '@/components/layout/PageHeader';
import { PageEditor } from '@/components/editor/PageEditor';
import { TaskProperties } from '@/components/tasks/TaskProperties';
import { MoveDialog, type MoveTarget } from '@/components/notes/MoveDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  createPage,
  deletePage,
  movePage,
  restorePage,
  useBacklinks,
  useChildPages,
  usePage,
} from '@/data/pages';
import { folderPath, useFolders } from '@/data/folders';
import { makeTask, unmakeTask } from '@/data/tasks';
import { useProfile } from '@/data/lists';
import type { FullPage, PageSummary } from '@/data/types';
import { jotTitle } from '@/lib/dates';

export default function PageView() {
  const { id } = useParams();
  const { data: page, isLoading } = usePage(id);

  if (isLoading) {
    return (
      <>
        <PageHeader back />
        <PageBody>
          <div className="mt-6 h-10 w-2/3 animate-pulse rounded bg-muted/60" />
        </PageBody>
      </>
    );
  }
  if (!page) {
    return (
      <>
        <PageHeader back="/notes" />
        <PageBody>
          <p className="mt-10 text-muted-foreground">This page doesn’t exist.</p>
        </PageBody>
      </>
    );
  }
  return <PageScreen key={page.id} page={page} />;
}

function PageScreen({ page }: { page: FullPage }) {
  const navigate = useNavigate();
  const { data: folders = [] } = useFolders();
  const { data: profile } = useProfile();
  const { data: parent } = usePage(page.parent_page_id ?? undefined);
  const [moving, setMoving] = useState(false);
  const isJot = !!page.jot_date;
  const path = folderPath(folders, page.folder_id);

  const onMove = async (t: MoveTarget) => {
    try {
      if ('parentPageId' in t) await movePage(page.id, { parentPageId: t.parentPageId });
      else await movePage(page.id, { folderId: t.folderId, parentPageId: null });
      toast('Moved');
    } catch {
      toast.error("Couldn't move the page");
    }
  };

  const remove = async () => {
    await deletePage(page.id);
    toast('Moved to trash', {
      action: { label: 'Undo', onClick: () => void restorePage(page.id) },
    });
    navigate(-1);
  };

  return (
    <>
      <PageHeader
        back
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Page options" className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted">
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {!isJot &&
                (page.task ? (
                  <DropdownMenuItem onSelect={() => void unmakeTask(page.id)}>
                    <CircleSlash className="mr-2 h-4 w-4" /> Stop being a task
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => void makeTask(page.id, profile?.default_list_id ?? null)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Make this a task
                  </DropdownMenuItem>
                ))}
              {!isJot && (
                <DropdownMenuItem onSelect={() => setMoving(true)}>
                  <FolderInput className="mr-2 h-4 w-4" /> Move…
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={async () => {
                  const childId = await createPage({ parentPageId: page.id });
                  navigate(`/p/${childId}`);
                }}
              >
                <FilePlus2 className="mr-2 h-4 w-4" /> New sub-page
              </DropdownMenuItem>
              {!isJot && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-primary focus:text-primary" onSelect={() => void remove()}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <nav className="flex min-w-0 items-center gap-1 truncate">
          {isJot ? (
            <Link to="/jots" className="inline-flex items-center gap-1.5 hover:text-foreground">
              <CalendarDays className="h-3.5 w-3.5" /> Jots
            </Link>
          ) : parent ? (
            <Link to={`/p/${parent.id}`} className="inline-flex min-w-0 items-center gap-1.5 truncate hover:text-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{parent.title || 'Untitled'}</span>
            </Link>
          ) : path.length ? (
            path.map((f, i) => (
              <span key={f.id} className="flex min-w-0 items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                <Link to={`/notes/f/${f.id}`} className="truncate hover:text-foreground">
                  {f.name}
                </Link>
              </span>
            ))
          ) : page.task ? (
            <Link to="/tasks" className="hover:text-foreground">
              Tasks
            </Link>
          ) : (
            <Link to="/notes" className="hover:text-foreground">
              Notes
            </Link>
          )}
        </nav>
      </PageHeader>

      <PageBody className="pt-2 md:pt-8">
        {page.deleted_at && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
            <span>This page is in the trash.</span>
            <button type="button" onClick={() => void restorePage(page.id)} className="inline-flex items-center gap-1 text-gold">
              <Undo2 className="h-3.5 w-3.5" /> Restore
            </button>
          </div>
        )}

        {isJot && <h1 className="mb-5 text-[2rem] leading-tight md:text-[2.4rem]">{jotTitle(page.jot_date!)}</h1>}
        {page.task && <TaskProperties task={page.task} />}

        <PageEditor page={page} mode={isJot ? 'jot' : 'page'} jotDate={page.jot_date ?? undefined} autoFocus={!page.title && !isJot} />

        <ChildPages pageId={page.id} content={page.content} />
        <Backlinks pageId={page.id} />
      </PageBody>

      <MoveDialog open={moving} onOpenChange={setMoving} pageId={page.id} onPick={onMove} />
    </>
  );
}

/** Children not already shown inline as sub-page blocks (e.g. moved here). */
function ChildPages({ pageId, content }: { pageId: string; content: unknown }) {
  const { data: children = [] } = useChildPages(pageId);
  const inline = JSON.stringify(content ?? '');
  const extra = children.filter((c) => !inline.includes(c.id));
  if (!extra.length) return null;
  return (
    <section className="mt-10">
      <SectionTitle>Sub-pages</SectionTitle>
      <PageLinks pages={extra} />
    </section>
  );
}

function Backlinks({ pageId }: { pageId: string }) {
  const { data = [] } = useBacklinks(pageId);
  if (!data.length) return null;
  return (
    <section className="mt-10">
      <SectionTitle>Linked from</SectionTitle>
      <PageLinks pages={data} />
    </section>
  );
}

function PageLinks({ pages }: { pages: PageSummary[] }) {
  return (
    <div className="space-y-0.5">
      {pages.map((p) => (
        <Link
          key={p.id}
          to={`/p/${p.id}`}
          className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-foreground/90 hover:bg-muted"
        >
          {p.jot_date ? <CalendarDays className="h-4 w-4 text-gold" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
          <span className="truncate">{p.jot_date ? jotTitle(p.jot_date) : p.title || 'Untitled'}</span>
        </Link>
      ))}
    </div>
  );
}
