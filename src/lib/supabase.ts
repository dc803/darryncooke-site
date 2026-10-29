// Server-only Supabase REST helpers. The secret key never leaves the server.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hkssqwriaaawiihxjuun.supabase.co';

function headers(extra: Record<string, string> = {}) {
  const key = process.env.SUPABASE_SECRET_KEY || '';
  const h: Record<string, string> = { apikey: key, 'content-type': 'application/json', ...extra };
  // New-style sb_secret_ keys are not JWTs and go in apikey only.
  if (!key.startsWith('sb_secret_')) h.authorization = `Bearer ${key}`;
  return h;
}

async function call(path: string, init: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, init);
  if (!res.ok) throw new Error(`Supabase ${path} ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export type Turn = { role: 'user' | 'assistant'; content: string; book?: boolean };

export async function chatHit(ipHash: string): Promise<{ allowed: boolean }> {
  return call('rpc/site_chat_hit', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ p_ip_hash: ipHash, p_ip_limit: 20, p_site_limit: 300 }),
  });
}

export async function loadTranscript(id: string): Promise<Turn[]> {
  const rows = await call(`site_leads?conversation_id=eq.${id}&select=transcript`, { headers: headers() });
  return Array.isArray(rows?.[0]?.transcript) ? rows[0].transcript : [];
}

// merge-duplicates only updates the columns we send, so omitted fields keep their values.
export async function upsertLead(id: string, fields: Record<string, unknown>) {
  await call('site_leads?on_conflict=conversation_id', {
    method: 'POST',
    headers: headers({ prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ conversation_id: id, ...fields, updated_at: new Date().toISOString() }),
  });
}

export async function markBookingClicked(id: string) {
  await call(`site_leads?conversation_id=eq.${id}`, {
    method: 'PATCH',
    headers: headers({ prefer: 'return=minimal' }),
    body: JSON.stringify({ booking_clicked: true, updated_at: new Date().toISOString() }),
  });
}
