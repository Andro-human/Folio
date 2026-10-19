import { useState } from 'react';
import { LogOut, Moon, Plus, Sun, SunMoon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader, ScreenTitle, SectionTitle } from '@/components/layout/PageHeader';
import { PromptDialog } from '@/components/notes/PromptDialog';
import { useAuth } from '@/hooks/useAuth';
import { useTheme, type ThemePreference } from '@/hooks/useTheme';
import { useCreateList, useDeleteList, useLists, useUpdateList, listColorVar, LIST_COLORS } from '@/data/lists';
import { cn } from '@/lib/utils';

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'night', label: 'Dark', icon: Moon },
  { value: 'day', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: SunMoon },
];

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { preference, setPreference } = useTheme();
  const { data: lists = [] } = useLists();
  const createList = useCreateList();
  const updateList = useUpdateList();
  const deleteList = useDeleteList();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  return (
    <>
      <PageHeader back />
      <PageBody>
        <ScreenTitle>Settings</ScreenTitle>

        <section className="mb-9">
          <SectionTitle>Appearance</SectionTitle>
          <div className="inline-flex rounded-lg border border-border p-1">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setPreference(t.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm',
                  preference === t.value ? 'bg-muted text-foreground' : 'text-muted-foreground',
                )}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-9">
          <SectionTitle
            right={
              <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Plus className="h-3.5 w-3.5" /> Add list
              </button>
            }
          >
            Task lists
          </SectionTitle>
          <div>
            {lists.map((l) => (
              <div key={l.id} className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0">
                <button
                  type="button"
                  aria-label="Change colour"
                  onClick={() => {
                    const next = LIST_COLORS[(LIST_COLORS.indexOf(l.color as (typeof LIST_COLORS)[number]) + 1) % LIST_COLORS.length];
                    updateList.mutate({ id: l.id, color: next });
                  }}
                  className="h-3.5 w-3.5 rounded-full ring-offset-2 ring-offset-background hover:ring-1 hover:ring-border"
                  style={{ background: listColorVar(l.color) }}
                />
                <button type="button" onClick={() => setRenaming({ id: l.id, name: l.name })} className="flex-1 text-left">
                  {l.name}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${l.name}`}
                  onClick={() => {
                    if (!confirm(`Delete the list “${l.name}”? Its tasks stay, without a list.`)) return;
                    deleteList.mutate(l.id, { onError: () => toast.error("Couldn't delete the list") });
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Tap a dot to change its colour, a name to rename it.</p>
        </section>

        <section className="mb-9">
          <SectionTitle>Account</SectionTitle>
          <p className="mb-3 text-sm text-muted-foreground">{user?.email}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </section>

        <section>
          <SectionTitle>Quick syntax</SectionTitle>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p>
              <span className="font-mono text-foreground">tomorrow 5pm</span>, <span className="font-mono text-foreground">fri</span>,{' '}
              <span className="font-mono text-foreground">12 nov</span> — deadline
            </p>
            <p>
              <span className="font-mono text-foreground">#work</span> — list · <span className="font-mono text-foreground">!high</span>{' '}
              <span className="font-mono text-foreground">!low</span> — priority
            </p>
            <p>
              <span className="font-mono text-foreground">every monday</span>, <span className="font-mono text-foreground">every month</span> — repeat
            </p>
          </div>
        </section>
      </PageBody>

      <PromptDialog
        open={adding}
        title="New list"
        placeholder="List name"
        confirm="Create"
        onOpenChange={setAdding}
        onSubmit={(name) => createList.mutate(name)}
      />
      <PromptDialog
        open={!!renaming}
        title="Rename list"
        initial={renaming?.name}
        onOpenChange={(o) => !o && setRenaming(null)}
        onSubmit={(name) => renaming && updateList.mutate({ id: renaming.id, name })}
      />
    </>
  );
}
