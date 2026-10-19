import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

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

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="safe-top sticky top-0 z-40 border-b border-warning/30 bg-warning/10 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-2 text-sm text-warning">
        <WifiOff className="h-4 w-4" />
        You're offline. Notes load again when you're back online.
      </div>
    </div>
  );
}
