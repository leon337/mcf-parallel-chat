import test from 'node:test';
import assert from 'node:assert/strict';
import { localReply } from '../local-engine.mjs';
const base = 'http://127.0.0.1:48721';
const post = (url,body,headers={}) => fetch(base+url,{
  method:'POST',headers:{'content-type':'application/json',...headers},
  body:JSON.stringify(body),
});
test('motor local: roteamento e identificação transparentes',()=>{
  const a=localReply('Como criar um chatbot?');
  assert.equal(a.source,'local-rules');
  assert.match(a.reply,/modelo|arquitetura|motor/i);
  const b=localReply('Quero testar um bug');
  assert.match(b.title,/Qualidade/);
  assert.throws(()=>localReply(' '),RangeError);
  assert.throws(()=>localReply('x'.repeat(2001)),RangeError);
});
test('HTTP e UI: páginas e status',async()=>{
  const res=await fetch(base+'/');
  assert.equal(res.status,200);
  assert.match(await res.text(),/MCF PARALLEL/);
  const health=await (await fetch(base+'/api/status')).json();
  assert.equal(health.ok,true);
  assert.equal(health.local,'disponivel');
});
test('contrato de resposta local',async()=>{
  const res=await post('/api/local',{message:'Como criar uma arquitetura?'});
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.ok,true);
  assert.equal(data.source,'local-rules');
  assert.ok(data.reply.length>30);
});
test('segurança: validação, método e origem',async()=>{
  const bad=await post('/api/local',{message:'   '});
  assert.equal(bad.status,400);
  const forged=await post('/api/local',{message:'teste'},{origin:'https://example.org'});
  assert.equal(forged.status,403);
  const missing=await post('/api/local',{message:'x'.repeat(3000)});
  assert.equal(missing.status,400);
  const unknown=await fetch(base+'/../../etc/passwd');
  assert.equal(unknown.status,404);
});
test('paralelismo: resposta local não espera o motor Gemini',async()=>{
  const started=Date.now();
  const local=post('/api/local',{message:'Como fazer testes?'});
  const status=fetch(base+'/api/status');
  const [a,b]=await Promise.all([local,status]);
  assert.equal(a.status,200);
  assert.equal(b.status,200);
  assert.ok(Date.now()-started<4000,'consultas leves devem concluir rapidamente');
});
