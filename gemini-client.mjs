// Gemini browser adapter for MCF Parallel Chat.
// Uses only the existing local Chromium debugging endpoint. No API keys.
const DEBUG_BASE = process.env.MCF_GEMINI_DEBUG_URL || 'http://127.0.0.1:9334';
export class GeminiError extends Error {}
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let active = false;

async function connect() {
  let targets;
  try {
    const res = await fetch(DEBUG_BASE + '/json/list', { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error('discovery HTTP ' + res.status);
    targets = await res.json();
  } catch {
    throw new GeminiError('Gemini indisponível: depuração do Cockpit não acessível.');
  }
  const matches = targets.filter(t => t.type === 'page'
    && /^https:\/\/gemini\.google\.com\//.test(t.url));
  if (matches.length !== 1 || !matches[0].webSocketDebuggerUrl) {
    throw new GeminiError('É necessário exatamente um Gemini aberto no Cockpit.');
  }
  const socket = new WebSocket(matches[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new GeminiError('Tempo esgotado ao conectar ao Gemini.')), 4500);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new GeminiError('Falha no canal do Gemini.')); }, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', (ev) => {
    let message;
    try { message = JSON.parse(ev.data); } catch { return; }
    if (!pending.has(message.id)) return;
    const { resolve, reject, timer } = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(timer);
    if (message.error) reject(new GeminiError(message.error.message || 'Falha no navegador.'));
    else resolve(message.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    if (socket.readyState !== WebSocket.OPEN) return reject(new GeminiError('Canal do Gemini fechado.'));
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); reject(new GeminiError('Timeout: ' + method)); }, 8000);
    pending.set(key, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async (expression) => {
    const out = await call('Runtime.evaluate', { expression, returnByValue: true });
    if (out.exceptionDetails) throw new GeminiError('Erro ao ler interface do Gemini.');
    return out.result?.value;
  };
  return { call, evaluate, close: () => { try { socket.close(); } catch {} } };
}

const snapshot = `(() => {
 const e = document.querySelector('[role="textbox"][contenteditable="true"]');
 const user = [...document.querySelectorAll('user-query')];
 const responses = [...document.querySelectorAll('model-response-content')];
 const button = [...document.querySelectorAll('button')].find(b => /^(Enviar mensagem|Send message)$/i.test(b.getAttribute('aria-label') || ''));
 const box = button?.getBoundingClientRect();
 return {editor: Boolean(e), draft: (e?.innerText || '').trim(),
  users: user.length, responses: responses.length,
  last: (responses.at(-1)?.innerText || '').trim().slice(0, 14000),
  button: box && !button.disabled ? { x: box.left + box.width/2, y: box.top + box.height/2 } : null,
  url: location.href };
})()`;

export async function askGemini(message, { timeoutMs = 60000 } = {}) {
  if (active) throw new GeminiError('Gemini está processando outra pergunta. Aguarde a resposta.');
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) {
    throw new GeminiError('A mensagem deve ter entre 1 e 2000 caracteres.');
  }
  active = true;
  let client;
  try {
    client = await connect();
    const before = await client.evaluate(snapshot);
    if (!before.editor || before.draft) throw new GeminiError('A caixa do Gemini está ocupada; não sobrescrevi o rascunho.');
    const focused = await client.evaluate(`(() => {
      const e = document.querySelector('[role="textbox"][contenteditable="true"]');
      if (!e) return false; e.focus(); return document.activeElement === e;
    })()`);
    if (!focused) throw new GeminiError('Não consegui focar a caixa de mensagem.');
    await client.call('Input.insertText', { text: message.trim() });
    const typed = await client.evaluate(snapshot);
    if (typed.draft !== message.trim() || !typed.button) {
      throw new GeminiError('O envio foi interrompido: rascunho ou botão inesperado.');
    }
    const { x, y } = typed.button;
    await client.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await client.call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await client.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    let seen = '', stableSince = 0;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await sleep(900);
      const current = await client.evaluate(snapshot);
      if (current.users <= before.users) continue;
      if (current.responses <= before.responses || !current.last) continue;
      if (current.last !== seen) { seen = current.last; stableSince = Date.now(); }
      if (Date.now() - stableSince >= 2600) {
        return { reply: current.last, url: current.url, source: 'gemini-browser' };
      }
    }
    throw new GeminiError('O Gemini não concluiu a resposta dentro do limite. Confira a conversa no Cockpit.');
  } finally {
    client?.close();
    active = false;
  }
}
