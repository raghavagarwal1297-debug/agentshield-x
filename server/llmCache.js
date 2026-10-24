// Cached demo mode (v2 4.2). Env DEMO_MODE:
//   record  - call the LLM live and save every response to cache/llm_cache.json
//   cached  - replay a saved response when one exists (deterministic, works
//             offline); unknown prompts still go live and are saved
//   (unset) - live only, cache unused
// The cache lives outside data/ so /api/reset never wipes it.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { fileURLToPath } from 'url';

// Replay-only scope: inside replayOnly(fn) every LLM call must come from the
// cache, whatever DEMO_MODE is. A miss throws instead of calling the provider,
// so Autopilot can promise zero live calls. The scope follows async work, so a
// run paused for approval stays replay-only when it resumes.
const replayScope = new AsyncLocalStorage();
export const replayOnly = (fn) => replayScope.run(true, fn);
export const isReplayOnly = () => replayScope.getStore() === true;
export class CacheMissError extends Error {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.LLM_CACHE_FILE || path.join(__dirname, 'cache', 'llm_cache.json');

export const demoMode = () => (['record', 'cached'].includes(process.env.DEMO_MODE) ? process.env.DEMO_MODE : 'live');

let cache = null;
function load() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { cache = {}; }
  return cache;
}
function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(cache, null, 1));
}

// Values that differ between otherwise identical runs are masked in the key.
const stable = (s) => String(s ?? '')
  .replace(/exports\/([a-z]+)-\d+\.csv/g, 'exports/$1-N.csv')
  .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, 'TS');

function keyFor({ model, messages, tools = [], json = false }) {
  const shape = {
    model, json,
    tools: tools.map((t) => t.name),
    messages: messages.map((m) => ({
      role: m.role,
      content: stable(m.content),
      calls: (m.tool_calls || []).map((c) => [c.name, c.args]),
    })),
  };
  return crypto.createHash('sha256').update(JSON.stringify(shape)).digest('hex');
}

// Wraps one provider call with the cache according to DEMO_MODE.
export async function withCache(request, live) {
  if (isReplayOnly()) {
    const hit = load()[keyFor(request)];
    if (!hit) throw new CacheMissError('This step is not in the demo cache, and replay-only mode makes no live LLM calls.');
    return { ...hit, cached: true };
  }
  const mode = demoMode();
  if (mode === 'live') return live();
  const key = keyFor(request);
  const store = load();
  if (mode === 'cached' && store[key]) return { ...store[key], cached: true };
  const res = await live();
  store[key] = { content: res.content, tool_calls: res.tool_calls, _gemini_parts: res._gemini_parts };
  save();
  return res;
}

export function cacheInfo() {
  return { demo_mode: demoMode(), cached_responses: Object.keys(load()).length };
}
