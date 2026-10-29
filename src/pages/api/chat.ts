import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { SYSTEM_PROMPT, SAVE_LEAD_TOOL, LEAD_FIELDS } from '../../lib/neon-prompt';
import { chatHit, loadTranscript, upsertLead, type Turn } from '../../lib/supabase';

export const prerender = false;

const MODEL = 'claude-sonnet-5-5';
const MAX_MESSAGES_PER_CONVERSATION = 10;
const MAX_MESSAGE_CHARS = 500;
const MAX_HISTORY = 12;
const MAX_TOOL_ROUNDS = 3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASKS_FOR_CALL = /\b(book|call|schedule|meet|meeting|calendar|talk to|speak)\b/i;

const RESTING = 'NEON is resting for today. You can still book time with Darryn or email dc@darryncooke.com.';
const CLOSING =
  "We've covered a lot, and this is as far as I can take it here. The best next step is a 20-minute call with Darryn, so he can answer directly.";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function clientIp(request: Request) {
  const xff = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return xff || request.headers.get('x-real-ip') || 'unknown';
}

const hashIp = (ip: string) =>
  createHash('sha256').update(`${process.env.CHAT_IP_SALT || ''}:${ip}`).digest('hex');

async function anthropic(messages: unknown[]) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 350,
      thinking: { type: "between_tools" },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [SAVE_LEAD_TOOL],
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  return res.json();
}

function cleanLead(input: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const k of LEAD_FIELDS) {
    const v = input?.[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 300);
  }
  return out;
}

export const POST: APIRoute = async ({ request }) => {
  let body: { conversation_id?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const id = typeof body.conversation_id === 'string' ? body.conversation_id : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!UUID.test(id) || !message) return json({ error: 'Bad request' }, 400);
  if (message.length > MAX_MESSAGE_CHARS) return json({ error: `Messages are limited to ${MAX_MESSAGE_CHARS} characters.` }, 400);

  try {
    // The stored transcript is the source of truth, so a client can't dodge the per-conversation cap.
    const transcript = await loadTranscript(id);
    const visitorCount = transcript.filter((t) => t.role === 'user').length;
    if (visitorCount >= MAX_MESSAGES_PER_CONVERSATION) {
      return json({ reply: CLOSING, book: true, closed: true });
    }

    const hit = await chatHit(hashIp(clientIp(request)));
    if (!hit?.allowed) return json({ reply: RESTING, book: true, limited: true });

    const history = [...transcript, { role: 'user', content: message } as Turn];
    let messages: any[] = history.slice(-MAX_HISTORY).map((t) => ({ role: t.role, content: t.content }));
    while (messages.length && messages[0].role !== 'user') messages.shift();

    const lead: Record<string, string> = {};
    let text = '';
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const resp = await anthropic(messages);
      const blocks: any[] = resp.content || [];
      const roundText = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      if (roundText) text = roundText;
      const calls = blocks.filter((b) => b.type === 'tool_use' && b.name === 'save_lead');
      if (resp.stop_reason !== 'tool_use' || !calls.length) break;
      for (const c of calls) Object.assign(lead, cleanLead(c.input));
      messages = [
        ...messages,
        { role: 'assistant', content: blocks },
        { role: 'user', content: calls.map((c) => ({ type: 'tool_result', tool_use_id: c.id, content: 'Saved.' })) },
      ];
    }
    if (!text) console.warn("NEON: model returned no text");
    if (!text) text = "I'm not sure how to answer that. Darryn can, on a call.";

    const offeredBefore = transcript.filter((t) => t.book).length;
    let book = text.includes('[[BOOK]]');
    text = text.replace(/\[\[BOOK\]\]/g, '').trim();
    if (book && offeredBefore >= 2 && !ASKS_FOR_CALL.test(message)) book = false;

    const fields: Record<string, unknown> = {
      ...lead,
      transcript: [...history, { role: 'assistant', content: text, ...(book ? { book: true } : {}) }],
    };
    if (book) fields.booking_offered = true;
    await upsertLead(id, fields);

    return json({ reply: text, book });
  } catch (err) {
    console.error('chat failed', err);
    return json({ reply: "Something went wrong on my end. You can still book time with Darryn or email dc@darryncooke.com.", book: true, error: true }, 500);
  }
};
