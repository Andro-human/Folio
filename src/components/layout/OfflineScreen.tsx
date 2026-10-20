import { CheckCircle2, Minus, Plus, WifiOff } from 'lucide-react';
import { format } from 'date-fns';
import { useOutbox } from '@/data/outbox';
import { useCapture } from './capture';
import { PageBody } from './PageHeader';

/** Shown instead of a screen opened while offline: existing notes aren't kept on the device. */
export function OfflineScreen() {
  const { openCapture } = useCapture();
  const pending = useOutbox();

  return (
    <PageBody className="pt-16 md:pt-24">
      <div className="mx-auto max-w-sm text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-muted">
          <WifiOff className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">You’re offline</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Your notes load again when you’re back online. New tasks and notes are saved on this device and sync then.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => openCapture('task')}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> New task
          </button>
          <button
            type="button"
            onClick={() => openCapture('note')}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-muted px-4 text-sm font-medium"
          >
            <Minus className="h-4 w-4" /> New note
          </button>
        </div>
      </div>

      {pending.length > 0 && (
        <section className="mx-auto mt-10 max-w-md">
          <h2 className="mb-2 text-[13px] font-semibold text-muted-foreground">Waiting to sync · {pending.length}</h2>
          <div className="rounded-xl bg-card px-4">
            {pending.map((item) => (
              <div key={item.id} className="flex items-start gap-3 border-b border-border/60 py-3 last:border-0">
                {item.kind === 'task' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 text-[15px]">{item.text}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{format(new Date(item.capturedAt), 'HH:mm')}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </PageBody>
  );
}
