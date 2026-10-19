import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

/** A new build is waiting: ask before swapping it in, so nothing unsaved is lost. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast('A new version is ready', {
      duration: Infinity,
      action: { label: 'Reload', onClick: () => updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
