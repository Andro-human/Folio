import { useCallback, useEffect, useState } from 'react';
import { supabase, unwrap } from './client';

/** Public half of the VAPID pair; the private half lives only in the Edge Function's secrets. */
const VAPID_PUBLIC_KEY = 'BPfTQ1psMhjgJ8--TSZ9Obb4xBxbDSCLCaNfvfJSwyRcn7NrQC5V-IqLw2HbmROs6e-HCpgmW0WAZUKYWkk6qU0';

export type PushState =
  | 'loading'
  /** iPhone/iPad in Safari: web push only works from the Home Screen app. */
  | 'needs-install'
  | 'unsupported'
  | 'denied'
  | 'off'
  | 'on';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

function keyBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** The registration, or null when there's no service worker (dev server), where `ready` would hang. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

async function save(sub: PushSubscription) {
  const json = sub.toJSON();
  unwrap(
    await supabase.rpc('register_push', {
      p_endpoint: sub.endpoint,
      p_p256dh: json.keys!.p256dh,
      p_auth: json.keys!.auth,
      p_user_agent: navigator.userAgent,
    }),
  );
}

/** Reminders on this device: state plus enable/disable. */
export function usePush() {
  const [state, setState] = useState<PushState>('loading');

  const refresh = useCallback(async () => {
    if (isIOS() && !isStandalone()) return setState('needs-install');
    if (!('PushManager' in window) || !('Notification' in window)) return setState('unsupported');
    if (Notification.permission === 'denied') return setState('denied');
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    setState(sub && Notification.permission === 'granted' ? 'on' : 'off');
    // Re-save on every visit: cheap, and it heals a row lost to another sign-in on this device.
    if (sub && Notification.permission === 'granted') save(sub).catch(() => {});
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setState(permission === 'denied' ? 'denied' : 'off');
      return false;
    }
    const reg = await registration();
    if (!reg) throw new Error('No service worker');
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) as BufferSource }));
    await save(sub);
    setState('on');
    return true;
  }, []);

  const disable = useCallback(async () => {
    const sub = await (await registration())?.pushManager.getSubscription();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    setState('off');
  }, []);

  return { state, enable, disable };
}

/** Sends "Reminders are on" to every device of the signed-in user; resolves with how many got it. */
export async function sendTestPush(): Promise<number> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/push/test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
  });
  if (!res.ok) throw new Error(`test push ${res.status}`);
  return (await res.json()).devices as number;
}
