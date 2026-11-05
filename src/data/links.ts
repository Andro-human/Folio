import { supabase } from './client';

export interface LinkPreview {
  url: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site: string | null;
  icon: string | null;
}

/** Title, description and image for a link, read by the server (browsers can't fetch other sites' pages). */
export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/link/preview?${new URLSearchParams({ url })}`, {
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
  });
  if (!res.ok) throw new Error(`preview ${res.status}`);
  return res.json();
}
