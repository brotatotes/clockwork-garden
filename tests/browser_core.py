#!/usr/bin/env python3
import json
import shutil, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence'
OUT.mkdir(exist_ok=True)
report = {'browser': 'Chromium 153, isolated headless context', 'subjectiveListening': False, 'checks': []}
with tempfile.TemporaryDirectory(prefix='clockwork-test-', dir=Path.home() / 'snap/chromium/common') as staging, sync_playwright() as p:
    delivered = Path(staging) / 'Clockwork-Garden.html'
    shutil.copy2(ROOT / 'Clockwork-Garden.html', delivered)
    browser = p.chromium.launch(executable_path='/snap/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1440, 'height':1050})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(delivered.as_uri())
    assert page.locator('.flower').count() == 6
    assert page.evaluate('engine.ctx === undefined')
    report['checks'].append('No AudioContext and six flowers on first use')
    page.locator('#play').click()
    page.wait_for_function('engine.running && engine.played > 2')
    signal = page.evaluate('''async () => {
      let peak=0, sum=0, count=0, nonfinite=0;
      const samples=new Float32Array(engine.analyser.fftSize);
      for(let n=0;n<45;n++){
        engine.analyser.getFloatTimeDomainData(samples);
        for(const v of samples){peak=Math.max(peak,Math.abs(v));sum+=v*v;count++;if(!Number.isFinite(v))nonfinite++;}
        await new Promise(resolve=>setTimeout(resolve,25));
      }
      return {peak,rms:Math.sqrt(sum/count),count,nonfinite,state:engine.ctx.state,scheduled:engine.played};
    }''')
    assert 0.001 < signal['peak'] < 1 and signal['nonfinite'] == 0
    report['liveSignal'] = signal
    report['checks'].append('Actual live analyser signal nonzero, finite, below clipping after explicit gesture')
    page.screenshot(path=str(OUT / 'core-desktop.png'), full_page=True)
    page.locator('#play').click()
    assert page.evaluate('engine.running') is False
    page.wait_for_timeout(180)
    pause = page.evaluate('''() => {let a=new Float32Array(engine.analyser.fftSize);engine.analyser.getFloatTimeDomainData(a);return Math.max(...a.map(Math.abs));}''')
    assert pause < .0001
    report['pausePeak'] = pause
    point=page.evaluate('''() => {const p=new DOMPoint(930,450).matrixTransform(document.getElementById('bed').getScreenCTM());return {x:p.x,y:p.y};}''')
    page.mouse.click(point['x'],point['y'])
    assert page.locator('.flower').count() == 7
    assert page.evaluate('garden.flowers.at(-1).x') == 15
    page.locator('.flower').last.focus()
    page.keyboard.press('ArrowLeft')
    assert page.evaluate('garden.flowers.at(-1).x') == 14
    report['checks'].append('Pointer planting and focused keyboard movement change the actual model')
    start=page.evaluate('''() => {let p=new DOMPoint(870,450).matrixTransform(document.getElementById('bed').getScreenCTM());return {x:p.x,y:p.y};}''')
    end=page.evaluate('''() => {let p=new DOMPoint(810,390).matrixTransform(document.getElementById('bed').getScreenCTM());return {x:p.x,y:p.y};}''')
    page.mouse.move(start['x'],start['y'])
    page.mouse.down()
    page.mouse.move(end['x'],end['y'],steps=5)
    page.mouse.up()
    assert page.evaluate('garden.flowers.at(-1).x === 13 && garden.flowers.at(-1).y === 6')
    report['checks'].append('Pointer drag moves selected flower in both musical axes')
    report['voiceSignals']=page.evaluate('''async () => {
      const results={};
      for(const species of Object.keys(M.SPECIES)){
        const ctx=new OfflineAudioContext(1,48000*2,48000);
        M.voice(ctx,ctx.destination,{species,y:4},.05,1);
        const buffer=await ctx.startRendering();const a=buffer.getChannelData(0);
        let peak=0,sum=0,zc=0,nonfinite=0;
        for(let i=0;i<a.length;i++){peak=Math.max(peak,Math.abs(a[i]));sum+=a[i]*a[i];if(i&&a[i-1]<0&&a[i]>=0)zc++;if(!Number.isFinite(a[i]))nonfinite++;}
        results[species]={peak,rms:Math.sqrt(sum/a.length),zeroCrossings:zc,nonfinite};
      }return results;
    }''')
    assert len({round(v['rms'],6) for v in report['voiceSignals'].values()}) == 4
    assert all(v['nonfinite']==0 and 0<v['peak']<1 for v in report['voiceSignals'].values())
    assert errors == [], errors
    report['pageErrors']=errors
    browser.close()
report['passed'] = True
(OUT / 'core-browser.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
