"""Offline DOM-to-application smoke test, not a workerd/HTTP/Access test.
Requires an explicitly installed Python Playwright + Chromium. No remote requests.
Usage: python tools/ui-smoke.py --chromium /usr/bin/chromium --out ./validation-artifacts
"""
from pathlib import Path
import argparse, json, subprocess, threading
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--chromium',required=True)
parser.add_argument('--out',default='validation-artifacts')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
bridge=subprocess.Popen(['node','--experimental-strip-types','tools/ui-bridge.mjs'],cwd=root,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True)
assert json.loads(bridge.stdout.readline())['ready']
lock=threading.Lock()
def dispatch(payload):
    with lock:
        bridge.stdin.write(json.dumps(payload)+'\n');bridge.stdin.flush()
        return json.loads(bridge.stdout.readline())
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1440,'height':1050})
  errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  # No HTTP navigation. Render authored local files and bridge fetch to actual API services.
  page.expose_function('lumiDispatch',dispatch)
  html=(root/'apps/web/index.html').read_text().replace('<script type="module" src="./app.mjs"></script>','')
  import re
  html=re.sub(r'<link[^>]+>','',html)
  html=re.sub(r'<script[^>]*src=[^>]+></script>','',html)
  page.set_content(html)
  page.add_style_tag(content=(root/'apps/web/styles.css').read_text())
  page.evaluate('''() => { window.fetch = async (path, options={}) => {
    const r = await window.lumiDispatch({path,options});
    return new Response(JSON.stringify(r.body),{status:r.status,headers:{'Content-Type':'application/json'}});
  }; }''')
  page.add_script_tag(type='module',content=(root/'apps/web/app.mjs').read_text())
  try:
   page.wait_for_function("document.querySelectorAll('.kpi-value').length===4",timeout=5000)
  except Exception:
   print('UI errors:',errors)
   print('UI message:',page.locator('#message').text_content())
   print('State:',page.evaluate('document.body.innerText.slice(0,1800)'))
   raise
  assert page.locator('.kpi-value').all_text_contents()==['450','74 giờ','216.000 ₫','0 ₫']
  results.append('tenant A KPI values and honest zero cash savings')
  assert page.locator('.widget').count()==6
  results.append('six declared widgets render with definitions and lineage')
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  results.append('desktop has no horizontal page overflow')
  page.screenshot(path=str(out/'desktop.png'),full_page=True)
  page.select_option('#persona','beta-owner')
  page.wait_for_function("document.querySelector('.kpi-value')?.textContent==='1.350'")
  assert page.locator('#tenant').input_value()=='beta'
  results.append('persona switch replaces tenant dataset')
  page.select_option('#persona','alpha-viewer')
  page.wait_for_function("document.querySelector('.kpi-value')?.textContent==='450'")
  assert page.locator('#editor').is_hidden()
  assert page.locator('#duplicate').is_hidden()
  results.append('viewer controls hidden; server role denial separately unit-tested')
  page.select_option('#persona','alpha-owner')
  page.wait_for_function("!document.querySelector('#duplicate').hidden && document.querySelectorAll('.kpi-value').length===4")
  before=page.locator('#dashboard option').count()
  page.click('#duplicate')
  page.wait_for_function('(n)=>document.querySelectorAll("#dashboard option").length===n',arg=before+1)
  results.append('duplicate dashboard calls actual config-only create API')
  page.locator('#editor summary').click()
  definition=json.loads(page.locator('#config').input_value());definition['title']='Bảng theo dõi đã chỉnh'
  page.fill('#config',json.dumps(definition,ensure_ascii=False))
  page.click('#save')
  page.wait_for_function("document.querySelector('#message').textContent.includes('cấu hình v2')")
  results.append('edit saves with optimistic revision increment')
  page.locator('#editor summary').click()
  page.set_viewport_size({'width':390,'height':844})
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  page.screenshot(path=str(out/'mobile.png'),full_page=True)
  results.append('mobile has no horizontal page overflow')
  # Date range with no matching facts is unavailable rather than fabricated zero.
  page.fill('#from','2026-08-01');page.fill('#to','2026-09-01');page.click('#refresh')
  page.wait_for_function("document.querySelector('.kpi-value')?.textContent==='Chưa có dữ liệu'")
  results.append('empty date range displays unavailable')
  assert not errors,errors
  results.append('zero uncaught browser JavaScript errors')
  browser.close()
finally:
 bridge.stdin.close();bridge.terminate();bridge.wait(timeout=5)
report={'mode':'offline DOM + actual API services via stdio bridge; not HTTP/workerd/Access','checks':results,'passed':len(results)}
(out/'ui-results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
print(json.dumps(report,indent=2,ensure_ascii=False))
