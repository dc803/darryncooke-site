// NEON chat panel. Loaded on demand (dynamic import) when "Ask NEON" is clicked.

const BOOKING_URL = 'https://calendar.app.google/CuyVjLtgYdiokafe7';
const GREETING =
  "Hi, I'm NEON, Darryn's AI assistant. I'm an AI, not Darryn, and I answer only from his verified background. Conversations are saved so he can follow up. What brings you here?";
const CHIPS = ["What's his AI experience?", 'Is he a fit for my role?', 'Book a call with Darryn'];
const KEY = 'neon-conversation-id';

const CSS = `
.neon-panel{position:fixed;z-index:60;right:20px;bottom:84px;width:min(400px,calc(100vw - 40px));height:min(580px,calc(100dvh - 110px));display:none;flex-direction:column;background:#0a0618;border:2px solid #ff2e88;border-radius:16px;box-shadow:0 0 0 1px #00e5ff,0 0 28px rgba(255,46,136,.45),0 0 40px rgba(0,229,255,.25);font-family:Inter,system-ui,sans-serif;color:#f1edfa;overflow:hidden}
.neon-panel.on{display:flex}
.neon-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(0,229,255,.35)}
.neon-head h2{margin:0;font:700 .95rem Orbitron,system-ui,sans-serif;letter-spacing:.1em;color:#fff;text-shadow:0 0 10px #00e5ff}
.neon-x{width:36px;height:36px;border-radius:10px;border:1.5px solid #00e5ff;background:transparent;color:#fff;font-size:1rem;cursor:pointer}
.neon-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
.neon-msg{max-width:88%;padding:9px 12px;border-radius:12px;font-size:.95rem;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.neon-msg.bot{align-self:flex-start;background:#1a0838;border:1px solid rgba(0,229,255,.45)}
.neon-msg.me{align-self:flex-end;background:#3a0a2a;border:1px solid #ff2e88}
.neon-chips{display:flex;flex-wrap:wrap;gap:8px}
.neon-chip,.neon-book{font:600 .85rem Inter,system-ui,sans-serif;padding:8px 12px;border-radius:999px;border:1.5px solid #00e5ff;background:transparent;color:#fff;cursor:pointer;text-decoration:none;display:inline-block}
.neon-chip:hover,.neon-chip:focus-visible{background:rgba(0,229,255,.15)}
.neon-book{align-self:flex-start;border-color:#ff2e88;background:#ff2e88;color:#0a0618;font-weight:700;box-shadow:0 0 14px rgba(255,46,136,.6)}
.neon-typing{align-self:flex-start;display:flex;gap:5px;padding:12px 14px;background:#1a0838;border:1px solid rgba(0,229,255,.45);border-radius:12px}
.neon-typing i{width:7px;height:7px;border-radius:50%;background:#00e5ff;animation:neon-b 1s infinite ease-in-out}
.neon-typing i:nth-child(2){animation-delay:.15s}.neon-typing i:nth-child(3){animation-delay:.3s}
@keyframes neon-b{0%,80%,100%{opacity:.25}40%{opacity:1}}
@media (prefers-reduced-motion:reduce){.neon-typing i{animation:none;opacity:.7}}
.neon-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(0,229,255,.35)}
.neon-form input{flex:1;min-width:0;padding:10px 12px;border-radius:10px;border:1.5px solid #00e5ff;background:#120a2a;color:#f1edfa;font:inherit;font-size:1rem}
.neon-form button{padding:0 16px;border-radius:10px;border:0;background:#ff2e88;color:#0a0618;font:700 .9rem Inter,system-ui,sans-serif;cursor:pointer}
.neon-form button:disabled,.neon-form input:disabled{opacity:.5;cursor:default}
.neon-foot{margin:0;padding:6px 12px 10px;text-align:center;font-size:.72rem;color:#cfc6e6}
@media (max-width:640px){.neon-panel{inset:0;width:auto;height:auto;border-radius:0;border-width:0}}
`;

let memId;
function conversationId() {
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return (memId ||= crypto.randomUUID());
  }
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

export function createChat({ onClose }) {
  const style = el('style');
  style.textContent = CSS;
  document.head.append(style);

  const id = conversationId();
  const panel = el('div', 'neon-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', "Chat with NEON, Darryn's AI assistant");

  const head = el('div', 'neon-head');
  head.append(el('h2', '', 'NEON'));
  const x = el('button', 'neon-x', '✕');
  x.type = 'button';
  x.setAttribute('aria-label', 'Close chat');
  head.append(x);

  const log = el('div', 'neon-log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  log.setAttribute('aria-label', 'Conversation with NEON');

  const form = el('form', 'neon-form');
  const input = el('input');
  input.type = 'text';
  input.maxLength = 500;
  input.placeholder = 'Ask about Darryn…';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Your message');
  const send = el('button', '', 'Send');
  send.type = 'submit';
  send.setAttribute('aria-label', 'Send message');
  form.append(input, send);

  panel.append(head, log, form, el('p', 'neon-foot', 'AI assistant · may make mistakes · book a call to talk to Darryn'));
  document.body.append(panel);

  const scroll = () => (log.scrollTop = log.scrollHeight);
  const say = (text, who) => {
    log.append(el('div', `neon-msg ${who}`, text));
    scroll();
  };

  const markBooked = () => {
    fetch('/api/chat-booked', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversation_id: id }),
      keepalive: true,
    }).catch(() => {});
  };
  const bookLink = (text) => {
    const a = el('a', 'neon-book', text);
    a.href = BOOKING_URL;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.addEventListener('click', markBooked);
    return a;
  };

  let busy = false;
  let chips;

  async function ask(text) {
    if (busy || !text.trim()) return;
    busy = true;
    chips?.remove();
    chips = null;
    say(text, 'me');
    input.value = '';
    input.disabled = send.disabled = true;
    const typing = el('div', 'neon-typing');
    typing.setAttribute('role', 'status');
    typing.setAttribute('aria-label', 'NEON is typing');
    typing.append(el('i'), el('i'), el('i'));
    log.append(typing);
    scroll();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversation_id: id, message: text }),
      });
      const data = await res.json().catch(() => ({}));
      typing.remove();
      say(data.reply || data.error || 'Something went wrong. Please try again.', 'bot');
      if (data.book) {
        log.append(bookLink('Book a 20-minute call →'));
        scroll();
      }
      if (data.closed || data.limited) {
        input.placeholder = 'Chat limit reached';
        return;
      }
    } catch {
      typing.remove();
      say('I could not reach the server. Please try again, or email dc@darryncooke.com.', 'bot');
    }
    busy = false;
    input.disabled = send.disabled = false;
    input.focus();
  }

  say(GREETING, 'bot');
  chips = el('div', 'neon-chips');
  CHIPS.forEach((label, i) => {
    const c = el('button', 'neon-chip', label);
    c.type = 'button';
    c.addEventListener('click', () => {
      if (i === 2) {
        window.open(BOOKING_URL, '_blank', 'noopener,noreferrer');
        markBooked();
      } else ask(label);
    });
    chips.append(c);
  });
  log.append(chips);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ask(input.value);
  });
  const onKey = (e) => {
    if (e.key === 'Escape') api.close();
  };
  const api = {
    open() {
      panel.classList.add('on');
      document.addEventListener('keydown', onKey);
      (input.disabled ? x : input).focus();
    },
    close() {
      panel.classList.remove('on');
      document.removeEventListener('keydown', onKey);
      onClose?.();
    },
  };
  x.addEventListener('click', () => api.close());
  return api;
}
