import test from 'node:test';
import assert from 'node:assert/strict';
import {localReply} from '../local-engine.mjs';
process.env.MCF_GEMINI_DEBUG_URL='http://127.0.0.1:65534';
const {askGemini, GeminiError}=await import('../gemini-client.mjs');

test('Gemini indisponível não derruba motor local',async()=>{
  const begin=performance.now();
  const outcome=await Promise.allSettled([
    Promise.resolve(localReply('Como fazer arquitetura?')),
    askGemini('teste de falha isolada'),
  ]);
  assert.equal(outcome[0].status,'fulfilled');
  assert.equal(outcome[1].status,'rejected');
  assert.ok(outcome[1].reason instanceof GeminiError);
  assert.ok(performance.now()-begin<6000);
});
test('Limites do Gemini rejeitam prompt inválido antes da conexão',async()=>{
  await assert.rejects(askGemini(''),GeminiError);
  await assert.rejects(askGemini('x'.repeat(2001)),GeminiError);
});
