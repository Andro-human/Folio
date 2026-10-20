import { Hono, type Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { basicParse, deadlineUtc, type Capture, type ListRef } from './parse.ts';
import { geminiParse } from './gemini.ts';
import { describeDeadline, jotTitle, zoned } from './time.ts';

// Service role: every query below must filter by the user id resolved from the token.
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const app = new Hono().basePath('/api');

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Bearer header only — tokens never travel in URLs or query strings, and are never logged. */
async function userFor(c: Context, scope: 'capture' | 'mcp'): Promise<string | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(c.req.header('authorization') ?? '');
  if (!m) return null;
  const { data } = await admin
    .from('api_tokens')
    .select('id, user_id')
    .eq('token_hash', await sha256Hex(m[1]))
    .eq('scope', scope)
    .is('revoked_at', null)
    .maybeSingle();
  if (!data) return null;
  await admin.from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
  return data.user_id;
}

async function readBody(c: Context): Promise<{ text: string; kind?: 'task' | 'note' }> {
  const type = c.req.header('content-type') ?? '';
  let text = '';
  let kind: string | undefined = c.req.query('kind');
  if (type.includes('application/json')) {
    const body = await c.req.json().catch(() => ({}));
    text = String(body.text ?? body.input ?? '');
    kind = body.kind ?? kind;
  } else if (type.includes('form')) {
    const form = await c.req.parseBody();
    text = String(form.text ?? '');
    kind = (form.kind as string | undefined) ?? kind;
  } else {
    text = await c.req.text();
  }
  return { text: text.trim(), kind: kind === 'task' || kind === 'note' ? kind : undefined };
}

app.post('/capture', async (c) => {
  const userId = await userFor(c, 'capture');
  if (!userId) return c.text('That token isn’t valid. Make a new one in the app’s Settings.', 401);

  const { text, kind } = await readBody(c);
  if (!text) return c.text('Nothing to add — say or type something first.', 400);
  if (text.length > 2000) return c.text('That’s too long for a quick capture.', 413);

  const [{ data: profile }, { data: lists }] = await Promise.all([
    admin.from('profiles').select('timezone').eq('user_id', userId).maybeSingle(),
    admin.from('lists').select('id, name').eq('user_id', userId).order('position'),
  ]);
  const tz = profile?.timezone ?? 'Asia/Kolkata';
  const listRefs = (lists ?? []) as ListRef[];
  const now = new Date();
  const local = zoned(now, tz);

  let capture: Capture | null = null;
  try {
    capture = await geminiParse(text, kind, listRefs, local, tz);
  } catch (e) {
    console.warn('capture: gemini fallback', String(e).slice(0, 120));
  }
  capture ??= basicParse(text, kind ?? 'task', listRefs, now, tz);

  const id = crypto.randomUUID();
  const title = jotTitle(local.date);

  if (capture.kind === 'note') {
    const { error } = await admin.rpc('capture_note', {
      p_user_id: userId,
      p_capture_id: id,
      p_text: `${local.time} — ${capture.title}`,
      p_jot_date: local.date,
      p_jot_title: title,
    });
    if (error) return c.text('Couldn’t save that note. Try again.', 500);
    return c.text('Noted in today’s jot.');
  }

  const { error } = await admin.rpc('capture_task', {
    p_user_id: userId,
    p_id: id,
    p_title: capture.title,
    p_list_id: capture.listId ?? null,
    p_priority: capture.priority ?? 'medium',
    p_deadline: deadlineUtc(capture, tz),
    p_deadline_has_time: !!capture.time,
    p_rrule: capture.rrule ?? null,
    p_jot_date: local.date,
    p_jot_title: title,
  });
  if (error) return c.text('Couldn’t save that task. Try again.', 500);

  const listName = listRefs.find((l) => l.id === capture.listId)?.name;
  const bits = [
    capture.date ? describeDeadline(capture.date, capture.time ?? null, local.date) : null,
    capture.rrule ? 'repeats' : null,
    listName ?? null,
    capture.priority === 'high' ? 'high priority' : null,
  ].filter(Boolean);
  return c.text(`Added: ${capture.title}${bits.length ? ` — ${bits.join(', ')}` : ''}.`);
});

app.get('/health', (c) => c.text('ok'));

app.notFound((c) => c.text('Not found', 404));
app.onError((err, c) => {
  console.error('api error', err.message);
  return c.text('Something went wrong.', 500);
});

Deno.serve(app.fetch);
