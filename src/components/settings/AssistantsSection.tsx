import { useState } from 'react';
import { Bot, KeyRound, Plus, Terminal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { SectionTitle } from '@/components/layout/PageHeader';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { MCP_URL, createApiToken, revokeApiToken, useApiTokens } from '@/data/tokens';
import { relativeDayLabel } from '@/lib/dates';
import { B, CopyField, Step } from './ShortcutsSection';

type App = 'Claude' | 'ChatGPT' | 'Claude Code';

const APPS: { app: App; hint: string }[] = [
  { app: 'Claude', hint: 'claude.ai, desktop and mobile' },
  { app: 'ChatGPT', hint: 'with developer mode' },
  { app: 'Claude Code', hint: 'in your terminal' },
];

/** MCP connections: each assistant gets its own token, revocable on its own. */
export function AssistantsSection() {
  const { data, isError } = useApiTokens();
  const tokens = (data ?? []).filter((t) => t.scope === 'mcp');
  const [choosing, setChoosing] = useState(false);
  const [fresh, setFresh] = useState<{ app: App; token: string } | null>(null);

  const connect = async (app: App) => {
    setChoosing(false);
    try {
      setFresh({ app, token: await createApiToken(app, 'mcp') });
    } catch {
      toast.error("Couldn't create the connection");
    }
  };

  return (
    <section className="mb-9">
      <SectionTitle
        right={
          <button type="button" onClick={() => setChoosing(true)} className="inline-flex items-center gap-1 text-[13px] text-primary">
            <Plus className="h-3.5 w-3.5" /> Connect
          </button>
        }
      >
        AI assistants
      </SectionTitle>
      <p className="mb-3 text-sm text-muted-foreground">
        Let Claude, ChatGPT or Claude Code read and add your notes, tasks and schedule. They can’t delete anything. Each app gets its
        own connection; remove it here to cut access.
      </p>

      {isError ? (
        <p className="rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground">Couldn’t load your connections.</p>
      ) : tokens.length === 0 ? (
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3 text-left text-[15px]"
        >
          <Bot className="h-5 w-5 text-primary" />
          Connect an assistant
        </button>
      ) : (
        <div className="rounded-xl bg-card px-4">
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
              <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px]">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  ••••{t.token_hint} · {t.last_used_at ? `used ${relativeDayLabel(new Date(t.last_used_at)).toLowerCase()}` : 'never used'}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Disconnect ${t.name}`}
                onClick={() => {
                  if (!confirm(`Disconnect “${t.name}”? It loses access to Folio straight away.`)) return;
                  revokeApiToken(t.id).catch(() => toast.error("Couldn't disconnect it"));
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent className="top-[25%] translate-y-0 sm:max-w-sm">
          <DialogTitle className="text-xl">Connect which app?</DialogTitle>
          <div className="space-y-2">
            {APPS.map(({ app, hint }) => (
              <button
                key={app}
                type="button"
                onClick={() => void connect(app)}
                className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left hover:bg-muted"
              >
                {app === 'Claude Code' ? <Terminal className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4 text-primary" />}
                <span className="flex-1 text-[15px]">{app}</span>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <SetupDialog fresh={fresh} onClose={() => setFresh(null)} />
    </section>
  );
}

function SetupDialog({ fresh, onClose }: { fresh: { app: App; token: string } | null; onClose: () => void }) {
  return (
    <Dialog open={!!fresh} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogTitle className="text-xl">Connect {fresh?.app}</DialogTitle>
        {fresh && (
          <div className="space-y-5">
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-[13px] text-warning">
              Copy this now — it won’t be shown again. {fresh.app === 'Claude Code' ? 'The token' : 'The link'} is the key to your Folio, so
              keep it private.
            </p>

            {fresh.app === 'Claude Code' ? (
              <>
                <CopyField
                  label="Run in a terminal"
                  value={`claude mcp add --transport http --scope user folio ${MCP_URL} --header "Authorization: Bearer ${fresh.token}"`}
                />
                <ol className="space-y-3">
                  <Step n={1}>Run the command. <B>--scope user</B> makes Folio available in every project.</Step>
                  <Step n={2}>
                    Start Claude Code and type <B>/mcp</B>: <B>folio</B> should show as connected.
                  </Step>
                  <Step n={3}>Ask e.g. “add a task to review the PR tomorrow at 11, work” or “what’s on my schedule today?”.</Step>
                </ol>
              </>
            ) : (
              <>
                <CopyField label="Connector URL" value={`${MCP_URL}/${fresh.token}`} />
                {fresh.app === 'Claude' ? (
                  <ol className="space-y-3">
                    <Step n={1}>
                      On claude.ai open <B>Settings → Connectors</B> and choose <B>Add custom connector</B>.
                    </Step>
                    <Step n={2}>
                      Name it <B>Folio</B>, paste the URL, and add it. Leave the OAuth fields empty.
                    </Step>
                    <Step n={3}>
                      It then works in the Claude apps on your phone and desktop too. In a chat, turn Folio on from the tools menu if it’s off.
                    </Step>
                  </ol>
                ) : (
                  <ol className="space-y-3">
                    <Step n={1}>
                      In ChatGPT open <B>Settings → Apps &amp; Connectors → Advanced</B> and turn on <B>Developer mode</B>.
                    </Step>
                    <Step n={2}>
                      Back in <B>Apps &amp; Connectors</B> choose <B>Create</B>. Name it <B>Folio</B>, paste the URL as the MCP server
                      URL, and set authentication to <B>No authentication</B> (the link carries the key).
                    </Step>
                    <Step n={3}>In a chat, pick Folio from the developer-mode tools before asking.</Step>
                  </ol>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
