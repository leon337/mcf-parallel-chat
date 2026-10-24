import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const file = process.env.MCF_TRACE_FILE || join(process.cwd(), '.mcf-data', 'events.jsonl');
let queue = Promise.resolve();
export const uuid = () => randomUUID();
export const validUuid = x => typeof x === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(x);

export function envelope(actor, context, status, latency) {
  const actors = {
    local: { actor_id: 'MCF-LOCAL-RULES', role: 'deterministic-engine', provider: 'local-rules' },
    gemini: { actor_id: 'GEMINI-WEB', role: 'external-model', provider: 'gemini-cockpit-web' },
  };
  if (!actors[actor]) throw new Error('Unknown actor');
  return Object.freeze({
    schema: 'mcf-attribution-v1',
    trace_id: context.trace_id,
    turn_id: context.turn_id,
    parent_message_id: context.message_id,
    message_id: uuid(),
    timestamp: new Date().toISOString(),
    ...actors[actor],
    status,
    latency_ms: Math.max(0, Math.round(latency)),
    signature_type: 'attribution-only',
  });
}

// Whitelist-only metadata. Prompt/response, cookies, credentials and headers never enter the ledger.
export function logEvent(event) {
  const allowed = ['schema','trace_id','turn_id','parent_message_id','message_id',
    'timestamp','actor_id','role','provider','status','latency_ms','signature_type'];
  const safe = Object.fromEntries(allowed.filter(k => event[k] !== undefined).map(k => [k,event[k]]));
  queue = queue.then(async () => {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    await appendFile(file, JSON.stringify(safe) + '\n', { mode: 0o600 });
  }).catch(error => { console.error('Trace persistence failed:', error.code || error.name); });
  return queue;
}
export async function readEvents(limit = 30) {
  await queue;
  let data = '';
  try { data = await readFile(file, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return data.trim() ? data.trim().split('\n').slice(-limit).map(x=>JSON.parse(x)) : [];
}
