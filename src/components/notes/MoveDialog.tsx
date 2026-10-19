import { useEffect, useState } from 'react';
import { FileText, Folder, Inbox } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useFolders, folderPath } from '@/data/folders';
import { searchPagesByTitle } from '@/data/pages';
import type { PageSummary } from '@/data/types';

export type MoveTarget = { folderId: string | null } | { parentPageId: string };

/** Pick a folder (or Unfiled) or a parent page to move a page under. */
export function MoveDialog({
  open,
  onOpenChange,
  pageId,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  onPick: (target: MoveTarget) => void;
}) {
  const { data: folders = [] } = useFolders();
  const [query, setQuery] = useState('');
  const [pages, setPages] = useState<PageSummary[]>([]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    searchPagesByTitle(query, 8).then((p) => alive && setPages(p.filter((x) => x.id !== pageId)));
    return () => {
      alive = false;
    };
  }, [open, query, pageId]);

  const pick = (t: MoveTarget) => {
    onPick(t);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Move to a folder or under a page…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup heading="Folders">
          <CommandItem value="unfiled" onSelect={() => pick({ folderId: null })}>
            <Inbox className="mr-2 h-4 w-4" /> Unfiled
          </CommandItem>
          {folders.map((f) => (
            <CommandItem
              key={f.id}
              value={`folder ${folderPath(folders, f.id).map((x) => x.name).join(' / ')}`}
              onSelect={() => pick({ folderId: f.id })}
            >
              <Folder className="mr-2 h-4 w-4 text-primary" />
              {folderPath(folders, f.id).map((x) => x.name).join(' / ')}
            </CommandItem>
          ))}
        </CommandGroup>
        {pages.length > 0 && (
          <CommandGroup heading="Make it a sub-page of">
            {pages.map((p) => (
              <CommandItem key={p.id} value={`page ${p.title} ${p.id}`} onSelect={() => pick({ parentPageId: p.id })}>
                <FileText className="mr-2 h-4 w-4" />
                {p.title || 'Untitled'}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
