import { useState } from 'react';
import { CalendarClock, Check, Copy, KeyRound, Mic, Plus, Share, Smartphone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { SectionTitle } from '@/components/layout/PageHeader';
import { PromptDialog } from '@/components/notes/PromptDialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CAPTURE_URL, TODAY_URL, createApiToken, revokeApiToken, useApiTokens } from '@/data/tokens';
import { relativeDayLabel } from '@/lib/dates';

export function ShortcutsSection() {
  const { data, isError } = useApiTokens();
  const tokens = (data ?? []).filter((t) => t.scope === 'capture');
  const [naming, setNaming] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);

  return (
    <section className="mb-9">
      <SectionTitle
        right={
          <button type="button" onClick={() => setNaming(true)} className="inline-flex items-center gap-1 text-[13px] text-primary">
            <Plus className="h-3.5 w-3.5" /> New token
          </button>
        }
      >
        Siri & Shortcuts
      </SectionTitle>
      <p className="mb-3 text-sm text-muted-foreground">
        A token lets iPhone Shortcuts add tasks and notes and read out your day — “Hey Siri, add task”. Make one per device; revoke it if a device is lost.
      </p>

      {isError ? (
        <p className="rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground">Siri capture isn’t set up on the server yet.</p>
      ) : tokens.length === 0 ? (
        <button
          type="button"
          onClick={() => setNaming(true)}
          className="flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3 text-left text-[15px]"
        >
          <Mic className="h-5 w-5 text-primary" />
          Set up Siri capture
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
                  aria-label={`Revoke ${t.name}`}
                  onClick={() => {
                    if (!confirm(`Revoke “${t.name}”? Shortcuts using it stop working.`)) return;
                    revokeApiToken(t.id).catch(() => toast.error("Couldn't revoke the token"));
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
        </div>
      )}

      <PromptDialog
        open={naming}
        title="Name this token"
        initial="iPhone"
        placeholder="e.g. iPhone"
        confirm="Create"
        onOpenChange={setNaming}
        onSubmit={async (name) => {
          try {
            setFresh(await createApiToken(name));
          } catch {
            toast.error("Couldn't create the token");
          }
        }}
      />
      <SetupDialog token={fresh} onClose={() => setFresh(null)} />
    </section>
  );
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="flex w-full items-center gap-2 rounded-lg bg-muted px-3 py-2 text-left"
      >
        <code className="min-w-0 flex-1 break-all font-mono text-[12px]">{value}</code>
        {copied ? <Check className="h-4 w-4 shrink-0 text-success" /> : <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
    </div>
  );
}

export function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
        {n}
      </span>
      <div className="min-w-0 flex-1 text-[14px] leading-relaxed">{children}</div>
    </li>
  );
}

export const B = ({ children }: { children: React.ReactNode }) => <span className="font-semibold">{children}</span>;

function Recipe({ icon, name, children }: { icon: React.ReactNode; name: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
        {icon} {name}
      </div>
      <ol className="space-y-3">{children}</ol>
    </div>
  );
}

/** The request half every Folio shortcut shares. */
const Request = ({ url, method, body }: { url: string; method: 'POST' | 'GET'; body?: React.ReactNode }) => (
  <>
    Add <B>Get Contents of URL</B> and paste the <B>{url}</B> above. Tap <B>Show More</B>: Method <B>{method}</B>, and under Headers add{' '}
    <B>Authorization</B> with the header value.{body}
  </>
);

function SetupDialog({ token, onClose }: { token: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!token} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogTitle className="text-xl">Set up Siri &amp; Shortcuts</DialogTitle>
        {token && (
          <div className="space-y-6">
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-[13px] text-warning">
              Copy the header value now — it won’t be shown again. All three shortcuts use it.
            </p>
            <div className="space-y-3">
              <CopyField label="Capture URL" value={CAPTURE_URL} />
              <CopyField label="Today URL" value={TODAY_URL} />
              <CopyField label="Authorization header value" value={`Bearer ${token}`} />
            </div>
            <p className="text-[14px] text-muted-foreground">
              In the <span className="text-foreground">Shortcuts</span> app, tap <B>+</B> for each shortcut. Its name is what you say to Siri.
            </p>

            <Recipe icon={<Mic className="h-4 w-4 text-primary" />} name="Add task">
              <Step n={1}>
                Add <B>Dictate Text</B>.
              </Step>
              <Step n={2}>
                <Request
                  url="Capture URL"
                  method="POST"
                  body={
                    <>
                      {' '}Request Body <B>JSON</B> with <B>text</B> = <i>Dictated Text</i> and <B>kind</B> = <B>task</B>.
                    </>
                  }
                />
              </Step>
              <Step n={3}>
                Add <B>Speak Text</B> with <i>Contents of URL</i>, so Siri reads back what was added.
              </Step>
              <Step n={4}>
                Say <B>“Hey Siri, add task”</B>, then e.g. “call the bank tomorrow at 5, work, important”.
              </Step>
            </Recipe>

            <Recipe icon={<Share className="h-4 w-4 text-primary" />} name="Add note (also in the Share sheet)">
              <Step n={1}>
                Tap <B>ⓘ</B> and turn on <B>Show in Share Sheet</B>. In the box that appears at the top, set it to receive <B>Text</B> and{' '}
                <B>URLs</B>, and <i>If there’s no input</i> to <B>Ask For Text</B>.
              </Step>
              <Step n={2}>
                <Request
                  url="Capture URL"
                  method="POST"
                  body={
                    <>
                      {' '}Request Body <B>JSON</B> with <B>text</B> = <i>Shortcut Input</i> and <B>kind</B> = <B>note</B>.
                    </>
                  }
                />
              </Step>
              <Step n={3}>
                Add <B>Speak Text</B> with <i>Contents of URL</i>.
              </Step>
              <Step n={4}>
                “Hey Siri, add note” asks what to write; or share a link or text from any app and pick <B>Add note</B>. It lands in
                today’s jot with the time.
              </Step>
            </Recipe>

            <Recipe icon={<CalendarClock className="h-4 w-4 text-primary" />} name="What’s on today">
              <Step n={1}>
                <Request url="Today URL" method="GET" />
              </Step>
              <Step n={2}>
                Add <B>Speak Text</B> with <i>Contents of URL</i>.
              </Step>
              <Step n={3}>
                “Hey Siri, what’s on today” reads what’s left on your schedule, then tasks due today and overdue.
              </Step>
            </Recipe>

            <Recipe icon={<Smartphone className="h-4 w-4 text-primary" />} name="Action Button">
              <Step n={1}>
                In the iPhone’s <B>Settings → Action Button</B>, swipe to <B>Shortcut</B> and pick <B>Add task</B>. Press and hold the
                side button, then speak.
              </Step>
            </Recipe>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
