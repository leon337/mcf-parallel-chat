import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { envelope, validUuid } from '../trace-ledger.mjs';
import { GeminiError } from '../gemini-client.mjs';

const base = process.env.MCF_TEST_URL || 'http://127.0.0.1:48721';

test('Envelope de proveniência emitido pelo backend; actor spoofing rejeitado', async () => {
  const trace_id = randomUUID(), turn_id = randomUUID(), message_id = randomUUID();
  const message = 'CANARY_NOT_TO_LOG_7789: explique testes de API';
  const response = await fetch(base + '/api/local', {
    method:'POST', headers:{'content-type':'application/json'},
    body:JSON.stringify({ message,trace_id,turn_id,message_id,actor_id:'MESTRE' }),
  });
  assert.equal(response.status, 200);
  const output = await response.json();
  assert.equal(output.attribution.actor_id, 'MCF-LOCAL-RULES');
  assert.equal(output.attribution.trace_id, trace_id);
  assert.equal(output.attribution.turn_id, turn_id);
  assert.equal(output.attribution.parent_message_id, message_id);
  assert.equal(output.attribution.signature_type, 'attribution-only');
  assert.ok(validUuid(output.attribution.message_id));
  const audit = await (await fetch(base + '/api/traces')).json();
  assert.equal(audit.ok,true);
  assert.ok(audit.events.some(e => e.turn_id === turn_id));
  assert.ok(!JSON.stringify(audit).includes('CANARY_NOT_TO_LOG_7789'));
});

test('IDs inválidos são rejeitados sem executar motor', async() => {
  const response = await fetch(base+'/api/local', {
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({message:'teste',trace_id:'spoof'}),
  });
  assert.equal(response.status,400);
});

test('GeminiError mantém a classificação especializada', () => {
  const error = new GeminiError('falha controlada');
  assert.equal(error.name,'GeminiError');
  assert.ok(error instanceof GeminiError);
  const ctx={trace_id:randomUUID(),turn_id:randomUUID(),message_id:randomUUID()};
  assert.equal(envelope('gemini',ctx,'error',14).actor_id,'GEMINI-WEB');
});

test('Falha de sessão Gemini retorna HTTP 503 em vez de erro genérico',async()=>{
  const port=49723;
  const server=spawn(process.execPath,['server.mjs'],{
    cwd:new URL('../',import.meta.url).pathname,
    env:{...process.env,PORT:String(port),MCF_GEMINI_DEBUG_URL:'http://127.0.0.1:65534',
      MCF_TRACE_FILE:'/tmp/mcf-parallel-chat-error-test-' + process.pid + '.jsonl'},
    stdio:'ignore',
  });
  try {
    let ready=false;
    for(let i=0;i<30;i++){
      await new Promise(r=>setTimeout(r,100));
      try {const r=await fetch('http://127.0.0.1:'+port+'/api/status');if(r.ok){ready=true;break}}catch{}
    }
    assert.ok(ready,'servidor de falha simulada não iniciou');
    const res=await fetch('http://127.0.0.1:'+port+'/api/gemini',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({message:'Verifique fallback de rede'}),
    });
    const body=await res.json();
    assert.equal(res.status,503);
    assert.equal(body.ok,false);
    assert.equal(body.attribution.actor_id,'GEMINI-WEB');
    assert.equal(body.attribution.status,'error');
    assert.match(body.error,/Gemini indisponível/);
  }finally{
    server.kill('SIGTERM');
  }
});
