import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendPush } from './webpush.ts';

const b64url = (b: Uint8Array) => Buffer.from(b).toString('base64url');
const raw = async (k: CryptoKey) => new Uint8Array(await crypto.subtle.exportKey('raw', k));

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: string | Uint8Array, len: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const infoBytes = typeof info === 'string' ? new TextEncoder().encode(info) : info;
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: infoBytes }, key, len * 8));
}

afterEach(() => vi.unstubAllGlobals());

describe('sendPush', () => {
  it('encrypts so the browser can decrypt (RFC 8291) and signs a VAPID JWT the push service can verify', async () => {
    // The "browser": its subscription keys.
    const client = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const clientPub = await raw(client.publicKey);
    const authSecret = crypto.getRandomValues(new Uint8Array(16));

    // The server's VAPID pair.
    const vapidPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const vapidPub = await raw(vapidPair.publicKey);
    const vapidJwk = await crypto.subtle.exportKey('jwk', vapidPair.privateKey);

    let sent: { headers: Record<string, string>; body: ArrayBuffer } | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { headers: Record<string, string>; body: ArrayBuffer }) => {
        sent = init;
        return new Response(null, { status: 201 });
      }),
    );

    const payload = { title: 'call the bank', body: 'Due today, 5:00 pm', url: '/p/1', tag: '1' };
    const status = await sendPush(
      { endpoint: 'https://web.push.apple.com/abc', p256dh: b64url(clientPub), auth: b64url(authSecret) },
      payload,
      { publicKey: b64url(vapidPub), privateKey: vapidJwk.d!, subject: 'https://folio.animeshsinha.dev' },
    );
    expect(status).toBe(201);
    expect(sent!.headers['Content-Encoding']).toBe('aes128gcm');

    // Decrypt like a browser does.
    const body = new Uint8Array(sent!.body);
    const salt = body.slice(0, 16);
    const idlen = body[20];
    const serverPub = body.slice(21, 21 + idlen);
    const sealed = body.slice(21 + idlen);
    const serverKey = await crypto.subtle.importKey('raw', serverPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: serverKey }, client.privateKey, 256));
    const info = new Uint8Array([...new TextEncoder().encode('WebPush: info\0'), ...clientPub, ...serverPub]);
    const ikm = await hkdf(authSecret, shared, info, 32);
    const cek = await hkdf(salt, ikm, 'Content-Encoding: aes128gcm\0', 16);
    const nonce = await hkdf(salt, ikm, 'Content-Encoding: nonce\0', 12);
    const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, sealed));
    expect(plain.at(-1)).toBe(2); // last-record padding delimiter
    expect(JSON.parse(new TextDecoder().decode(plain.slice(0, -1)))).toEqual(payload);

    // Verify the VAPID header like the push service does.
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(sent!.headers.Authorization)!;
    expect(m[4]).toBe(b64url(vapidPub));
    const claims = JSON.parse(Buffer.from(m[2], 'base64url').toString());
    expect(claims).toMatchObject({ aud: 'https://web.push.apple.com', sub: 'https://folio.animeshsinha.dev' });
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      vapidPair.publicKey,
      Buffer.from(m[3], 'base64url'),
      new TextEncoder().encode(`${m[1]}.${m[2]}`),
    );
    expect(ok).toBe(true);
  });
});
