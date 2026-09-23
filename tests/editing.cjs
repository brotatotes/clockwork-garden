const assert = require('node:assert/strict');
const M = require('../engine.js');
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS ' + name); }
const garden = M.example();
const copy = () => structuredClone(garden);
check('JSON roundtrip preserves every composition field', () => assert.deepEqual(M.parse(M.serialize(garden)), garden));
check('Fragment roundtrip preserves composition', () => assert.deepEqual(M.fromFragment(M.fragment(garden)), garden));
check('Empty garden roundtrip', () => assert.deepEqual(M.parse(M.serialize({version:1,tempo:60,flowers:[],links:[]})), {version:1,tempo:60,flowers:[],links:[]}));
check('Output strips unknown private metadata', () => assert.equal(M.serialize({...garden,email:'private@example.test'}).includes('private'), false));
const invalid = [
  ['wrong version', g=>g.version=2], ['tempo below cap', g=>g.tempo=59], ['tempo above cap',g=>g.tempo=121],
  ['tempo infinity',g=>g.tempo=Infinity], ['tempo string',g=>g.tempo='84'], ['too many flowers',g=>g.flowers=Array.from({length:17},(_,i)=>({id:i+1,species:'bell',x:i%16,y:Math.floor(i/16)}))],
  ['duplicate id',g=>g.flowers[1].id=g.flowers[0].id], ['duplicate cell',g=>Object.assign(g.flowers[1],{x:0,y:7})],
  ['unknown species',g=>g.flowers[0].species='thorn'], ['prototype species',g=>g.flowers[0].species='__proto__'], ['array species',g=>g.flowers[0].species=['bell']],
  ['fractional position',g=>g.flowers[0].x=.5], ['negative position',g=>g.flowers[0].y=-1], ['outside position',g=>g.flowers[0].x=16],
  ['unsafe id',g=>g.flowers[0].id=1e9], ['null flower',g=>g.flowers[0]=null],
  ['dangling vine',g=>g.links=[{from:1,to:999}]], ['self vine',g=>g.links=[{from:1,to:1}]], ['multiple replies',g=>g.links=[{from:1,to:2},{from:1,to:3}]],
  ['null link',g=>g.links=[null]], ['missing flowers',g=>delete g.flowers]
];
for(const [name, mutate] of invalid) check('Reject '+name,()=>{const g=copy();mutate(g);assert.throws(()=>M.validate(g));});
for(const text of ['', '{', 'null', '[]', 'true', 'x'.repeat(12001)]) check('Reject malformed JSON '+text.length,()=>assert.throws(()=>M.parse(text)));
for(const text of ['#garden=', '#garden=%%%%', '#garden='+ 'a'.repeat(12001), '#other=abc', '#garden=bm90LWpzb24=']) check('Reject malformed code '+text.length,()=>assert.throws(()=>M.fromFragment(text)));
check('Maximum valid garden and bounded cyclic links',()=>{const g={version:1,tempo:120,flowers:Array.from({length:16},(_,i)=>({id:i+1,species:'moss',x:i,y:0})),links:Array.from({length:16},(_,i)=>({from:i+1,to:(i+1)%16+1}))};assert.deepEqual(M.fromFragment(M.fragment(g)),g);assert(M.eventsAt(g,0).length<=32);});
console.log(checks+' editing checks passed.');
