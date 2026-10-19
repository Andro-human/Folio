import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ChevronRight, FilePlus2, FileText, Folder, FolderPlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader, ScreenTitle, SectionTitle } from '@/components/layout/PageHeader';
import { PromptDialog } from '@/components/notes/PromptDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createFolder, deleteFolder, folderPath, renameFolder, useFolders } from '@/data/folders';
import { createPage, useFolderPages, type FolderEntry } from '@/data/pages';
import { jotTitle, relativeDayLabel, todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';

export default function NotesPage() {
  const { folderId = null } = useParams();
  const navigate = useNavigate();
  const { data: folders = [] } = useFolders();
  const pages = useFolderPages(folderId);
  const [dialog, setDialog] = useState<'new-folder' | 'rename' | null>(null);

  const folder = folders.find((f) => f.id === folderId);
  const path = useMemo(() => folderPath(folders, folderId), [folders, folderId]);
  const subfolders = folders.filter((f) => f.parent_id === folderId);

  const newPage = async () => {
    try {
      const id = await createPage({ folderId });
      navigate(`/p/${id}`);
    } catch {
      toast.error("Couldn't create the page");
    }
  };

  return (
    <>
      <PageHeader
        back={folderId ? (folder?.parent_id ? `/notes/f/${folder.parent_id}` : '/notes') : undefined}
        actions={
          <>
            <IconButton label="New folder" onClick={() => setDialog('new-folder')}>
              <FolderPlus className="h-[18px] w-[18px]" />
            </IconButton>
            <IconButton label="New page" onClick={newPage}>
              <FilePlus2 className="h-[18px] w-[18px]" />
            </IconButton>
            {folder && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label="Folder options" className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted">
                    <MoreHorizontal className="h-[18px] w-[18px]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setDialog('rename')}>
                    <Pencil className="mr-2 h-4 w-4" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-primary focus:text-primary"
                    onSelect={async () => {
                      if (!confirm(`Delete “${folder.name}”? Its pages move to Unfiled; subfolders are deleted.`)) return;
                      await deleteFolder(folder.id);
                      navigate(folder.parent_id ? `/notes/f/${folder.parent_id}` : '/notes');
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      >
        {path.length > 0 && (
          <nav className="flex min-w-0 items-center gap-1 truncate">
            <Link to="/notes" className="hover:text-foreground">
              Notes
            </Link>
            {path.slice(0, -1).map((f) => (
              <span key={f.id} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <Link to={`/notes/f/${f.id}`} className="truncate hover:text-foreground">
                  {f.name}
                </Link>
              </span>
            ))}
          </nav>
        )}
      </PageHeader>

      <PageBody>
        <ScreenTitle>{folder ? folder.name : 'Notes'}</ScreenTitle>

        {!folderId && (
          <Link
            to="/jots"
            className="mb-7 flex items-center gap-3 rounded-lg border border-border bg-card/40 px-4 py-3 transition-colors hover:border-muted-foreground/40"
          >
            <CalendarDays className="h-5 w-5 text-gold" />
            <div className="flex-1">
              <div>Jots</div>
              <div className="text-xs text-muted-foreground">Today · {jotTitle(todayKey())}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        )}

        {subfolders.length > 0 && (
          <section className="mb-7">
            <SectionTitle>Folders</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {subfolders.map((f) => (
                <Link
                  key={f.id}
                  to={`/notes/f/${f.id}`}
                  className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-3 transition-colors hover:border-muted-foreground/40"
                >
                  <Folder className="h-4 w-4 shrink-0 text-gold" />
                  <span className="truncate text-sm">{f.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionTitle>{folderId ? 'Pages' : 'Unfiled pages'}</SectionTitle>
          {pages.isLoading ? (
            <div className="h-20 animate-pulse rounded bg-muted/50" />
          ) : pages.data?.length ? (
            <div>
              {pages.data.map((p) => (
                <PageItem key={p.id} page={p} />
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={newPage}
              className="w-full rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:text-foreground"
            >
              No pages here yet — create one
            </button>
          )}
        </section>
      </PageBody>

      <PromptDialog
        open={dialog === 'new-folder'}
        title={folder ? `New folder in ${folder.name}` : 'New folder'}
        placeholder="Folder name"
        confirm="Create"
        onOpenChange={(o) => !o && setDialog(null)}
        onSubmit={async (name) => {
          const id = await createFolder(name, folderId);
          navigate(`/notes/f/${id}`);
        }}
      />
      <PromptDialog
        open={dialog === 'rename'}
        title="Rename folder"
        initial={folder?.name}
        onOpenChange={(o) => !o && setDialog(null)}
        onSubmit={(name) => folder && renameFolder(folder.id, name)}
      />
    </>
  );
}

function PageItem({ page }: { page: FolderEntry }) {
  return (
    <Link
      to={`/p/${page.id}`}
      className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0 hover:text-foreground"
    >
      {page.is_task ? (
        <CheckCircle2 className={cn('h-4 w-4 shrink-0', page.task_status === 'done' ? 'text-muted-foreground' : 'text-gold')} />
      ) : (
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className={cn('flex-1 truncate', !page.title && 'text-muted-foreground')}>{page.title || 'Untitled'}</span>
      <span className="shrink-0 font-mono text-2xs text-muted-foreground">{relativeDayLabel(new Date(page.updated_at))}</span>
    </Link>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
