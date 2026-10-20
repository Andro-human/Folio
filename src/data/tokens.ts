import { useQuery } from '@tanstack/react-query';
import { queryClient, supabase, unwrap } from './client';

export const CAPTURE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/capture`;

const tokensKey = ['tokens'] as const;

export function useApiTokens() {
  return useQuery({
    queryKey: tokensKey,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('api_tokens')
          .select('id, name, scope, token_hint, created_at, last_used_at')
          .is('revoked_at', null)
          .order('created_at', { ascending: false }),
      ),
  });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Returns the plaintext token — the only time it exists outside the caller's device. */
export async function createApiToken(name: string, scope: 'capture' | 'mcp' = 'capture'): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = `nt_${btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
  unwrap(
    await supabase.from('api_tokens').insert({
      name,
      scope,
      token_hash: await sha256Hex(token),
      token_hint: token.slice(-4),
    }),
  );
  queryClient.invalidateQueries({ queryKey: tokensKey });
  return token;
}

export async function revokeApiToken(id: string) {
  unwrap(await supabase.from('api_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id));
  queryClient.invalidateQueries({ queryKey: tokensKey });
}
