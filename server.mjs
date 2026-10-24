import http from 'node:http';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { localReply } from './local-engine.mjs';
import { askGemini, GeminiError } from './gemini-client.mjs';
import { envelope, logEvent, readEvents, validUuid, uuid } from './trace-ledger.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const host = '127.0.0.1';
const port = Number(process.env.PORT || 48721);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT inválida.');
const assets = {
  '/': ['public/index.html', 'text/html; charset=utf-8'],
  '/style.css': ['public/style.css', 'text/css; charset=utf-8'],
  '/app.js': ['public/app.js', 'text/javascript; charset=utf-8'],
};

function send(res, status, data, contentType='application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  });
  res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
}
async function bodyJSON(req) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > 12000) throw Object.assign(new Error('Requisição grande demais.'), { status: 413 });
  let size=0, raw='';
  for await (const chunk of req) {
    size+=chunk.length;
    if (size > 12000) throw Object.assign(new Error('Requisição grande demais.'),{status:413});
    raw+=chunk.toString('utf-8');
  }
  let body;
  try { body=JSON.parse(raw); } catch { throw Object.assign(new Error('JSON inválido.'), {status:400}); }
  if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000) {
    throw Object.assign(new Error('Mensagem deve ter 1–2000 caracteres.'), {status:400});
  }
  for (const key of ['trace_id','turn_id','message_id']) {
    if (body[key] !== undefined && !validUuid(body[key])) {
      throw Object.assign(new Error('Identificador de correlação inválido: ' + key), {status:400});
    }
  }
  return {
    message: body.message.trim(),
    trace_id: body.trace_id || uuid(),
    turn_id: body.turn_id || uuid(),
    message_id: body.message_id || uuid(),
  };
}

const server = http.createServer(async (req,res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  try {
    if (![host+':'+port,'localhost:'+port].includes(req.headers.host)) {
      return send(res,403,{error:'Host não autorizado.'});
    }
    if (req.headers.origin && !['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin)) {
      return send(res,403,{error:'Origem não autorizada.'});
    }
    if (req.method === 'GET' && url.pathname === '/api/status') {
      let gemini='offline';
      try {
        const r=await fetch('http://127.0.0.1:9334/json/list',{signal:AbortSignal.timeout(1500)});
        if (r.ok && (await r.json()).some(t=>t.type==='page'&&t.url?.startsWith('https://gemini.google.com/'))) gemini='disponivel';
      } catch {}
      return send(res,200,{ok:true,service:'mcf-parallel-chat',local:'disponivel',gemini});
    }
    if (req.method === 'GET' && url.pathname === '/api/traces') {
      return send(res, 200, {ok:true,events:await readEvents(30)});
    }
    if (req.method === 'POST' && (url.pathname === '/api/local' || url.pathname === '/api/gemini')) {
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')) {
        return send(res,415,{error:'Content-Type application/json obrigatório.'});
      }
      const context = await bodyJSON(req);
      const provider = url.pathname === '/api/local' ? 'local' : 'gemini';
      const begin = Date.now();
      try {
        const result = provider === 'local' ? localReply(context.message) : await askGemini(context.message);
        const elapsed = Date.now() - begin;
        const attribution = envelope(provider,context,'completed',elapsed);
        await logEvent(attribution);
        return send(res,200,{ok:true,...result,attribution,latencyMs:elapsed});
      } catch (error) {
        const attribution = envelope(provider,context,'error',Date.now()-begin);
        await logEvent(attribution);
        if (error instanceof GeminiError) {
          return send(res,503,{ok:false,error:error.message,attribution});
        }
        throw error;
      }
    }
    if (req.method === 'GET' && assets[url.pathname]) {
      const [file,mime]=assets[url.pathname];
      return send(res,200,await fs.readFile(join(dir,file)),mime);
    }
    return send(res,404,{error:'Rota não encontrada.'});
  } catch(err) {
    const status=err.status || (err.name==='GeminiError'?503:500);
    if (status===500) console.error('Server request error:',err.name,err.message);
    return send(res,status,{ok:false,error:status===500?'Erro interno.':err.message});
  }
});
server.headersTimeout=10000;
server.requestTimeout=75000;
server.listen(port,host,()=>console.log('MCF Parallel Chat:', 'http://'+host+':'+port));
