/* DOM controller for the local musical garden. */
'use strict';
const M = GardenMusic, $ = id => document.getElementById(id);
let garden = M.example(), seed = 'bell', selected = null, linking = false, drag = null;
const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}) { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; }
function say(text) { $('status').textContent = text; }
function blossom(species) {
  const g = svg('g', {class: 'bloom'}), color = M.SPECIES[species].color;
  const petalCount = species === 'clover' ? 3 : species === 'moss' ? 8 : species === 'reed' ? 4 : 6;
  for (let i = 0; i < petalCount; i++) {
    const shape = species === 'reed' ? svg('path', {d:'M0 0 Q-9 -15 0 -27 Q9 -15 0 0'}) : svg('ellipse', {cx:0, cy:-12, rx:species === 'clover' ? 11 : 6, ry:species === 'moss' ? 9 : 13});
    shape.setAttribute('fill', color); shape.setAttribute('stroke', '#fff2c3'); shape.setAttribute('stroke-width', '.7'); shape.setAttribute('transform', 'rotate(' + i * 360 / petalCount + ')'); g.append(shape);
  }
  g.append(svg('circle', {r:8, fill:'#ae813e', stroke:'#f0db9e', 'stroke-width':2}), svg('circle', {r:3, fill:'#2d4b3d'}));
  return g;
}
function cell(f) { return {x:f.x * 60 + 30, y:f.y * 60 + 30}; }
function render() {
  const bed = $('bed'); bed.replaceChildren();
  const defs = svg('defs'), marker = svg('marker', {id:'arrow', viewBox:'0 0 10 10', refX:9, refY:5, markerWidth:5, markerHeight:5, orient:'auto-start-reverse'});
  marker.append(svg('path', {d:'M0 0 L10 5 L0 10 Z', fill:'#d8bc78'})); defs.append(marker); bed.append(defs);
  for (let x=1;x<16;x++) bed.append(svg('path',{d:`M${x*60} 0V480`,class:'gridline'}));
  for (let y=1;y<8;y++) bed.append(svg('path',{d:`M0 ${y*60}H960`,class:'gridline'}));
  bed.append(svg('rect',{id:'scan',x:0,y:0,width:60,height:480,class:'scan',visibility:engine.running?'visible':'hidden'}));
  for (const link of garden.links) {
    const a = cell(garden.flowers.find(f=>f.id===link.from)), b=cell(garden.flowers.find(f=>f.id===link.to));
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy), bx=b.x-dx/len*29,by=b.y-dy/len*29;
    bed.append(svg('path',{d:`M${a.x} ${a.y} Q${(a.x+b.x)/2} ${(a.y+b.y)/2-35} ${bx} ${by}`,class:'vine','marker-end':'url(#arrow)'}));
  }
  for (const f of garden.flowers) {
    const p=cell(f),g=svg('g',{transform:`translate(${p.x} ${p.y})`,class:'flower'+(selected===f.id?' selected':''),tabindex:0,role:'button','data-id':f.id,'aria-label':`${M.SPECIES[f.species].name}, ${M.noteName(f)}, eighth note ${f.x+1}. Arrow keys move, Delete removes.`});
    g.append(svg('circle',{r:29,class:'halo'}),svg('path',{d:'M0 5 Q-3 19 5 29 M1 18 Q-18 5 -12 20 Q-5 26 1 18',fill:'#7f9c68',stroke:'#b2b583','stroke-width':1.5}),blossom(f.species));
    bed.append(g);
  }
  $('count').textContent=garden.flowers.length+' / 16 flowers';
  const f=garden.flowers.find(f=>f.id===selected);
  $('selection').textContent=f?M.SPECIES[f.species].name:'Your garden awaits';
  $('details').textContent=f?`${M.noteName(f)} · Eighth note ${f.x+1} of 16. ${linking?'Choose another flower for a quiet reply.':'Move up for higher notes, right for later notes.'}`:'Select a flower to move it or grow a vine.';
  $('connect').disabled=$('remove').disabled=!f;
  for(const id of ['higher','lower','earlier','later']) $(id).disabled=!f;
  $('plant').disabled=garden.flowers.length>=16;
  $('unlink').disabled=!f||!garden.links.some(l=>l.from===f.id);
  $('connect').textContent=linking?'Cancel vine':'Grow a vine';
  $('tempo').value=garden.tempo; $('bpm').textContent=garden.tempo+' BPM';
}
const engine = new M.Engine(()=>garden, e=>{
  if (e.step!==undefined) { const scan=$('scan'); scan.setAttribute('x',e.step*60); scan.setAttribute('visibility','visible'); }
  if (e.id) { const f=document.querySelector(`[data-id="${e.id}"]`); if(f) { f.classList.remove('sounding'); void f.getBoundingClientRect(); f.classList.add('sounding'); setTimeout(()=>f.classList.remove('sounding'),500); } }
}, running=>{
  $('play').textContent=running?'Pause the garden':'Wake the garden';
  $('playing-state').textContent=running?'The garden is singing':'Resting, ready to bloom';
  say(running?'The garden is playing. All changes become part of the next notes.':'Garden paused. Press Wake the garden to restart the phrase.');
  $('hint').textContent=running?'The light follows the music. Move a flower higher for a higher note, or right for a later start.':'Press Wake the garden to listen. Choose a seed, then plant in an empty space.';
  if(!running && $('scan')) $('scan').setAttribute('visibility','hidden');
});
for (const [key,s] of Object.entries(M.SPECIES)) {
  const b=document.createElement('button'); b.className='seed'; b.dataset.species=key; b.setAttribute('aria-pressed',String(seed===key));
  const art=svg('svg',{viewBox:'-30 -30 60 60','aria-hidden':'true'}); art.append(blossom(key));
  const label=document.createElement('span'), title=document.createElement('strong'),description=document.createElement('small');title.textContent=s.name;description.textContent=s.description;label.append(title,description);b.append(art,label);
  b.onclick=()=>{seed=key; linking=false;document.querySelectorAll('.seed').forEach(e=>e.setAttribute('aria-pressed',String(e===b)));say(s.name+' seed ready. Click an empty space to plant.');render();};$('seeds').append(b);
}
function locationOf(event) {
  const p=new DOMPoint(event.clientX,event.clientY).matrixTransform($('bed').getScreenCTM().inverse());
  return {x:Math.max(0,Math.min(15,Math.floor(p.x/60))),y:Math.max(0,Math.min(7,Math.floor(p.y/60)))};
}
function select(id) {
  if(linking&&id!==selected) {garden.links=garden.links.filter(l=>l.from!==selected);garden.links.push({from:selected,to:id});linking=false;say('Vine grown. The second flower will reply one eighth note later.');}
  else selected=id;
  render();
}
function plant(p) {
  if(garden.flowers.some(f=>f.x===p.x&&f.y===p.y))return;
  if(garden.flowers.length>=16){say('The bed is full. Remove a flower before planting.');return;}
  selected=1;while(garden.flowers.some(f=>f.id===selected))selected++;
  garden.flowers.push({id:selected,species:seed,...p});linking=false;render();say(M.SPECIES[seed].name+' planted.');
}
function pressBed(e, allowDrag) {
  const target=e.target.closest('[data-id]');
  if(target){const id=Number(target.dataset.id),wasLinking=linking;select(id);if(allowDrag&&!wasLinking){drag={id,startX:e.clientX,startY:e.clientY,moved:false};$('bed').setPointerCapture(e.pointerId);}}
  else plant(locationOf(e));
}
let touchStart=null;
$('bed').addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'){touchStart={x:e.clientX,y:e.clientY};return;}
  pressBed(e,true);
});
$('bed').addEventListener('pointermove',e=>{
  if(!drag||Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<6)return;
  const p=locationOf(e),f=garden.flowers.find(f=>f.id===drag.id);if(!garden.flowers.some(other=>other.id!==f.id&&other.x===p.x&&other.y===p.y)){Object.assign(f,p);drag.moved=true;render();}
});
$('bed').addEventListener('pointerup',e=>{
  if(e.pointerType==='touch'&&touchStart&&Math.hypot(e.clientX-touchStart.x,e.clientY-touchStart.y)<8)pressBed(e,false);
  drag=null;touchStart=null;
});
$('bed').addEventListener('pointercancel',()=>{drag=null;touchStart=null;});
$('plant').onclick=()=>{
  for(let x=0;x<16;x++)for(let y=4;y<12;y++)if(!garden.flowers.some(f=>f.x===x&&f.y===y%8)){
    plant({x,y:y%8});document.querySelector(`[data-id="${selected}"]`).focus();return;
  }
};
function moveSelected(dx,dy){
  const f=garden.flowers.find(f=>f.id===selected);if(!f)return;
  const x=Math.max(0,Math.min(15,f.x+dx)),y=Math.max(0,Math.min(7,f.y+dy));
  if(garden.flowers.some(o=>o.id!==f.id&&o.x===x&&o.y===y)){say('Another flower occupies that space.');return;}
  Object.assign(f,{x,y});render();say(M.noteName(f)+', eighth note '+(f.x+1));
}
$('higher').onclick=()=>moveSelected(0,-1);$('lower').onclick=()=>moveSelected(0,1);
$('earlier').onclick=()=>moveSelected(-1,0);$('later').onclick=()=>moveSelected(1,0);
function remove(){if(!selected)return;garden.flowers=garden.flowers.filter(f=>f.id!==selected);garden.links=garden.links.filter(l=>l.from!==selected&&l.to!==selected);selected=null;linking=false;render();say('Flower removed.');}
$('bed').addEventListener('keydown',e=>{
  const target=e.target.closest('[data-id]');if(!target)return;const id=Number(target.dataset.id),f=garden.flowers.find(f=>f.id===id);
  if(e.key==='Enter'||e.key===' '){e.preventDefault();select(id);document.querySelector(`[data-id="${id}"]`).focus();return;}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();selected=id;remove();$('play').focus();return;}
  const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;e.preventDefault();const x=Math.max(0,Math.min(15,f.x+delta[0])),y=Math.max(0,Math.min(7,f.y+delta[1]));if(!garden.flowers.some(o=>o.id!==id&&o.x===x&&o.y===y)){f.x=x;f.y=y;selected=id;render();document.querySelector(`[data-id="${id}"]`).focus();say(M.noteName(f)+', eighth note '+(f.x+1));}
});
$('play').onclick=async()=>{$('play').disabled=true;try{if(engine.running)engine.pause();else await engine.play();}catch(e){say(e.message);}finally{$('play').disabled=false;}};
$('volume').oninput=e=>engine.setVolume(Number(e.target.value)/100);
$('tempo').oninput=e=>{garden.tempo=Number(e.target.value);$('bpm').textContent=garden.tempo+' BPM';};
$('connect').onclick=()=>{linking=!linking;render();};$('remove').onclick=remove;
$('clear').onclick=()=>{engine.pause();garden.flowers=[];garden.links=[];selected=null;linking=false;render();say('An empty bed. Choose a seed and plant.');};
$('reset').onclick=()=>{engine.pause();garden=M.example();selected=null;linking=false;render();say('Example garden restored. Press play to listen.');};
document.addEventListener('visibilitychange',()=>{if(document.hidden){engine.pause();say('Paused while the tab was away. Press play to resume.');}});
const STORAGE_KEY = 'clockwork-garden-v1';
function replaceGarden(value, message) {
  const checked = M.validate(value);
  engine.pause(); garden=checked; selected=null; linking=false; drag=null;
  render(); say(message + ' Press Wake the garden to listen.');
}
$('unlink').onclick=()=>{garden.links=garden.links.filter(l=>l.from!==selected);linking=false;render();say('Outgoing vine removed.');};
$('save').onclick=()=>{
  try { localStorage.setItem(STORAGE_KEY,M.serialize(garden)); $('save-state').textContent='Garden saved in this browser. Export a file before moving or renaming the HTML.'; say('Saved here.'); }
  catch(error) { say('This browser could not save locally. Use Export garden for a file instead.'); }
};
$('load').onclick=()=>{
  try { const text=localStorage.getItem(STORAGE_KEY); if(text===null) { say('No garden is saved here yet.'); return; } replaceGarden(M.parse(text),'Saved garden restored.'); }
  catch(error) { say('Saved garden could not be loaded. Your current garden is unchanged. '+error.message); }
};
$('export').onclick=()=>{
  try {
    const blob=new Blob([M.serialize(garden)+'\n'],{type:'application/json'}), url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='Clockwork-Garden.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    say('Garden file prepared. Keep it with your HTML file.');
  } catch(error) { say('Export failed. '+error.message); }
};
$('import').onclick=()=>$('file').click();
$('file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try { if(file.size>M.MAX_TEXT)throw Error('Garden files must be under 12 KB.');const value=M.parse(await file.text());replaceGarden(value,'Garden file opened.'); }
  catch(error){say('Import failed. Your current garden is unchanged. '+error.message);}
  finally{e.target.value='';}
};
$('share').onclick=()=>{$('share-panel').hidden=false;$('share-code').value=M.fragment(garden);$('share-code').focus();$('share-code').select();say('Copy the composition code, or paste one here to open it.');};
$('copy-code').onclick=async()=>{
  const area=$('share-code');area.focus();area.select();
  try{if(!navigator.clipboard)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(area.value);say('Composition code copied.');}
  catch(error){say('Automatic copy is unavailable. The code is selected. Use your browser’s Copy command.');}
};
$('open-code').onclick=()=>{try{replaceGarden(M.fromFragment($('share-code').value.trim()),'Shared garden opened.');}catch(error){say('Code not opened. Your current garden is unchanged. '+error.message);}};
$('close-code').onclick=()=>{$('share-panel').hidden=true;$('share').focus();};
function loadFragment(){if(!location.hash)return;try{replaceGarden(M.fromFragment(location.hash),'Shared garden opened.');}catch(error){say('URL garden code was rejected. '+error.message);}}
window.addEventListener('hashchange',loadFragment);
function frame(){engine.frame();requestAnimationFrame(frame);}render();loadFragment();requestAnimationFrame(frame);
