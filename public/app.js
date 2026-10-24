const $ = s => document.querySelector(s);
const form = $('#chatForm'), box = $('#message'), history = $('#history');
const send = $('#sendButton'), count = $('#count');
let running = false;
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
  const turn = el('div','turn');
  const user = el('div','user-message');
  const avatar = el('div','avatar','L');
  const prose = el('div');
  prose.append(el('b',null,'Você'),el('p',null,message));
  user.append(avatar,prose);
  const replies = el('div','responses');
  const cards = ['Motor local','Google Gemini'].map(label => {
    const card = el('article','reply');
    const head = el('div','reply-head');
    head.append(el('b',null,label),el('small',null,'Processando…'));
    const content = el('div','reply-body','Aguardando resultado...');
    card.append(head,content);
    replies.append(card);
    return {card, status:head.lastChild, content};
  });
  turn.append(user,replies);history.append(turn);
  history.scrollTop=history.scrollHeight;
  return cards;
}
async function callEngine(path, message) {
  const response = await fetch(path,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message}),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || 'Falha no motor.');
  return data;
}
async function deliver(engine, endpoint, message, statusId) {
  updateStatus(statusId,'Respondendo','working');
  const begin = performance.now();
  try {
    const result=await callEngine(endpoint,message);
    engine.content.textContent=result.reply;
    engine.status.textContent=(result.latencyMs ?? Math.round(performance.now()-begin))+' ms';
    updateStatus(statusId,'Pronto');
    return result;
  } catch(err) {
    engine.content.textContent='Não foi possível concluir: '+(err?.message || 'erro desconhecido');
    engine.status.textContent='Falha';
    updateStatus(statusId,'Falha','error');
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
