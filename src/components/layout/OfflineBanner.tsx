import { useEffect, useRef, useState } from 'react';
import { CloudUpload, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { flushOutbox, useOutbox } from '@/data/outbox';

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/**
 * Sends queued captures on start, on reconnect, when the app comes back to the
 * foreground (iOS has no background sync for PWAs) and every 30s while any wait.
 */
export function useOutboxSync() {
  const pending = useOutbox().length;
  const wasOffline = useRef(!navigator.onLine);

  useEffect(() => {
    const sync = async (announce: boolean) => {
      const { sent } = await flushOutbox();
      if (announce && sent) toast(`Synced ${sent} capture${sent === 1 ? '' : 's'}`);
    };
    const onOnline = () => {
      void sync(wasOffline.current);
      wasOffline.current = false;
    };
    const onOffline = () => {
      wasOffline.current = true;
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync(true);
    };
    void sync(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => void flushOutbox(), 30_000);
    return () => clearInterval(t);
  }, [pending]);
}

export function OfflineBanner() {
  const online = useOnline();
  const pending = useOutbox().length;
  if (online && !pending) return null;

  const waiting = `${pending} capture${pending === 1 ? '' : 's'} waiting to sync`;
  return (
    <div className="safe-top sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-2 text-[13px]">
        {online ? (
          <>
            <CloudUpload className="h-4 w-4 text-primary" />
            <span className="flex-1">{waiting}</span>
            <button type="button" onClick={() => void flushOutbox()} className="font-medium text-primary">
              Retry
            </button>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-warning" />
            <span className="flex-1">
              You’re offline. Quick capture still works{pending ? ` · ${waiting}` : ''}.
            </span>
          </>
        )}
      </div>
    </div>
  );
}
