import { useState } from 'react';
import { Bell, Share } from 'lucide-react';
import { toast } from 'sonner';
import { SectionTitle } from '@/components/layout/PageHeader';
import { Switch } from '@/components/ui/switch';
import { sendTestPush, usePush } from '@/data/push';

export function RemindersSection() {
  const { state, enable, disable } = usePush();
  const [busy, setBusy] = useState(false);

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        if (await enable()) toast('Reminders are on for this device');
      } else {
        await disable();
      }
    } catch {
      toast.error(on ? "Couldn't turn reminders on" : "Couldn't turn reminders off");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-9">
      <SectionTitle>Reminders</SectionTitle>
      <p className="mb-3 text-sm text-muted-foreground">
        Tasks with a time notify you when they’re due. Turn this on for each device you want them on.
      </p>

      {state === 'needs-install' ? (
        <div className="rounded-xl bg-card px-4 py-3 text-[15px]">
          <p>On iPhone, reminders work from the Home Screen app.</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            In Safari tap <Share className="h-3.5 w-3.5" /> then <span className="font-medium text-foreground">Add to Home Screen</span>, and
            open Folio from there.
          </p>
        </div>
      ) : state === 'unsupported' ? (
        <p className="rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground">This browser can’t show notifications.</p>
      ) : state === 'denied' ? (
        <p className="rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground">
          Notifications are blocked for Folio. Allow them in your iPhone’s Settings → Notifications → Folio, or in this browser’s
          site settings, then come back.
        </p>
      ) : (
        <div className="rounded-xl bg-card px-4">
          <label className="flex items-center gap-3 py-3">
            <Bell className="h-5 w-5 text-primary" />
            <span className="flex-1 text-[15px]">Reminders on this device</span>
            <Switch checked={state === 'on'} disabled={state === 'loading' || busy} onCheckedChange={(on) => void toggle(on)} />
          </label>
          {state === 'on' && (
            <button
              type="button"
              onClick={() =>
                sendTestPush()
                  .then((n) => toast(n ? `Sent to ${n} device${n === 1 ? '' : 's'}` : 'No devices to send to'))
                  .catch(() => toast.error("Couldn't send a test"))
              }
              className="w-full border-t border-border/60 py-3 text-left text-[15px] text-primary"
            >
              Send a test notification
            </button>
          )}
        </div>
      )}
    </section>
  );
}
