import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';
import { CaptureContext, type CaptureKind } from './capture';
import { CaptureSheet } from '@/components/capture/CaptureSheet';

export function AppShell() {
  const [capture, setCapture] = useState<{ open: boolean; kind: CaptureKind }>({ open: false, kind: 'task' });
  const keyboardProxy = useRef<HTMLInputElement>(null);
  const openCapture = useCallback((kind: CaptureKind = 'task') => {
    // iOS only raises the keyboard for a focus inside the tap itself; the sheet's
    // field mounts later, so a hidden field takes focus now and hands it over.
    keyboardProxy.current?.focus({ preventScroll: true });
    setCapture({ open: true, kind });
  }, []);
  const ctx = useMemo(() => ({ openCapture }), [openCapture]);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCapture('task');
      } else if (!typing && !e.metaKey && !e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        openCapture('task');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openCapture]);

  return (
    <CaptureContext.Provider value={ctx}>
      <div className="bg-grain min-h-dvh bg-background md:flex">
        <Sidebar />
        <main className="relative z-10 min-w-0 flex-1 pb-32 md:pb-16">
          <OfflineBanner />
          <Outlet />
        </main>
        <BottomNav />
      </div>
      <input
        ref={keyboardProxy}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        style={{ fontSize: 16 }}
      />
      <CaptureSheet
        open={capture.open}
        kind={capture.kind}
        onOpenChange={(open) => setCapture((c) => ({ ...c, open }))}
      />
    </CaptureContext.Provider>
  );
}
