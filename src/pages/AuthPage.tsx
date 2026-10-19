import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error: err } = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (err) setError(err.message);
    else if (mode === 'signup') setInfo('Check your inbox to confirm your email, then sign in.');
  };

  return (
    <div className="bg-grain flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="relative z-10 w-full max-w-sm">
        <h1 className="mb-1 text-4xl">
          Notes<span className="text-primary">.</span>
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">Jots, notes and tasks in one place.</p>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="h-11 w-full rounded-md border border-border bg-card px-3 outline-none focus:border-muted-foreground/60"
          />
          <input
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="h-11 w-full rounded-md border border-border bg-card px-3 outline-none focus:border-muted-foreground/60"
          />
          {error && <p className="text-sm text-primary">{error}</p>}
          {info && <p className="text-sm text-gold">{info}</p>}
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-md bg-primary font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setInfo(null);
          }}
          className="mt-5 text-sm text-muted-foreground underline underline-offset-4"
        >
          {mode === 'signin' ? 'First time? Create your account' : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
