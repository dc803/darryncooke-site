import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// NEON answers only from this file; refuse to ship it with unconfirmed facts.
const knowledge = readFileSync(new URL('./assistant/assistant-knowledge.md', import.meta.url), 'utf8');
if (knowledge.includes('[CONFIRM')) {
  throw new Error(
    'assistant/assistant-knowledge.md still contains "[CONFIRM" placeholders. Fill in or remove those lines, then build again.',
  );
}

// Pages stay static; only routes with `prerender = false` (the chat API) run on the server.
export default defineConfig({
  site: 'https://darryncooke.com',
  adapter: vercel(),
});
