"""Actual AppChat /chat + mocked WebSocket, no live credentials or server writes."""
import argparse
import asyncio
import json
import traceback
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://localhost:5173/chat')
parser.add_argument('--chromium-path')
parser.add_argument('--offline-bundle', type=Path, help='Optional local transpiled source bundle for restricted browser environments')
parser.add_argument('--out', type=Path, default=ROOT / 'evidence_out')
args = parser.parse_args()
OUT = args.out.resolve()
OUT.mkdir(parents=True, exist_ok=True)
NAME = 'CV49TimeoutRoom'
DRAFT = 'CV49 timeout - draft must remain'

async def main():
    checks, errors, durable_trace = [], [], []
    def check(condition, label, detail=''):
        if not condition:
            raise AssertionError(label + ': ' + detail)
        checks.append(dict(result='PASS', check=label, detail=detail))
        print('PASS', label, detail, flush=True)
    async with async_playwright() as p:
        opts = {'headless': True, 'args': ['--no-sandbox']}
        if args.chromium_path:
            opts['executable_path'] = args.chromium_path
        browser = await p.chromium.launch(**opts)
        context = await browser.new_context(viewport={'width':1510,'height':880})
        if not args.offline_bundle:
            await context.add_init_script(path=str(ROOT/'mockSocket.js'))
        page = await context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        def on_console(msg):
            if msg.text.startswith('[CV49_TRACE] '):
                durable_trace.append(json.loads(msg.text[len('[CV49_TRACE] '):]))
        page.on('console', on_console)
        result = 'FAIL'
        failure = None
        try:
            if args.offline_bundle:
                css = (args.offline_bundle/'style.css').read_text(encoding='utf8')
                js = (args.offline_bundle/'bundle.js').read_text(encoding='utf8')
                mock = (ROOT/'mockSocket.js').read_text(encoding='utf8')
                await page.set_content('<html><head><meta charset="utf-8"><style>'+css+'</style></head><body><div id="root"></div><script>'+mock+'</script><script>'+js+'</script></body></html>', wait_until='load')
            else:
                await page.goto(args.url, wait_until='domcontentloaded')
            await page.get_by_role('heading', name='App Chat').wait_for(timeout=15000)
            await page.get_by_text('Đã kết nối', exact=True).wait_for(timeout=10000)
            await page.get_by_role('button', name='Tham gia phòng').click()
            join = page.get_by_role('dialog', name='Tham gia phòng')
            await join.get_by_role('textbox', name='Tên phòng chính xác').fill(NAME)
            await join.get_by_role('button', name='Tham gia phòng').click()
            await page.get_by_role('heading', name=NAME).wait_for(timeout=10000)
            composer = page.get_by_role('textbox', name='Tin nhắn')
            send = page.get_by_role('button', name='Gửi', exact=True)
            await composer.fill(DRAFT)
            check(await send.is_enabled(), 'Send enabled before timeout')
            check(await composer.inner_text() == DRAFT, 'Draft prepared', DRAFT)
            await page.get_by_role('button', name='Thành viên').click()
            panel = page.get_by_role('dialog', name='Danh sách thành viên phòng '+NAME)
            await panel.get_by_role('button', name='Rời phòng').click()
            leave = page.get_by_role('dialog', name='Rời phòng '+NAME+'?')
            check(DRAFT in await leave.inner_text(), 'Draft visible before OUT')
            await leave.get_by_role('button', name='Xác nhận rời phòng').click()
            await page.wait_for_function('window.__cv49.stats.requests.OUT_ROOM === 1')
            await leave.get_by_role('button', name='Đang rời...').wait_for()
            check(await leave.get_by_role('button', name='Đang rời...').is_disabled(), 'OUT pending disables repeat')
            await page.screenshot(path=str(OUT/'01-out-pending.png'))
            await leave.get_by_text('Hết thời gian chờ xác nhận rời phòng.', exact=False).wait_for(timeout=18000)
            check('Chưa rõ kết quả' in await leave.inner_text(), 'Timeout reports uncertain outcome')
            check(await leave.get_by_role('button', name='Xác nhận rời phòng').is_disabled(), 'OUT retry blocked after timeout')
            await page.screenshot(path=str(OUT/'02-timeout-unknown.png'))
            await leave.get_by_role('button', name='Đóng', exact=True).last.click()
            await panel.get_by_text('Quyền phòng: Chưa xác định', exact=True).wait_for(timeout=8000)
            check(await send.is_disabled(), 'Unknown membership blocks sending')
            check(await composer.inner_text() == DRAFT, 'Draft retained after timeout', DRAFT)
            await page.screenshot(path=str(OUT/'03-unknown-membership-draft.png'))
            await panel.get_by_role('button', name='Đóng', exact=True).click()
            await page.wait_for_timeout(11000)
            counts = await page.evaluate('window.__cv49.stats.requests')
            writes = {k: counts.get(k,0) for k in ['CREATE_ROOM','JOIN_ROOM','OUT_ROOM','SEND_CHAT']}
            check(writes == {'CREATE_ROOM':0,'JOIN_ROOM':1,'OUT_ROOM':1,'SEND_CHAT':0}, 'No automatic repeated write after timeout', str(writes))
            check(await page.evaluate('window.__cv49.stats.responses.OUT_ROOM || 0') == 0, 'No mocked OUT response delivered')
            check(await composer.inner_text() == DRAFT and await send.is_disabled(), 'Draft and send guard persist after observation')
            check(not errors, 'No browser JS exceptions', str(errors))
            result = 'PASS'
        except Exception:
            failure = traceback.format_exc()
            print(failure, flush=True)
            try:
                await page.screenshot(path=str(OUT/'FAIL-debug.png'), timeout=3000)
            except Exception:
                pass
        finally:
            report = {'result':result,'scope':'actual /chat UI, mock WebSocket; OUT intentionally unanswered; no live server','url':page.url,'requested_url':args.url,'offline_transpiled_bundle':bool(args.offline_bundle),'checks':checks,'socket_trace':durable_trace,'page_errors':errors,'failure':failure}
            (OUT/'timeout-ui.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
            (OUT/'timeout-ui.txt').write_text('RESULT: '+result+'\nMOCK UI ONLY\n'+'\n'.join(x['result']+' '+x['check']+' '+x['detail'] for x in checks)+'\n'+(failure or ''),encoding='utf-8')
            await browser.close()
        if result != 'PASS':
            raise SystemExit(1)

asyncio.run(main())
