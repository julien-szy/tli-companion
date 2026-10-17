// Conseiller IA hébergé : le serveur relaie les questions vers un fournisseur à offre gratuite
// (Google Gemini, puis Groq en secours), avec les clés stockées uniquement sur le VPS.
// Les joueurs n'installent rien et n'ont pas besoin de clé.
// Clés : /etc/tli-server/ai.env -> GEMINI_API_KEY, GROQ_API_KEY (+ GEMINI_MODEL, GROQ_MODEL facultatifs).

const PROVIDERS = [
  { name: 'gemini', key: () => process.env.GEMINI_API_KEY, model: () => process.env.GEMINI_MODEL || 'gemini-flash-latest',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' },
  { name: 'groq', key: () => process.env.GROQ_API_KEY, model: () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    url: process.env.GROQ_URL || 'https://api.groq.com/openai/v1/chat/completions' }, // GROQ_URL : tests
];
const MAX_TOOL_ROUNDS = 3;

const SYSTEM = (lang) => `You are the TLI Companion advisor, an expert coach for the ARPG Torchlight: Infinite.
You help one player progress: what to buy or craft next, how to raise DPS, which map strategy earns more Flame Elementium (FE, the currency), and how their build compares with the top players of their class.

How to answer:
- Answer in ${lang === 'fr' ? 'French' : 'English'}, in a friendly, direct tone. Short paragraphs or bullet lists; no long intro.
- Base every recommendation on the JSON context below (their class, owned skills, FE in bag, farm rate, recent sessions, class meta with usage % and prices, top players' builds). Quote numbers from it.
- Prices are in FE. Use the search_prices tool when you need the price of an item that is not in the context, before telling the player what to buy.
- Compare cost with the player's budget (feInBag, farmRatePerHour): say how many hours of farming an upgrade costs.
- If the context is missing something (no class detected, no meta, no sessions), say so plainly and tell them how to get it (open the Hero Ranking in game, start a farm session…).
- Never invent item stats, affixes or mechanics you are not sure about; say you are not sure instead.
- "usage %" means the share of the top players of the class who use it.`;

const TOOLS = [{
  type: 'function',
  function: {
    name: 'search_prices',
    description: 'Search the current auction house price (in FE) of items by name. Returns up to 10 matches. Use it before recommending a purchase whose price is not already in the context.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Item name or part of it, in English' } }, required: ['query'] },
  },
}];

const available = () => PROVIDERS.filter((p) => p.key());

async function callProvider(p, body) {
  const res = await fetch(p.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: p.model(), ...body }),
    signal: AbortSignal.timeout(90000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data.error && (data.error.message || data.error)) || `HTTP ${res.status}`;
    throw Object.assign(new Error(String(msg).slice(0, 200)), { status: res.status });
  }
  return data;
}

// messages : [{ role, content }] ; searchPrices(q) -> [{ name, priceFE }]
async function chat({ lang, context, messages, searchPrices }) {
  const providers = available();
  if (!providers.length) throw Object.assign(new Error('AI is not configured on this server yet'), { status: 503 });
  let lastErr;
  for (const p of providers) {
    try {
      return { ...(await chatWith(p, { lang, context, messages, searchPrices })), provider: p.name, model: p.model() };
    } catch (e) {
      lastErr = e;
      // Quota atteint ou panne : on essaie le fournisseur suivant.
      if (!(e.status === 429 || e.status >= 500 || e.name === 'TimeoutError')) throw e;
    }
  }
  throw lastErr;
}

async function chatWith(p, { lang, context, messages, searchPrices }) {
  const convo = [
    { role: 'system', content: SYSTEM(lang) + '\n\nPlayer context (JSON):\n' + JSON.stringify(context) },
    ...messages,
  ];
  const searched = [];
  let usage = { input: 0, output: 0 };
  for (let round = 0; ; round++) {
    const data = await callProvider(p, { messages: convo, tools: TOOLS, max_tokens: 1500, temperature: 0.4 });
    usage = { input: usage.input + (data.usage?.prompt_tokens || 0), output: usage.output + (data.usage?.completion_tokens || 0) };
    const msg = data.choices?.[0]?.message || {};
    const calls = msg.tool_calls || [];
    if (!calls.length || round >= MAX_TOOL_ROUNDS) return { text: (msg.content || '').trim(), tools: searched, usage };
    convo.push({ role: 'assistant', content: msg.content || '', tool_calls: calls });
    for (const c of calls) {
      let q = '';
      try { q = String(JSON.parse(c.function?.arguments || '{}').query || '').slice(0, 80); } catch { /* arguments invalides */ }
      searched.push(q);
      convo.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(searchPrices(q)) });
    }
  }
}

module.exports = { chat, available };
