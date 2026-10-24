const base='http://127.0.0.1:48721';
const message='Teste de integracao do MCF Parallel Chat: em uma frase, explique o que e um chatbot e cite uma boa pratica de seguranca.';
const start=Date.now();
const ask=async (route)=>{const r=await fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message})});const d=await r.json();return {http:r.status,ok:d.ok,source:d.source,latencyMs:Date.now()-start,reply:(d.reply||d.error||'').slice(0,550)}};
const [local,gemini]=await Promise.allSettled([ask('/api/local'),ask('/api/gemini')]);
console.log('LIVE_PARALLEL_TEST',JSON.stringify({local,gemini},null,2));