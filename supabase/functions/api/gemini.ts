import { matchList, toRRule, type Capture, type ListRef } from './parse.ts';
import type { Zoned } from './time.ts';

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash-lite';
const TIMEOUT_MS = 5000;

const SYSTEM = `You turn a short dictated phrase into an entry for a personal notes + tasks app.
Return JSON only.
- kind: "note" only when the phrase is clearly a thought, idea or observation rather than something to do. If the caller fixes the kind, use it.
- title: the thing itself in the user's own words, without date/time/list/priority/repeat phrases or filler like "remind me to", "add a task to". No trailing punctuation.
- date: YYYY-MM-DD, only when the phrase implies a day. Resolve relative dates ("tomorrow", "next friday", "in 3 days") against Now.
- time: HH:MM 24-hour, only when stated or clearly implied: morning 09:00, afternoon 14:00, evening 18:00, tonight 20:00, end of day 18:00, noon 12:00.
- list: one of the given list names when the phrase names it or it is obvious (groceries/shopping -> an errands-like list), else null.
- priority: "high" for urgent/important/asap, "low" for someday/whenever/low priority, else null.
- repeat: "none" unless the phrase says it repeats ("every day", "weekly", "every month"...).`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    kind: { type: 'STRING', enum: ['task', 'note'] },
    title: { type: 'STRING' },
    date: { type: 'STRING', nullable: true },
    time: { type: 'STRING', nullable: true },
    list: { type: 'STRING', nullable: true },
    priority: { type: 'STRING', enum: ['high', 'medium', 'low'], nullable: true },
    repeat: { type: 'STRING', enum: ['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'yearly'] },
  },
  required: ['kind', 'title', 'repeat'],
};

interface GeminiOut {
  kind: 'task' | 'note';
  title: string;
  date?: string | null;
  time?: string | null;
  list?: string | null;
  priority?: 'high' | 'medium' | 'low' | null;
  repeat: string;
}

/** null when no key is configured; throws on timeout/bad output so the caller falls back. */
export async function geminiParse(
  text: string,
  kind: 'task' | 'note' | undefined,
  lists: ListRef[],
  local: Zoned,
  tz: string,
): Promise<Capture | null> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return null;

  const prompt = [
    `Now: ${local.date} ${local.time} (${local.weekday}), timezone ${tz}.`,
    `Lists: ${lists.map((l) => l.name).join(', ') || 'none'}.`,
    kind ? `The caller fixed kind = ${kind}.` : 'Decide the kind.',
    `Phrase: """${text}"""`,
  ].join('\n');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
          // Thinking tokens were MT-Wallet's hidden cost driver; parsing doesn't need them.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const body = await res.json();
  const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  const out = JSON.parse(raw) as GeminiOut;

  const title = String(out.title ?? '').trim();
  if (!title) throw new Error('gemini: empty title');
  const date = out.date && /^\d{4}-\d{2}-\d{2}$/.test(out.date) ? out.date : undefined;
  const time = date && out.time && /^\d{2}:\d{2}$/.test(out.time) ? out.time : undefined;
  const finalKind = kind ?? out.kind;

  if (finalKind === 'note') return { kind: 'note', title: text.trim(), parser: 'gemini' };

  const repeat = out.repeat && out.repeat !== 'none' ? out.repeat : undefined;
  return {
    kind: 'task',
    title,
    listId: matchList(out.list, lists),
    priority: out.priority ?? undefined,
    date: date ?? (repeat ? local.date : undefined),
    time,
    rrule: repeat ? toRRule(repeat, date ?? local.date) : undefined,
    parser: 'gemini',
  };
}
