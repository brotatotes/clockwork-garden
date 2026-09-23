#!/usr/bin/env python3
import json
import shutil
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence'
report = {'checks': [], 'passed': False}
with tempfile.TemporaryDirectory(prefix='clockwork-edit-', dir=Path.home() / 'snap/chromium/common') as staging, sync_playwright() as p:
    delivered = Path(staging) / 'Clockwork-Garden.html'
    shutil.copy2(ROOT / 'Clockwork-Garden.html', delivered)
    browser = p.chromium.launch(executable_path='/snap/bin/chromium',headless=True,args=['--no-sandbox'],downloads_path=str(Path(staging)/'downloads'))
    page = browser.new_page(viewport={'width':1440,'height':1100},accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(delivered.as_uri())
    original=page.evaluate('JSON.stringify(garden)')
    page.locator('#load').click()
    assert 'No garden is saved' in page.locator('#status').inner_text()
    page.locator('#save').click()
    assert page.evaluate('localStorage.getItem(STORAGE_KEY)') == original
    page.locator('#clear').click()
    assert page.locator('.flower').count() == 0
    page.locator('#load').click()
    assert page.evaluate('JSON.stringify(garden)') == original
    page.reload()
    page.locator('#load').click()
    assert page.evaluate('JSON.stringify(garden)') == original
    report['checks'].append('Explicit save, clear, load, page reload and load preserve exact composition with audio off')
    with page.expect_download() as downloaded:
        page.locator('#export').click()
    export=Path(staging)/'garden.json'
    downloaded.value.save_as(export)
    print('Downloaded bytes', export.stat().st_size, repr(export.read_bytes()[:100]), 'failure', downloaded.value.failure(), flush=True)
    assert json.loads(export.read_text()) == json.loads(original)
    page.locator('#clear').click()
    page.locator('#file').set_input_files(str(export))
    page.wait_for_function('garden.flowers.length===6')
    assert page.evaluate('JSON.stringify(garden)') == original
    report['checks'].append('Real browser JSON download and file-picker import roundtrip')
    page.locator('#share').click()
    code=page.locator('#share-code').input_value()
    page.locator('#clear').click()
    page.locator('#open-code').click()
    assert page.evaluate('JSON.stringify(garden)') == original
    page.goto(delivered.as_uri()+code)
    assert page.evaluate('JSON.stringify(garden)') == original
    assert page.evaluate('engine.ctx === undefined')
    report['checks'].append('Share code UI and fresh URL fragment restore composition without starting audio')
    invalids = [b'{', b'x'*12001, json.dumps({**json.loads(original),'tempo':999}).encode(), json.dumps({**json.loads(original),'links':[{'from':1,'to':999}]}).encode()]
    for data in invalids:
        page.locator('#file').set_input_files({'name':'broken.json','mimeType':'application/json','buffer':data})
        page.wait_for_function('document.getElementById("status").textContent.startsWith("Import failed")')
        assert page.evaluate('JSON.stringify(garden)') == original
        assert page.locator('#file').input_value() == ''
    page.locator('#share').click()
    page.locator('#share-code').fill('#garden=invalid')
    page.locator('#open-code').click()
    assert 'Code not opened' in page.locator('#status').inner_text()
    assert page.evaluate('JSON.stringify(garden)') == original
    report['checks'].append('Malformed, oversized, invalid-tempo, dangling-vine imports and bad share code rejected without mutation')
    page.evaluate('localStorage.setItem(STORAGE_KEY,"{")')
    page.locator('#load').click()
    assert 'could not be loaded' in page.locator('#status').inner_text()
    assert page.evaluate('JSON.stringify(garden)') == original
    page.evaluate('() => { Storage.prototype.setItem = function(){throw new DOMException("Test quota", "QuotaExceededError");}; }')
    page.locator('#save').click()
    assert 'could not save locally' in page.locator('#status').inner_text()
    assert page.evaluate('JSON.stringify(garden)') == original
    report['checks'].append('Corrupt saved content and simulated storage quota rejection give visible error and retain composition')
    page.locator('#close-code').click()
    page.locator('[data-id="2"]').focus()
    page.keyboard.press('Enter')
    page.locator('#unlink').click()
    assert page.evaluate('garden.links.length') == 0
    page.locator('#connect').click()
    page.locator('[data-id="5"]').focus()
    page.keyboard.press('Enter')
    assert page.evaluate('JSON.stringify(garden.links)') == '[{"from":2,"to":5}]'
    page.locator('#remove').click()
    assert page.evaluate('garden.flowers.length === 5 && garden.links.length === 0')
    page.locator('#reset').click()
    assert page.evaluate('JSON.stringify(garden)') == original
    report['checks'].append('Keyboard selection, cut/reconnect vine, removal and example reset work through controls')
    page.screenshot(path=str(OUT/'editing-desktop.png'),full_page=True)
    assert errors == [], errors
    report['pageErrors']=errors
    report['exportBytes']=export.stat().st_size
    report['codeCharacters']=len(code)
    report['browserVersion']=browser.version
    browser.close()
report['passed']=True
(OUT/'editing-browser.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
