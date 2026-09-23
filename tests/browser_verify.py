#!/usr/bin/env python3
"""Real Chromium audio, lifecycle and stress verification. Run under xvfb-run."""
import json
import shutil
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence'
report = {'checks': [], 'subjectiveListening': False, 'physicalDevice': False, 'passed': False}
signal_js = '''async (duration) => {
  let peak=0,sum=0,count=0,nonfinite=0;
  const a=new Float32Array(engine.analyser.fftSize),end=performance.now()+duration;
  while(performance.now()<end){
    engine.analyser.getFloatTimeDomainData(a);
    for(const v of a){peak=Math.max(peak,Math.abs(v));sum+=v*v;count++;if(!Number.isFinite(v))nonfinite++;}
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  return {peak,rms:Math.sqrt(sum/count),count,nonfinite};
}'''
with tempfile.TemporaryDirectory(prefix='garden-verify-', dir=Path.home()/'snap/chromium/common') as staging, sync_playwright() as p:
    html=Path(staging)/'Clockwork-Garden.html'
    shutil.copy2(ROOT/'Clockwork-Garden.html',html)
    browser=p.chromium.launch(executable_path='/snap/bin/chromium',headless=False,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1050},offline=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(html.as_uri())
    assert page.evaluate('engine.ctx===undefined && !engine.running')
    page.locator('#play').click()
    page.wait_for_function('engine.played>2')
    report['liveDefault']=page.evaluate(signal_js,1300)
    assert 0.001<report['liveDefault']['peak']<1 and not report['liveDefault']['nonfinite']
    page.locator('#volume').fill('0')
    page.wait_for_timeout(350)
    report['muted']=page.evaluate(signal_js,400)
    assert report['muted']['peak']<0.00001
    page.locator('#volume').fill('100')
    page.wait_for_timeout(150)
    report['fullVolume']=page.evaluate(signal_js,1000)
    assert report['fullVolume']['peak']>0.001
    report['checks'].append('Offline first-use is silent, explicit playback produces live signal, volume zero mutes and full volume restores signal')
    report['visibilityCoverage']='Actual tab visibility is tested separately by browser_lifecycle.cjs through raw CDP without Playwright focus emulation. See verify-lifecycle.json. Earlier harness failures remain in the development evidence.'
    page.evaluate('engine.ctx.suspend()')
    page.wait_for_function('!engine.running')
    page.evaluate('engine.ctx.resume()')
    assert not page.evaluate('engine.running')
    page.locator('#play').click()
    page.wait_for_function('engine.running')
    report['checks'].append('Actual AudioContext suspension pauses transport; resuming context alone never restarts music')
    page.locator('#clear').click()
    for _ in range(16):
        page.locator('#plant').click()
    assert page.locator('.flower').count()==16 and page.locator('#plant').is_disabled()
    page.evaluate('plant({x:15,y:7})')
    assert page.locator('.flower').count()==16
    page.locator('#tempo').fill('120')
    page.locator('#play').click()
    page.wait_for_function('engine.running')
    report['liveMaxGarden']=page.evaluate(signal_js,1700)
    assert 0.001<report['liveMaxGarden']['peak']<1 and not report['liveMaxGarden']['nonfinite']
    report['backlog']=page.evaluate('''() => {
      const before=engine.played;engine.next=engine.ctx.currentTime-60;engine.tick();
      return {newNotes:engine.played-before,nextDelta:engine.next-engine.ctx.currentTime,queue:engine.queue.length};
    }''')
    assert report['backlog']['newNotes']<=32 and 0<report['backlog']['nextDelta']<0.7
    report['checks'].append('UI reaches but never exceeds 16 flowers at 120 BPM with finite unclipped live audio; delayed scheduler drops backlog')
    page.locator('#play').click()
    page.wait_for_timeout(200)
    report['paused']=page.evaluate(signal_js,300)
    assert report['paused']['peak']<0.00001
    report['offline']=page.evaluate('''async () => {
      const rate=24000,seconds=10,results={};
      async function render(g){
        const c=new OfflineAudioContext(1,rate*seconds,rate),out=c.createGain();out.gain.value=1;out.connect(c.destination);
        const eighth=30/g.tempo;
        for(let t=.05,i=0;t<8;t+=eighth,i++)for(const e of M.eventsAt(g,i%16))M.voice(c,out,e.flower,t+e.delay*eighth,e.gain);
        const b=await c.startRendering(),a=b.getChannelData(0);let peak=0,sum=0,nonfinite=0;
        for(const v of a){peak=Math.max(peak,Math.abs(v));sum+=v*v;if(!Number.isFinite(v))nonfinite++;}
        return {a,stats:{peak,rms:Math.sqrt(sum/a.length),nonfinite}};
      }
      const base=M.example(),original=await render(base);results.default=original.stats;
      for(const change of ['pitch','time','species','links','tempo']){
        const g=structuredClone(base);
        if(change==='pitch')g.flowers[1].y=7;
        if(change==='time')g.flowers[1].x=3;
        if(change==='species')g.flowers[1].species='reed';
        if(change==='links')g.links=[];
        if(change==='tempo')g.tempo=120;
        const r=await render(g);let difference=0;for(let i=0;i<r.a.length;i++)difference+=Math.abs(r.a[i]-original.a[i]);
        results[change]={...r.stats,meanAbsoluteDifference:difference/r.a.length};
      }
      for(const species of Object.keys(M.SPECIES)){
        const flowers=Array.from({length:16},(_,i)=>({id:i+1,species,x:Math.floor(i/8),y:i%8}));
        const g=M.validate({version:1,tempo:120,flowers,links:flowers.map((f,i)=>({from:f.id,to:(i+1)%16+1}))});
        results['max_'+species]=(await render(g)).stats;
      }
      return results;
    }''')
    assert all(v['nonfinite']==0 and 0<v['peak']<1 for v in report['offline'].values())
    assert all(report['offline'][k]['meanAbsoluteDifference']>0.0001 for k in ['pitch','time','species','links','tempo'])
    report['checks'].append('Production synthesis offline rendering is finite/unclipped for default and four 16-flower cyclic-vine stress gardens at full volume/120 BPM; pitch, timing, species, vines and tempo each change the actual signal')
    report['cleanup']=page.evaluate('''async () => {
      const c=engine.ctx,original=c.createGain.bind(c);let created=0,disconnected=0;
      c.createGain=()=>{const g=original();created++;const d=g.disconnect.bind(g);g.disconnect=()=>{disconnected++;d();};return g;};
      for(const species of Object.keys(M.SPECIES))M.voice(c,c.destination,{species,y:4},c.currentTime+.02);
      await new Promise(resolve=>setTimeout(resolve,1750));c.createGain=original;
      return {created,disconnected};
    }''')
    assert report['cleanup']['created']==report['cleanup']['disconnected']
    report['checks'].append('Every generated per-voice gain including envelope disconnects after oscillator completion')
    failure=context.new_page()
    failure.add_init_script('window.AudioContext=undefined;window.webkitAudioContext=undefined;')
    failure.goto(html.as_uri())
    failure.locator('#play').click()
    assert 'Web Audio is unavailable' in failure.locator('#status').inner_text()
    assert not failure.locator('#play').is_disabled()
    failure.close()
    report['checks'].append('Missing Web Audio fails visibly and leaves play control usable')
    assert errors==[],errors
    report['pageErrors']=errors
    report['browserVersion']=browser.version
    browser.close()
report['passed']=True
(OUT/'verify-browser-audio.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
