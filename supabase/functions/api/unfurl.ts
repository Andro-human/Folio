// Link previews: fetch a page's head and read its Open Graph / Twitter / HTML meta.

export interface Preview {
  url: string;
  /** Where the link ended up after redirects (resolves maps.app.goo.gl and friends). */
  finalUrl: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site: string | null;
  icon: string | null;
}

const MAX_BYTES = 512 * 1024;
const MAX_HOPS = 5;

/** Loopback, private, link-local and other addresses a preview must never reach. */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(':')) return h === '::' || h === '::1' || /^f[cd]/.test(h) || h.startsWith('fe80') || h.startsWith('::ffff:');
  return false;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(s: string): string {
  return s
    .replace(/&#x([\da-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

const absolute = (href: string | undefined, base: string) => {
  if (!href) return null;
  try {
    const u = new URL(decode(href), base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
};

export function parseMeta(html: string, base: string): Omit<Preview, 'url' | 'finalUrl'> {
  const end = html.search(/<\/head>/i);
  const head = end > 0 ? html.slice(0, end) : html;
  const meta = new Map<string, string>();
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property ?? a.name ?? a.itemprop)?.toLowerCase();
    if (key && a.content && !meta.has(key)) meta.set(key, decode(a.content));
  }
  let icon: string | null = null;
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const rel = a.rel?.toLowerCase() ?? '';
    if (/\b(icon|apple-touch-icon)\b/.test(rel)) {
      icon = absolute(a.href, base);
      if (rel.includes('apple-touch-icon')) break;
    }
  }
  const titleTag = /<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1];
  const pick = (...keys: string[]) => keys.map((k) => meta.get(k)).find((v) => v) ?? null;

  return {
    title: pick('og:title', 'twitter:title') ?? (titleTag ? decode(titleTag) || null : null),
    description: pick('og:description', 'twitter:description', 'description'),
    image: absolute(pick('og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src') ?? undefined, base),
    site: pick('og:site_name', 'application-name'),
    icon: icon ?? absolute('/favicon.ico', base),
  };
}

/** Follows redirects by hand so every hop is checked against private addresses. */
export async function fetchPreview(raw: string): Promise<Preview> {
  let url = new URL(raw);
  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || isPrivateHost(url.hostname)) throw new Error('blocked');
    res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; FolioBot/1.0; +https://folio.animeshsinha.dev)',
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'accept-language': 'en',
      },
    });
    const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (!next) break;
    await res.body?.cancel();
    url = new URL(next, url);
  }
  const finalUrl = url.href;
  const empty = { title: null, description: null, image: null, site: null, icon: absolute('/favicon.ico', finalUrl) };
  if (!res || !res.ok || !(res.headers.get('content-type') ?? '').includes('html')) {
    await res?.body?.cancel();
    return { url: raw, finalUrl, ...empty };
  }

  // Read just enough of the page for its <head>.
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (new TextDecoder().decode(value).includes('</head>')) break;
  }
  await reader.cancel();
  const html = new TextDecoder().decode(concat(chunks));
  return { url: raw, finalUrl, ...parseMeta(html, finalUrl) };
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
