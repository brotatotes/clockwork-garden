/* Actual Chromium tab visibility via raw CDP, without Playwright focus emulation. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const dir = fs.mkdtempSync(path.join(os.homedir(), 'snap/chromium/common/garden-lifecycle-'));
fs.copyFileSync(path.join(root, 'Clockwork-Garden.html'), path.join(dir, 'Clockwork-Garden.html'));
const child = spawn('/snap/bin/chromium', ['--no-sandbox','--no-first-run','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${dir}/profile`,'about:blank']);
let ws, sequence = 0;
const waiting = new Map();
const delay = ms => new Promise(r => setTimeout(r, ms));
const watchdog = setTimeout(() => { child.kill('SIGTERM'); process.exit(2); }, 45000);
function send(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((resolve,reject) => {
    waiting.set(id,{resolve,reject});
    ws.send(JSON.stringify({id,method,params,...(sessionId ? {sessionId} : {})}));
  });
}
(async () => {
  const endpoint = await new Promise((resolve,reject) => {
    let text='';
    child.stderr.on('data',chunk => {text+=chunk;const match=text.match(/DevTools listening on (ws:\/\/\S+)/);if(match)resolve(match[1]);});
    child.on('error',reject);
    child.on('exit',code => reject(Error('Chromium exited '+code)));
  });
  ws = new WebSocket(endpoint);
  await new Promise((resolve,reject) => {ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage = event => {
    const reply=JSON.parse(event.data),pending=waiting.get(reply.id);
    if(pending){waiting.delete(reply.id);reply.error ? pending.reject(Error(JSON.stringify(reply.error))) : pending.resolve(reply.result);}
  };
  const {targetId} = await send('Target.createTarget',{url:'file://'+path.join(dir,'Clockwork-Garden.html')});
  const {sessionId} = await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Target.activateTarget',{targetId});
  const evaluate = async expression => {
    const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await delay(900);
  assert.equal(await evaluate('document.hidden'),false);
  const point=await evaluate("JSON.stringify((()=>{const r=document.querySelector('#play').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})())");
  const {x,y}=JSON.parse(point);
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1},sessionId);
  await delay(900);
  const before=await evaluate('({hidden:document.hidden,running:engine.running,played:engine.played,context:engine.ctx.state})');
  assert(before.running && before.played>0);
  const other=await send('Target.createTarget',{url:'about:blank'});
  await send('Target.activateTarget',{targetId:other.targetId});
  await delay(500);
  const hidden=await evaluate('({hidden:document.hidden,running:engine.running,played:engine.played,queue:engine.queue.length,status:document.querySelector("#status").textContent})');
  assert.equal(hidden.hidden,true);
  assert.equal(hidden.running,false);
  assert.equal(hidden.queue,0);
  await send('Target.activateTarget',{targetId});
  await delay(600);
  const returned=await evaluate('({hidden:document.hidden,running:engine.running,played:engine.played})');
  assert.equal(returned.hidden,false);
  assert.equal(returned.running,false);
  assert.equal(returned.played,hidden.played);
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1},sessionId);
  await delay(700);
  const resumed=await evaluate('({hidden:document.hidden,running:engine.running,newNotes:engine.played-'+hidden.played+',queue:engine.queue.length})');
  assert(resumed.running && resumed.newNotes>0 && resumed.newNotes<=8);
  const report={passed:true,method:'Headed Chromium under Xvfb, raw CDP target activation and mouse input, genuine document.hidden, no synthetic visibility events',before,hidden,returned,resumed};
  fs.writeFileSync(path.join(root,'evidence/verify-lifecycle.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(ws && ws.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}ws.close();}
  child.kill('SIGTERM');clearTimeout(watchdog);
});
