// Conseiller IA (bêta privée), deux fournisseurs :
// - « anthropic » : API Anthropic avec la clé du joueur (chiffrée par Windows, envoyée seulement à api.anthropic.com) ;
// - « ollama » : modèle local gratuit (Ollama sur ce PC, rien ne sort de la machine).
const fs = require('fs');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
const MAX_TOOL_ROUNDS = 4;
const OLLAMA_URL = 'http://127.0.0.1:11434';
const OLLAMA_RECOMMENDED = 'qwen2.5:7b';

function keyStore(file, safeStorage) {
  const read = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } };
  return {
    has: () => !!read().key,
    get() {
      const d = read();
      if (!d.key) return null;
      try { return d.enc ? safeStorage.decryptString(Buffer.from(d.key, 'base64')) : d.key; } catch { return null; }
    },
    set(key) {
      if (!key) { try { fs.unlinkSync(file); } catch { /* déjà absente */ } return; }
      const enc = safeStorage.isEncryptionAvailable();
      fs.writeFileSync(file, JSON.stringify({ enc, key: enc ? safeStorage.encryptString(key).toString('base64') : key }));
    },
  };
}

const SYSTEM = (lang) => `You are the TLI Companion advisor, an expert coach for the ARPG Torchlight: Infinite (season 16).
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
  name: 'search_prices',
  description: 'Search the current auction house price (in FE) of items by name. Returns up to 10 matches with their category and price. Use it before recommending a purchase whose price is not already in the context.',
  input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Item name or part of it, in English' } }, required: ['query'] },
}];

async function callApi(key, body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data.error && data.error.message) || `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}

// messages : [{ role: 'user'|'assistant', content: string }] (historique visible du chat)
async function chat({ key, model, lang, context, messages, searchPrices }) {
  const convo = messages.map((m) => ({ role: m.role, content: m.content }));
  const system = [
    { type: 'text', text: SYSTEM(lang) },
    // Le contexte change peu entre deux questions : mis en cache côté API.
    { type: 'text', text: 'Player context (JSON):\n' + JSON.stringify(context), cache_control: { type: 'ephemeral' } },
  ];
  const tools = [];
  let usage = { input: 0, output: 0 };
  for (let round = 0; ; round++) {
    const data = await callApi(key, { model: MODELS.includes(model) ? model : MODELS[0], max_tokens: 2048, system, tools: TOOLS, messages: convo });
    usage = { input: usage.input + (data.usage?.input_tokens || 0) + (data.usage?.cache_read_input_tokens || 0), output: usage.output + (data.usage?.output_tokens || 0) };
    const uses = data.content.filter((b) => b.type === 'tool_use');
    if (data.stop_reason !== 'tool_use' || !uses.length || round >= MAX_TOOL_ROUNDS) {
      const text = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      return { text, tools, usage };
    }
    convo.push({ role: 'assistant', content: data.content });
    convo.push({ role: 'user', content: uses.map((u) => {
      const q = String(u.input?.query || '').slice(0, 80);
      tools.push(q);
      return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(searchPrices(q)) };
    }) });
  }
}

// ---------- Ollama (local) ----------
async function ollamaModels() {
  try {
    const res = await fetch(OLLAMA_URL + '/api/tags', { signal: AbortSignal.timeout(1500) });
    const d = await res.json();
    return { up: true, models: (d.models || []).map((m) => m.name).sort() };
  } catch { return { up: false, models: [] }; }
}

async function ollamaCall(body) {
  const res = await fetch(OLLAMA_URL + '/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(300000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
  return data;
}

async function chatOllama({ model, lang, context, messages, searchPrices }) {
  const convo = [
    { role: 'system', content: SYSTEM(lang) + '\n\nPlayer context (JSON):\n' + JSON.stringify(context) },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  const tools = TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
  const searched = [];
  let usage = { input: 0, output: 0 };
  let useTools = true;
  for (let round = 0; ; round++) {
    let data;
    try {
      data = await ollamaCall({ model, messages: convo, stream: false, options: { num_ctx: 16384 }, ...(useTools ? { tools } : {}) });
    } catch (e) {
      // Modèle sans appel d'outils : on refait la question sans l'outil de prix.
      if (useTools && /does not support tools/i.test(e.message)) { useTools = false; round--; continue; }
      throw e;
    }
    usage = { input: usage.input + (data.prompt_eval_count || 0), output: usage.output + (data.eval_count || 0) };
    const calls = (data.message && data.message.tool_calls) || [];
    if (!calls.length || round >= MAX_TOOL_ROUNDS) return { text: (data.message?.content || '').trim(), tools: searched, usage };
    convo.push(data.message);
    for (const c of calls) {
      const q = String(c.function?.arguments?.query || '').slice(0, 80);
      searched.push(q);
      convo.push({ role: 'tool', content: JSON.stringify(searchPrices(q)) });
    }
  }
}

module.exports = { keyStore, chat, chatOllama, ollamaModels, MODELS, OLLAMA_RECOMMENDED };
