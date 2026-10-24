import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiTargets, selectGeminiTarget } from '../gemini-target.mjs';
const target = (url, id) => ({ id, type:'page', url, webSocketDebuggerUrl:'ws://127.0.0.1:9334/devtools/page/'+id });
const generic = target('https://gemini.google.com/app', 'generic');
const scoped = target('https://gemini.google.com/u/1/app?pli=1', 'scoped-1');
test('single Gemini: generic profile remains supported', () => {
  assert.equal(selectGeminiTarget([generic]).target.id,'generic');
  assert.equal(selectGeminiTarget([generic]).profile,'default');
});
test('two Gemini pages: prefer uniquely identified profile regardless of list order', () => {
  for(const tabs of [[generic,scoped],[scoped,generic]]) {
    const result = selectGeminiTarget(tabs);
    assert.equal(result.target.id,'scoped-1');
    assert.equal(result.profile,'1');
  }
});
test('multiple distinct account profiles: fail closed (no arbitrary cross-account send)', () => {
  const second = target('https://gemini.google.com/u/2/app', 'scoped-2');
  assert.throws(()=>selectGeminiTarget([generic,scoped,second]),/várias contas/);
  assert.equal(selectGeminiTarget([generic,scoped,second],'2').target.id,'scoped-2');
  assert.equal(selectGeminiTarget([generic,scoped,second],'default').target.id,'generic');
});
test('invalid and duplicate selections are refused', () => {
  assert.throws(()=>selectGeminiTarget([]),/Nenhuma sessão/);
  assert.throws(()=>selectGeminiTarget([generic,generic]),/múltiplas páginas/);
  assert.throws(()=>selectGeminiTarget([scoped,scoped],'1'),/não está aberto/);
  assert.throws(()=>selectGeminiTarget([generic], 'not-a-profile'),/inválido/);
});
test('reject host spoofing, frames, data and unrelated urls', () => {
  const inputs=[
    target('https://gemini.google.com.evil.example/app','bad-host'),
    target('http://gemini.google.com/app','insecure'),
    target('https://other.example/app','unrelated'),
    target('javascript:alert(1)','script'),
    target('https://gemini.google.com/settings','settings'),
    { ...scoped, type:'iframe' },
    { ...scoped, webSocketDebuggerUrl:null },
  ];
  assert.equal(geminiTargets([...inputs,generic]).length,1);
  assert.equal(selectGeminiTarget([...inputs,generic]).target.id,'generic');
});
