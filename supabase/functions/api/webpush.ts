// Web Push with VAPID (RFC 8292) and aes128gcm payload encryption (RFC 8291), on WebCrypto only.
// Ported from MT-Wallet's send-reminder-push, where it runs against Apple, Google and Mozilla.

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface Vapid {
  publicKey: string;
  privateKey: string;
  subject: string;
}

const enc = new TextEncoder();

const b64url = (data: Uint8Array) =>
  btoa(String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const buf = (a: Uint8Array) => a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength) as ArrayBuffer;

async function vapidHeader(endpoint: string, v: Vapid): Promise<string> {
  const { protocol, host } = new URL(endpoint);
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(
    enc.encode(JSON.stringify({ aud: `${protocol}//${host}`, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: v.subject })),
  );
  const pub = fromB64url(v.publicKey);
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), d: v.privateKey, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, buf(enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64url(new Uint8Array(sig))}, k=${v.publicKey}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: buf(salt), info: buf(info) }, key, length * 8);
  return new Uint8Array(bits);
}

async function encrypt(target: PushTarget, payload: Uint8Array): Promise<Uint8Array> {
  const clientPub = fromB64url(target.p256dh);
  const server = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPub = new Uint8Array(await crypto.subtle.exportKey('raw', server.publicKey));
  const clientKey = await crypto.subtle.importKey('raw', buf(clientPub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, server.privateKey, 256));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(fromB64url(target.auth), shared, concat(enc.encode('WebPush: info\0'), clientPub, serverPub), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', buf(cek), 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(nonce) }, aes, buf(concat(payload, new Uint8Array([2])))),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([serverPub.length]), serverPub, sealed);
}

/** Resolves with the push service's status; 404/410 mean the subscription is gone and should be deleted. */
export async function sendPush(target: PushTarget, payload: unknown, vapid: Vapid): Promise<number> {
  const body = await encrypt(target, enc.encode(JSON.stringify(payload)));
  const res = await fetch(target.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(target.endpoint, vapid),
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      // A reminder that arrives a day late is noise.
      TTL: '3600',
      Urgency: 'high',
    },
    body: buf(body),
  });
  await res.body?.cancel();
  return res.status;
}
