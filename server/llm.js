// Single LLM wrapper. Provider chosen by env LLM_PROVIDER: groq | gemini.
//
//   chat({ messages, tools })  -> { content, tool_calls: [{ id, name, args }] }
//   classify(prompt)           -> parsed JSON object (throws LLMError on failure)
//
// Messages use the OpenAI shape internally:
//   { role: 'system'|'user'|'assistant'|'tool', content, tool_calls?, tool_call_id?, name? }
// Two model slots: AGENT_MODEL runs the agent loop, JUDGE_MODEL does short
// classifier/report calls. Temperature is always 0 for repeatable demos, and
// DEMO_MODE=record|cached replays saved responses (see llmCache.js).
import { withCache, cacheInfo, CacheMissError } from './llmCache.js';

export class LLMError extends Error {}

const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 20000);

const provider = () => (process.env.LLM_PROVIDER || 'groq').toLowerCase();
export const agentModel = () =>
  process.env.AGENT_MODEL || (provider() === 'gemini' ? 'gemini-2.5-flash' : 'openai/gpt-oss-120b');
export const judgeModel = () =>
  process.env.JUDGE_MODEL || (provider() === 'gemini' ? 'gemini-2.5-flash-lite' : 'openai/gpt-oss-20b');

export function llmInfo() {
  return { provider: provider(), agent_model: agentModel(), judge_model: judgeModel(), ...cacheInfo() };
}

async function callProvider({ messages, tools, model, json = false }) {
  try {
    return await withCache({ model, messages, tools, json }, () => (provider() === 'gemini'
      ? geminiChat({ messages, tools, model, json })
      : groqChat({ messages, tools, model, json })));
  } catch (e) {
    if (e instanceof CacheMissError) throw Object.assign(new LLMError(e.message), { cacheMiss: true });
    throw e;
  }
}

export async function chat({ messages, tools = [], model = agentModel() }) {
  return callProvider({ messages, tools, model });
}

// Short JSON-only call on the judge model. Returns a parsed object.
export async function classify(prompt, { model = judgeModel() } = {}) {
  const messages = [
    { role: 'system', content: 'You are a security classifier. Reply with a single JSON object only.' },
    { role: 'user', content: prompt },
  ];
  const res = await callProvider({ messages, tools: [], model, json: true });
  return parseJSON(res.content);
}

// Tolerant JSON parse: accepts ```json fences or extra prose around one object.
export function parseJSON(text) {
  if (!text) throw new LLMError('Empty LLM response');
  try { return JSON.parse(text); } catch { /* fall through */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  throw new LLMError(`LLM did not return valid JSON: ${text.slice(0, 120)}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_RATE_RETRIES = Number(process.env.LLM_RATE_RETRIES || 3);

// POST with retry on HTTP 429 and network errors (free tiers have small tokens-per-minute limits).
// Waits for the provider's "retry-after" hint, capped at 30 s per wait.
async function postJSON(url, headers, body) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await postOnce(url, headers, body);
    } catch (e) {
      const retryable = e instanceof LLMError && (e.status === 429 || e.network);
      if (!retryable || attempt >= MAX_RATE_RETRIES) throw e;
      const hinted = Number(e.retryAfter || (e.message.match(/try again in ([\d.]+)s/)?.[1]));
      const waitMs = Math.min(30000, (hinted > 0 ? hinted * 1000 : 5000 * (attempt + 1)) + 500);
      console.warn(`[llm] ${e.network ? 'network error' : 'rate limited'}, retrying in ${Math.round(waitMs / 100) / 10}s`);
      await sleep(waitMs);
    }
  }
}

async function postOnce(url, headers, body) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const err = new LLMError(`LLM request failed: ${e.name === 'TimeoutError' ? 'timeout' : e.message}`);
    err.network = true;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new LLMError(`LLM HTTP ${res.status}: ${data.error?.message || JSON.stringify(data).slice(0, 200)}`);
    err.status = res.status;
    err.retryAfter = res.headers.get('retry-after');
    throw err;
  }
  return data;
}

// ---------- Groq (OpenAI-compatible) ----------
async function groqChat({ messages, tools, model, json = false }) {
  if (!process.env.GROQ_API_KEY) throw new LLMError('GROQ_API_KEY is not set');
  const body = {
    model,
    temperature: 0,
    seed: 7,
    messages: messages.map((m) => {
      const out = { role: m.role, content: m.content ?? '' };
      if (m.tool_calls?.length) {
        out.tool_calls = m.tool_calls.map((c) => ({
          id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) },
        }));
      }
      if (m.role === 'tool') out.tool_call_id = m.tool_call_id;
      return out;
    }),
  };
  if (tools.length) {
    body.tools = tools.map((t) => ({ type: 'function', function: t }));
    body.tool_choice = 'auto';
  }
  if (json) body.response_format = { type: 'json_object' };

  const data = await postJSON('https://api.groq.com/openai/v1/chat/completions',
    { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body);
  const msg = data.choices?.[0]?.message || {};
  return {
    content: msg.content || '',
    tool_calls: (msg.tool_calls || []).map((c) => ({
      id: c.id, name: c.function.name, args: safeArgs(c.function.arguments),
    })),
  };
}

function safeArgs(s) {
  if (!s) return {};
  if (typeof s === 'object') return s;
  try { return JSON.parse(s); } catch { return {}; }
}

// ---------- Gemini ----------
async function geminiChat({ messages, tools, model, json = false }) {
  if (!process.env.GEMINI_API_KEY) throw new LLMError('GEMINI_API_KEY is not set');
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    if (m.role === 'user') contents.push({ role: 'user', parts: [{ text: m.content }] });
    if (m.role === 'assistant') {
      // Re-send Gemini's own parts when we have them (keeps thought signatures intact).
      const parts = m._gemini_parts || [
        ...(m.content ? [{ text: m.content }] : []),
        ...(m.tool_calls || []).map((c) => ({ functionCall: { name: c.name, args: c.args } })),
      ];
      contents.push({ role: 'model', parts });
    }
    if (m.role === 'tool') {
      const part = { functionResponse: { name: m.name, response: { result: m.content } } };
      // consecutive tool results go into one user turn
      const last = contents[contents.length - 1];
      if (last?.role === 'user' && last.parts[0]?.functionResponse) last.parts.push(part);
      else contents.push({ role: 'user', parts: [part] });
    }
  }
  const body = { contents, generationConfig: { temperature: 0 } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (tools.length) body.tools = [{ functionDeclarations: tools }];
  if (json) body.generationConfig.responseMimeType = 'application/json';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const data = await postJSON(url, { 'x-goog-api-key': process.env.GEMINI_API_KEY }, body);
  const parts = data.candidates?.[0]?.content?.parts || [];
  return {
    content: parts.filter((p) => p.text && !p.thought).map((p) => p.text).join(''),
    tool_calls: parts.filter((p) => p.functionCall).map((p, i) => ({
      id: `call_${Date.now()}_${i}`, name: p.functionCall.name, args: p.functionCall.args || {},
    })),
    _gemini_parts: parts,
  };
}
