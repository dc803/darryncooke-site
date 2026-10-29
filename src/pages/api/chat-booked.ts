import type { APIRoute } from 'astro';
import { markBookingClicked } from '../../lib/supabase';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { conversation_id } = await request.json();
    if (typeof conversation_id === 'string' && UUID.test(conversation_id)) await markBookingClicked(conversation_id);
  } catch (err) {
    console.error('chat-booked failed', err);
  }
  return new Response(null, { status: 204 });
};
