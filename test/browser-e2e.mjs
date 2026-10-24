const tabs=await(await fetch('http://127.0.0.1:9334/json/list')).json();
const t=tabs.find(x=>x.type==='page'&&x.url==='http://127.0.0.1:48721/');
if(!t)throw Error('Chatbot page not found');
const socket=new WebSocket(t.webSocketDebuggerUrl);
let n=0; const pending=new Map();
socket.onmessage=(ev)=>{const msg=JSON.parse(ev.data);if(pending.has(msg.id)){const [resolve,reject]=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(msg.error):resolve(msg.result)}};
const call=(method,params)=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,[resolve,reject]);socket.send(JSON.stringify({id,method,params}))});
const evalJS=async(js)=>(await call('Runtime.evaluate',{expression:js,returnByValue:true})).result?.value;
socket.onopen=async()=>{
 try{
  const submit=await evalJS(`(()=>{const t=document.querySelector('#message');if(!t||document.querySelectorAll('.turn').length!==0)return 'unexpected-existing-state';t.value='Teste E2E do MCF Parallel Chat: diga olá e cite uma dica curta de programação.';t.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#chatForm').requestSubmit();return 'submitted';})()`);
  console.log('UI_SUBMIT',submit);
  if(submit!=='submitted')return;
  const start=Date.now();let last='';
  while(Date.now()-start<69000){
   await new Promise(r=>setTimeout(r,1000));
   const result=JSON.parse(await evalJS(`JSON.stringify({turns:document.querySelectorAll('.turn').length,labels:[...document.querySelectorAll('.reply-head small')].map(e=>e.textContent),replies:[...document.querySelectorAll('.reply-body')].map(e=>e.textContent.slice(0,160)),pending:document.querySelector('#sendButton').disabled})`));
   last=result;
   if(!result.pending){console.log('UI_E2E',JSON.stringify(result));return}
  }
  console.log('UI_E2E_TIMEOUT',JSON.stringify(last))
 }catch(err){console.error('E2E_ERROR',String(err))}finally{socket.close()}
};
