const $ = s => document.querySelector(s);
const form = $('#chatForm'), box = $('#message'), history = $('#history');
const send = $('#sendButton'), count = $('#count');
const sessionId = crypto.randomUUID();
const transcript = [];
let running = false;
function provenance(parent, actorId, role, provider, turnId, messageId = crypto.randomUUID()) {
  const stamp = new Date().toISOString();
  const node = el('div','message-provenance');
  node.textContent = `[${actorId}] ${role} · ${provider} · turn:${turnId.slice(0,8)} · msg:${messageId.slice(0,8)} · ${stamp}`;
  node.title = `Attribution envelope (not cryptographically signed) | session_id=${sessionId} | turn_id=${turnId} | message_id=${messageId} | actor_id=${actorId} | role=${role} | provider=${provider} | timestamp=${stamp}`;
  parent.append(node);
  return { schema:'mcf-attribution-v1',trace_id:sessionId,session_id:sessionId,turn_id:turnId,message_id:messageId,actor_id:actorId,role,provider,timestamp:stamp,signature_type:'attribution-only' };
}
function showAttribution(card, metadata) {
  if (!metadata) return;
  const node = card.querySelector('.message-provenance');
  if (!node) return;
  node.textContent = `[${metadata.actor_id}] ${metadata.role} · ${metadata.provider} · trace:${metadata.trace_id.slice(0,8)} · msg:${metadata.message_id.slice(0,8)} · ${metadata.status}`;
  node.title = JSON.stringify(metadata);
}
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}
function updateStatus(id, text, state = '') {
  const badge = $(id);
  badge.textContent = text;
  badge.className = 'indicator' + (state ? ' ' + state : '');
}
async function refreshStatus() {
  try {
    const response = await fetch('/api/status', {cache:'no-store'});
    const s = await response.json();
    updateStatus('#localStatus', 'Pronto');
    updateStatus('#geminiStatus', s.gemini === 'disponivel' ? 'Conectado' : 'Indisponível',
      s.gemini === 'disponivel' ? '' : 'error');
    $('#connectionText').textContent = s.gemini === 'disponivel' ? '2 fluxos disponíveis' : 'Gemini indisponível';
  } catch {
    updateStatus('#geminiStatus','Sem conexão','error');
    $('#connectionText').textContent = 'Servidor indisponível';
  }
}
function createTurn(message) {
  $('#emptyState')?.remove();
  const turnId = crypto.randomUUID();
  const turn = el('div','turn');
  turn.dataset.turnId = turnId;
  const record = { turn_id:turnId, input:message, messages:[] };
  transcript.push(record);
  const user = el('div','user-message');
  const avatar = el('div','avatar','L');
  const prose = el('div');
  prose.append(el('b',null,'LEANDRO'),el('p',null,message));
  record.messages.push({ ...provenance(prose,'LEANDRO','human','human-input',turnId), text:message });
  user.append(avatar,prose);
  const replies = el('div','responses');
  const cards = [
    ['Motor local','MCF-LOCAL-RULES','deterministic-engine','local-rules'],
    ['Google Gemini','GEMINI-WEB','external-model','gemini-cockpit-web'],
  ].map(([label,actorId,role,provider]) => {
    const card = el('article','reply');
    const head = el('div','reply-head');
    head.append(el('b',null,label),el('small',null,'Processando…'));
    const content = el('div','reply-body','Aguardando resultado...');
    card.append(head,content);
    const entry = provenance(card,actorId,role,provider,turnId);
    entry.parent_message_id = record.messages[0].message_id;
    replies.append(card);
    return {card, status:head.lastChild, content,entry,record};
  });
  turn.append(user,replies);history.append(turn);
  history.scrollTop=history.scrollHeight;
  return cards;
}
async function callEngine(path, message, context) {
  const response = await fetch(path,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message,trace_id:context.trace_id,turn_id:context.turn_id,message_id:context.message_id}),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    const error = new Error(data.error || 'Falha no motor.');
    error.attribution = data.attribution;
    throw error;
  }
  return data;
}
async function deliver(engine, endpoint, message, statusId) {
  updateStatus(statusId,'Respondendo','working');
  const begin = performance.now();
  try {
    const result=await callEngine(endpoint,message,engine.record.messages[0]);
    engine.content.textContent=result.reply;
    const elapsed = result.latencyMs ?? Math.round(performance.now()-begin);
    engine.status.textContent=elapsed+' ms';
    const signed = result.attribution || engine.entry;
    showAttribution(engine.card, signed);
    engine.record.messages.push({...signed,status:'completed',latency_ms:elapsed,text:result.reply});
    updateStatus(statusId,'Pronto');
    if (statusId === '#geminiStatus') $('#connectionText').textContent='Gemini: última resposta confirmada';
    return result;
  } catch(err) {
    const error=err?.message || 'erro desconhecido';
    engine.content.textContent='Não foi possível concluir: '+error;
    engine.status.textContent='Falha';
    showAttribution(engine.card,err?.attribution);
    engine.record.messages.push({...((err?.attribution) || engine.entry),status:'error',latency_ms:Math.round(performance.now()-begin),error});
    updateStatus(statusId,'Falha','error');
    if (statusId === '#geminiStatus') $('#connectionText').textContent='Gemini: falha na última operação';
    return null;
  }
}
form.addEventListener('submit',async(e)=>{
  e.preventDefault();
  const message=box.value.trim();
  if(running||!message||message.length>2000)return;
  running=true;send.disabled=true;
  const [local,gemini]=createTurn(message);
  box.value='';count.textContent='0 / 2000';
  const tasks=[
    deliver(local,'/api/local',message,'#localStatus'),
    deliver(gemini,'/api/gemini',message,'#geminiStatus'),
  ];
  await Promise.allSettled(tasks);
  running=false;send.disabled=false;box.focus();
});
box.addEventListener('input',()=>count.textContent=box.value.length+' / 2000');
box.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey){
    e.preventDefault();
    if(!running)form.requestSubmit();
  }
});
document.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>{
  box.value=b.dataset.example;box.dispatchEvent(new Event('input'));box.focus();
}));
$('#clearButton').addEventListener('click',()=>{
  if(running) return;
  history.replaceChildren(el('div','empty','Histórico limpo. Envie outra pergunta.'));
});
refreshStatus();

// Exportação explícita: nenhuma conversa é salva automaticamente.
const header = document.querySelector('.arena-head');
if (header) {
  const exportButton = el('button','text-button','Exportar conversa JSON ↓');
  exportButton.type = 'button';
  exportButton.title = 'Salva mensagens e envelopes no seu computador apenas quando solicitado.';
  exportButton.addEventListener('click', () => {
    const out = JSON.stringify({
      schema:'mcf-conversation-export-v1',
      exported_at:new Date().toISOString(),
      session_id:sessionId,
      disclaimer:'Metadados de atribuição; não constituem assinaturas criptográficas.',
      turns:transcript,
    },null,2);
    const blob = new Blob([out],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mcf-parallel-chat-' + new Date().toISOString().replace(/[:.]/g,'-') + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url),2000);
  });
  header.append(exportButton);
}
