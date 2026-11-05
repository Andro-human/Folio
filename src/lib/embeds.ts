// Links that can play or render inline, and the iframe each one becomes.
// Only these hosts are ever framed, whatever a saved doc says.

export interface Embed {
  provider: string;
  src: string;
  /** width / height; when absent the frame uses `height`. */
  aspect?: number;
  height?: number;
}

const parse = (raw: string): URL | null => {
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
};

const host = (u: URL) => u.hostname.replace(/^www\./, '').replace(/^m\./, '');

/** "1h2m3s", "90" or "90s" → seconds. */
function seconds(t: string | null): number | null {
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (!m || !m[0]) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function youtube(u: URL): Embed | null {
  const h = host(u);
  let id: string | null = null;
  if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (h === 'youtube.com' || h === 'music.youtube.com' || h === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else id = /^\/(?:shorts|embed|live)\/([^/?#]+)/.exec(u.pathname)?.[1] ?? null;
  }
  if (!id || !/^[\w-]{6,}$/.test(id)) return null;
  const start = seconds(u.searchParams.get('t') ?? u.searchParams.get('start'));
  return {
    provider: 'YouTube',
    src: `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}`,
    aspect: 16 / 9,
  };
}

function vimeo(u: URL): Embed | null {
  const h = host(u);
  const m =
    h === 'vimeo.com'
      ? /^\/(\d+)(?:\/([\da-f]+))?/.exec(u.pathname)
      : h === 'player.vimeo.com'
        ? /^\/video\/(\d+)/.exec(u.pathname)
        : null;
  if (!m) return null;
  const hash = m[2] ?? u.searchParams.get('h');
  return { provider: 'Vimeo', src: `https://player.vimeo.com/video/${m[1]}${hash ? `?h=${hash}` : ''}`, aspect: 16 / 9 };
}

function googleMaps(u: URL): Embed | null {
  const h = host(u);
  if (h !== 'maps.google.com' && !(/^google\.[a-z.]+$/.test(h) && u.pathname.startsWith('/maps'))) return null;
  const at = /@(-?\d+\.\d+),(-?\d+\.\d+)(?:,(\d+(?:\.\d+)?)z)?/.exec(u.pathname);
  const zoom = at?.[3] ? Math.round(Number(at[3])) : 15;
  const out = (params: Record<string, string>) =>
    `https://maps.google.com/maps?${new URLSearchParams({ ...params, z: String(zoom), output: 'embed' })}`;
  const seg = (re: RegExp) => {
    const m = re.exec(u.pathname);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
  };

  const dir = /^\/maps\/dir\/([^/@]+)\/([^/@]+)/.exec(u.pathname);
  if (dir) {
    const d = (s: string) => decodeURIComponent(s.replace(/\+/g, ' '));
    return { provider: 'Google Maps', src: out({ saddr: d(dir[1]), daddr: d(dir[2]) }), height: 360 };
  }
  const q =
    seg(/^\/maps\/place\/([^/]+)/) ??
    seg(/^\/maps\/search\/([^/@]+)/) ??
    u.searchParams.get('q') ??
    u.searchParams.get('query') ??
    (at ? `${at[1]},${at[2]}` : null);
  if (!q) return null;
  return { provider: 'Google Maps', src: out({ q }), height: 360 };
}

/** maps.app.goo.gl and goo.gl/maps links only become embeddable once the server follows them. */
export function isShortMapsLink(raw: string): boolean {
  const u = parse(raw);
  return !!u && (host(u) === 'maps.app.goo.gl' || (host(u) === 'goo.gl' && u.pathname.startsWith('/maps')));
}

function spotify(u: URL): Embed | null {
  if (host(u) !== 'open.spotify.com') return null;
  const m = /^\/(?:intl-[\w-]+\/)?(?:embed\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/.exec(u.pathname);
  if (!m) return null;
  return { provider: 'Spotify', src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: m[1] === 'track' || m[1] === 'episode' ? 152 : 352 };
}

function appleMusic(u: URL): Embed | null {
  if (host(u) !== 'music.apple.com' && host(u) !== 'embed.music.apple.com') return null;
  if (!/^\/[a-z]{2}\/(album|playlist|song|music-video|station)\//.test(u.pathname)) return null;
  const single = u.pathname.includes('/song/') || u.searchParams.has('i');
  return { provider: 'Apple Music', src: `https://embed.music.apple.com${u.pathname}${u.search}`, height: single ? 175 : 450 };
}

function figma(u: URL): Embed | null {
  if (host(u) !== 'figma.com' || !/^\/(file|design|proto|board|slides)\//.test(u.pathname)) return null;
  return {
    provider: 'Figma',
    src: `https://www.figma.com/embed?embed_host=folio&url=${encodeURIComponent(u.href)}`,
    height: 450,
  };
}

function loom(u: URL): Embed | null {
  if (host(u) !== 'loom.com') return null;
  const id = /^\/(?:share|embed)\/([\da-f]{16,})/.exec(u.pathname)?.[1];
  return id ? { provider: 'Loom', src: `https://www.loom.com/embed/${id}`, aspect: 16 / 9 } : null;
}

function googleDocs(u: URL): Embed | null {
  if (host(u) !== 'docs.google.com') return null;
  const form = /^\/forms\/d\/e\/([\w-]+)/.exec(u.pathname);
  if (form) return { provider: 'Google Forms', src: `https://docs.google.com/forms/d/e/${form[1]}/viewform?embedded=true`, height: 600 };
  const m = /^\/(document|spreadsheets|presentation)\/d\/([\w-]+)/.exec(u.pathname);
  if (!m) return null;
  if (m[1] === 'presentation') {
    return { provider: 'Google Slides', src: `https://docs.google.com/presentation/d/${m[2]}/embed`, aspect: 16 / 9 };
  }
  return {
    provider: m[1] === 'document' ? 'Google Docs' : 'Google Sheets',
    src: `https://docs.google.com/${m[1]}/d/${m[2]}/preview`,
    height: 520,
  };
}

const PROVIDERS = [youtube, vimeo, googleMaps, spotify, appleMusic, figma, loom, googleDocs];

export function toEmbed(raw: string): Embed | null {
  const u = parse(raw);
  if (!u) return null;
  for (const p of PROVIDERS) {
    const e = p(u);
    if (e) return e;
  }
  return null;
}

/** True when the link can become an embed, now or after the server resolves a short link. */
export function canEmbed(raw: string): boolean {
  return !!toEmbed(raw) || isShortMapsLink(raw);
}

/** A single http(s) link and nothing else, as pasted. */
export function soleUrl(text: string): string | null {
  const t = text.trim();
  return /^https?:\/\/\S+$/i.test(t) && parse(t) ? t : null;
}

export function domainOf(raw: string): string {
  const u = parse(raw);
  return u ? u.hostname.replace(/^www\./, '') : raw;
}
