#!/usr/bin/env python3
import json
import shutil
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence'
report = {'checks': [], 'physicalDevice': False, 'subjectiveListening': False}
staging = tempfile.TemporaryDirectory(prefix='garden-polish-', dir=Path.home() / 'snap/chromium/common')
delivered = Path(staging.name) / 'Clockwork-Garden.html'
shutil.copy2(ROOT / 'Clockwork-Garden.html', delivered)
p = sync_playwright().start()
browser = p.chromium.launch(executable_path='/snap/bin/chromium', headless=True, args=['--no-sandbox'])
phone = browser.new_page(viewport={'width':390, 'height':844}, is_mobile=True, has_touch=True)
errors = []
phone.on('pageerror', lambda error: errors.append(str(error)))
phone.goto(delivered.as_uri())
report['phoneWidths'] = phone.evaluate('({viewport:innerWidth, body:document.documentElement.scrollWidth,bed:document.getElementById("bed").getBoundingClientRect().width})')
assert report['phoneWidths']['viewport'] == 390, report['phoneWidths']
assert report['phoneWidths']['body'] <= 390, report['phoneWidths']
phone.screenshot(path=str(OUT / 'polish-phone-resting.png'), full_page=True)
phone.locator('[data-id="2"]').tap()
assert phone.evaluate('selected') == 2
phone.locator('#lower').tap()
assert phone.evaluate('garden.flowers.find(f=>f.id===2).y') == 3
phone.locator('#later').tap()
assert phone.evaluate('garden.flowers.find(f=>f.id===2).x') == 3
report['checks'].append('Phone 390px has no page overflow, touch selects and visible controls change both musical axes')
phone.locator('#plant').tap()
assert phone.locator('.flower').count() == 7
report['checks'].append('Touch planting control adds a real selected flower')
phone.locator('#play').tap()
phone.wait_for_function('engine.running && engine.played > 2')
assert 'light follows' in phone.locator('#hint').inner_text()
phone.screenshot(path=str(OUT / 'polish-phone-playing.png'), full_page=True)
phone.locator('#play').tap()
phone.locator('#bed-wrap').scroll_into_view_if_needed()
box=phone.locator('#bed-wrap').bounding_box()
client=phone.context.new_cdp_session(phone)
y=box['y']+150
before_count=phone.locator('.flower').count()
client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':330,'y':y}]})
for x in [280,220,160,100,40]:
    client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y}]})
client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
phone.wait_for_timeout(200)
assert phone.evaluate('document.getElementById("bed-wrap").scrollLeft') > 100
assert phone.locator('.flower').count()==before_count
report['checks'].append('Real CDP touch swipe scrolls bed without accidentally planting')
phone.evaluate('document.getElementById("bed-wrap").scrollLeft=430')
assert phone.evaluate('document.getElementById("bed-wrap").scrollLeft') > 300
phone.locator('[data-id="5"]').tap()
assert phone.evaluate('selected') == 5
report['checks'].append('Scrollable phone bed exposes late flowers, selectable without losing screen layout')
phone.emulate_media(reduced_motion='reduce')
phone.evaluate('document.querySelector(".flower").classList.add("sounding")')
assert phone.locator('.bloom').first.evaluate('e=>getComputedStyle(e).animationName') == 'none'
report['checks'].append('Reduced motion disables bloom animation')
phone.set_viewport_size({'width':320,'height':740})
assert phone.evaluate('document.documentElement.scrollWidth<=320')
phone.screenshot(path=str(OUT / 'polish-phone-320.png'), full_page=True)
report['checks'].append('Narrow 320px layout has no document overflow')
phone.close()
page = browser.new_page(viewport={'width':1440,'height':1050})
page.on('pageerror', lambda error: errors.append(str(error)))
page.goto(delivered.as_uri())
page.screenshot(path=str(OUT / 'polish-desktop-resting.png'), full_page=True)
page.locator('#clear').click()
page.locator('.seed[data-species="reed"]').focus()
page.keyboard.press('Enter')
page.locator('#plant').focus()
page.keyboard.press('Enter')
assert page.evaluate('garden.flowers.length===1 && garden.flowers[0].species==="reed"')
assert page.evaluate('document.activeElement.classList.contains("flower")')
page.keyboard.press('ArrowUp')
assert page.evaluate('garden.flowers[0].y') == 3
assert page.evaluate('document.activeElement.classList.contains("flower")')
page.screenshot(path=str(OUT / 'polish-keyboard-focus.png'), full_page=True)
page.keyboard.press('Delete')
assert page.locator('.flower').count() == 0
report['checks'].append('Keyboard-only species choice, planting, arrow movement, retained focus and deletion pass')
page.locator('#reset').click()
page.locator('#play').click()
page.wait_for_function('engine.played > 2')
page.screenshot(path=str(OUT / 'polish-desktop-playing.png'), full_page=True)
page.locator('#play').click()
report['concurrentPlay'] = page.evaluate('''async () => {
  const original=engine.ctx.resume.bind(engine.ctx);
  engine.ctx.resume=()=>new Promise(resolve=>setTimeout(()=>original().then(resolve),100));
  await Promise.all([engine.play(),engine.play(),engine.play()]);
  const running=engine.running;engine.pause();
  const pending=engine.play();engine.pause();await pending;
  const cancelled=!engine.running;engine.ctx.resume=original;
  return {running,cancelled,starting:engine.starting};
}''')
assert report['concurrentPlay'] == {'running':True,'cancelled':True,'starting':False}
report['checks'].append('Concurrent async starts are guarded and pause cancels pending resume')
assert errors == [], errors
report['errors'] = errors
report['passed'] = True
browser.close()
p.stop()
staging.cleanup()
(OUT / 'polish-browser.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
