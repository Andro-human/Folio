import { useCallback, useEffect, useState } from 'react';

/** What the user picked. 'system' follows the OS and keeps following it. */
export type ThemePreference = 'night' | 'day' | 'system';
/** What is actually painted. 'system' always resolves to one of these. */
export type PaperTheme = 'night' | 'day';

const STORAGE_KEY = 'notes-theme';
const CHANGE_EVENT = 'notes-theme-change';
const THEME_COLOR: Record<PaperTheme, string> = {
  night: '#151210',
  day: '#F6F0E4',
};

const prefersLight = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches;

export function resolveTheme(pref: ThemePreference): PaperTheme {
  if (pref === 'system') return prefersLight() ? 'day' : 'night';
  return pref;
}

export function readStoredPreference(): ThemePreference {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // private mode / blocked storage
  }
  return raw === 'day' || raw === 'night' || raw === 'system' ? raw : 'system';
}

export function applyTheme(theme: PaperTheme) {
  document.documentElement.classList.toggle('day', theme === 'day');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[theme]);
}

export function initTheme() {
  applyTheme(resolveTheme(readStoredPreference()));
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [theme, setResolved] = useState<PaperTheme>(() => resolveTheme(readStoredPreference()));

  useEffect(() => {
    const sync = () => setPreferenceState(readStoredPreference());
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  useEffect(() => {
    const resolved = resolveTheme(preference);
    setResolved(resolved);
    applyTheme(resolved);

    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      const next = resolveTheme('system');
      setResolved(next);
      applyTheme(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // still applies for this session
    }
    setPreferenceState(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { theme, preference, setPreference } as const;
}
