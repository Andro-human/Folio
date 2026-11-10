import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';
import { aiSplit, checkSplit } from './ai.ts';
import { basicParse, deadlineUtc, modelParse, readModelFields, type ListRef, type ModelFields } from './parse.ts';
import { clock, describeDeadline, describeLead, jotTitle, zoned } from './time.ts';
import { sendPush, type PushTarget } from './webpush.ts';
import { fetchPreview } from './unfurl.ts';
import { buildServer } from './mcp.ts';
import { bucketOf, occursOn, spokenDay, type ScheduleItem } from './assist.ts';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

// Service role: every query below must filter by the user id resolved from the token.
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const VAPID = {
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY')!,
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY')!,
  subject: Deno.env.get('VAPID_SUBJECT')!,
};

const app = new Hono().basePath('/api');

// Only the in-app routes are called from a browser; Shortcuts and pg_cron don't send an Origin.
const appCors = cors({
  origin: ['https://folio.animeshsinha.dev', 'https://note-taker-theta-eight.vercel.app', 'http://localhost:5180'],
  allowHeaders: ['authorization', 'content-type', 'apikey', 'x-client-info'],
});
app.use('/push/*', appCors);
app.use('/link/*', appCors);

/** The signed-in app user, from their Supabase session JWT. */
async function sessionUser(c: Context): Promise<string | null> {
  const jwt = bearer(c);
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data.user?.id ?? null;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const bearer = (c: Context) => /^Bearer\s+(\S+)$/i.exec(c.req.header('authorization') ?? '')?.[1] ?? null;

/** The token's owner, if it's live and has this scope. Tokens are never logged. */
async function userForToken(token: string | null, scope: 'capture' | 'mcp'): Promise<string | null> {
  if (!token) return null;
  const { data } = await admin
    .from('api_tokens')
    .select('id, user_id')
    .eq('token_hash', await sha256Hex(token))
    .eq('scope', scope)
    .is('revoked_at', null)
    .maybeSingle();
  if (!data) return null;
  await admin.from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
  return data.user_id;
}

/** Capture takes the token in the Authorization header only. */
const userFor = (c: Context, scope: 'capture' | 'mcp') => userForToken(bearer(c), scope);

async function readBody(c: Context): Promise<{ text: string; kind?: 'task' | 'note'; fields: ModelFields | null }> {
  const type = c.req.header('content-type') ?? '';
  let text = '';
  let kind: string | undefined = c.req.query('kind');
  let fields: ModelFields | null = null;
  if (type.includes('application/json')) {
    const body = await c.req.json().catch(() => ({}));
    text = String(body.text ?? body.input ?? '');
    kind = body.kind ?? kind;
    fields = readModelFields(body.parsed);
  } else if (type.includes('form')) {
    const form = await c.req.parseBody();
    text = String(form.text ?? '');
    kind = (form.kind as string | undefined) ?? kind;
  } else {
    text = await c.req.text();
  }
  return { text: text.trim(), kind: kind === 'task' || kind === 'note' ? kind : undefined, fields };
}

app.post('/capture', async (c) => {
  const userId = await userFor(c, 'capture');
  if (!userId) return c.text('That token isn’t valid. Make a new one in the app’s Settings.', 401);

  const { text, kind, fields } = await readBody(c);
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

  // Tasks are split by Gemini (or fields an older Shortcut sent); dates are always resolved here. If the model is
  // slow, down or returns junk, the phrase is parsed by the rules instead.
  let split = kind === 'note' ? null : fields;
  if (kind !== 'note' && !split) {
    split = checkSplit(readModelFields(await aiSplit(text, listRefs.map((l) => l.name), Deno.env.get('GEMINI_API_KEY'))), text);
  }
  const capture = split ? modelParse(split, listRefs, now, tz) : basicParse(text, kind ?? 'task', listRefs, now, tz);

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

/** "Hey Siri, what's on today": a sentence for the Shortcut to speak. Same token as /capture; reads only. */
async function today(c: Context) {
  const userId = await userFor(c, 'capture');
  if (!userId) return c.text('That token isn’t valid. Make a new one in the app’s Settings.', 401);
  const [{ data: profile }, { data: events }, { data: tasks }] = await Promise.all([
    admin.from('profiles').select('timezone').eq('user_id', userId).maybeSingle(),
    admin.from('events').select('*').eq('user_id', userId),
    admin
      .from('tasks')
      .select('deadline, deadline_has_time, page:pages!inner(title, deleted_at)')
      .eq('user_id', userId)
      .eq('status', 'todo')
      .not('deadline', 'is', null)
      .is('page.deleted_at', null),
  ]);
  const tz = profile?.timezone ?? 'Asia/Kolkata';
  const now = new Date();
  const local = zoned(now, tz);
  const [h, m] = local.time.split(':').map(Number);
  const due: { title: string; at: number | null }[] = [];
  const overdue: string[] = [];
  for (const t of (tasks ?? []) as unknown as { deadline: string; deadline_has_time: boolean; page: { title: string } }[]) {
    const bucket = bucketOf(t.deadline, t.deadline_has_time, now, tz);
    const title = t.page.title || 'an untitled task';
    if (bucket === 'overdue') overdue.push(title);
    else if (bucket === 'today') {
      const at = zoned(new Date(t.deadline), tz).time.split(':').map(Number);
      due.push({ title, at: t.deadline_has_time ? at[0] * 60 + at[1] : null });
    }
  }
  const schedule = ((events ?? []) as ScheduleItem[]).filter((e) => occursOn(e, local.date));
  return c.text(spokenDay(schedule, h * 60 + m, due, overdue));
}
app.get('/today', today);
app.post('/today', today);

interface DueReminder {
  page_id: string;
  user_id: string;
  title: string;
  deadline: string;
  deadline_has_time: boolean;
}

interface DueEvent {
  event_id: string;
  user_id: string;
  title: string;
  start_time: string;
  end_time: string;
  alert_minutes: number;
  alert_at: string;
}

interface PushMessage {
  user_id: string;
  payload: { title: string; body: string; url: string; tag: string };
}

/**
 * Called every minute by pg_cron (only when something is due). No secret: claiming is exactly-once,
 * so an extra call can't send anything twice or early — it just finds nothing to do.
 */
app.post('/internal/tick', async (c) => {
  // Both claims commit on their own, so one failing mustn't throw away what the other claimed.
  const [tasks, events] = await Promise.all([admin.rpc('claim_due_reminders'), admin.rpc('claim_due_events')]);
  if (tasks.error) console.error('claim reminders', tasks.error.message);
  if (events.error) console.error('claim events', events.error.message);
  const reminders = (tasks.data ?? []) as DueReminder[];
  const alerts = (events.data ?? []) as DueEvent[];
  const due = reminders.length + alerts.length;
  if (!due) return c.json({ sent: 0 });

  const users = [...new Set([...reminders, ...alerts].map((r) => r.user_id))];
  const [{ data: subs }, { data: profiles }] = await Promise.all([
    admin.from('push_subscriptions').select('user_id, endpoint, p256dh, auth').in('user_id', users),
    admin.from('profiles').select('user_id, timezone').in('user_id', users),
  ]);
  const tzOf = new Map((profiles ?? []).map((p) => [p.user_id, p.timezone ?? 'Asia/Kolkata']));
  const tz = (userId: string) => tzOf.get(userId) ?? 'Asia/Kolkata';

  const messages: PushMessage[] = [
    ...reminders.map((r) => {
      const at = zoned(new Date(r.deadline), tz(r.user_id));
      return {
        user_id: r.user_id,
        payload: {
          title: r.title || 'Untitled task',
          body: `Due ${describeDeadline(at.date, r.deadline_has_time ? at.time : null, zoned(new Date(), tz(r.user_id)).date)}`,
          url: `/p/${r.page_id}`,
          tag: r.page_id,
        },
      };
    }),
    ...alerts.map((a) => {
      const starts = new Date(new Date(a.alert_at).getTime() + a.alert_minutes * 60_000);
      return {
        user_id: a.user_id,
        payload: {
          title: a.title,
          body: `${describeLead(a.alert_minutes)} · ${clock(a.start_time)} – ${clock(a.end_time)}`,
          url: `/schedule?d=${zoned(starts, tz(a.user_id)).date}`,
          tag: `event-${a.event_id}`,
        },
      };
    }),
  ];

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    messages.flatMap((m) =>
      (subs ?? [])
        .filter((s) => s.user_id === m.user_id)
        .map(async (s) => {
          try {
            const status = await sendPush(s as PushTarget, m.payload, VAPID);
            if (status === 404 || status === 410) gone.push(s.endpoint);
            else if (status < 300) sent++;
            else console.warn('push rejected', status, new URL(s.endpoint).host);
          } catch (e) {
            console.warn('push failed', new URL(s.endpoint).host, String(e).slice(0, 120));
          }
        }),
    ),
  );
  if (gone.length) await admin.from('push_subscriptions').delete().in('endpoint', [...new Set(gone)]);
  return c.json({ due, sent, removed: new Set(gone).size });
});

/** Sends a test notification to the caller's devices, from Settings. Uses the signed-in user's JWT. */
app.post('/push/test', async (c) => {
  const userId = await sessionUser(c);
  if (!userId) return c.text('Sign in first.', 401);
  const { data: subs } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId);
  const results = await Promise.all(
    (subs ?? []).map((s) =>
      sendPush(s as PushTarget, { title: 'Reminders are on', body: 'Timed tasks will notify you here.', url: '/', tag: 'test' }, VAPID).catch(() => 0),
    ),
  );
  const gone = (subs ?? []).filter((_, i) => results[i] === 404 || results[i] === 410).map((s) => s.endpoint);
  if (gone.length) await admin.from('push_subscriptions').delete().in('endpoint', gone);
  return c.json({ devices: results.filter((s) => s > 0 && s < 300).length });
});

/** Title, description and image for a link preview card. Signed-in users only, so it isn't an open proxy. */
app.get('/link/preview', async (c) => {
  if (!(await sessionUser(c))) return c.text('Sign in first.', 401);
  const url = c.req.query('url') ?? '';
  if (!/^https?:\/\//i.test(url)) return c.text('Not a link.', 400);
  try {
    return c.json(await fetchPreview(url), 200, { 'cache-control': 'private, max-age=3600' });
  } catch (e) {
    console.warn('preview failed', String(e).slice(0, 120));
    return c.json({ url, finalUrl: url, title: null, description: null, image: null, site: null, icon: null });
  }
});

/**
 * MCP over Streamable HTTP, stateless: a fresh server per POST. claude.ai and ChatGPT connectors
 * can only take a URL, so they use /mcp/<token> (an MCP-scoped token, useless for /capture);
 * Claude Code sends the token as a Bearer header to /mcp.
 */
async function mcp(c: Context, token: string | null) {
  const userId = await userForToken(token, 'mcp');
  if (!userId) {
    return c.json({ jsonrpc: '2.0', error: { code: -32001, message: 'That Folio link or token isn’t valid. Make a new one in Settings → AI assistants.' }, id: null }, 401);
  }
  const server = buildServer(admin, userId);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
}
app.post('/mcp', (c) => mcp(c, bearer(c)));
app.post('/mcp/:token', (c) => mcp(c, c.req.param('token')));
app.on(['GET', 'DELETE'], ['/mcp', '/mcp/:token'], (c) => c.text('Method not allowed', 405));

app.get('/health', (c) => c.text('ok'));

app.notFound((c) => c.text('Not found', 404));
app.onError((err, c) => {
  console.error('api error', err.message);
  return c.text('Something went wrong.', 500);
});

Deno.serve(app.fetch);
