import asyncio,json,traceback,argparse
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description='CV46 integration test: real /chat AppChat + mock WebSocket responses')
parser.add_argument('--url',default='http://localhost:5173/chat',help='Vite Chat route to test')
parser.add_argument('--offline-bundle',type=Path,help='Optional internal offline bundle folder used if local browser navigation is unavailable')
parser.add_argument('--chromium-path',help='Optional Chromium executable; omit to use Playwright Chromium')
parser.add_argument('--out',type=Path,default=ROOT/'evidence_out',help='Evidence output folder')
args=parser.parse_args()
OUT=args.out.resolve()
OUT.mkdir(parents=True,exist_ok=True)
NAME='TestKhoi46'
DRAFT='CV46 - draft preserved on OUT error /chat'
checks=[]
def check(cond, label, detail=''):
 if not cond: raise AssertionError(label+': '+detail)
 checks.append({'check':label,'result':'PASS','detail':detail})
 print('PASS',label,detail)
async def main():
 errors=[]
 async with async_playwright() as p:
  opts={'headless':True,'args':['--no-sandbox']}
  if args.chromium_path:opts['executable_path']=args.chromium_path
  browser=await p.chromium.launch(**opts)
  context=await browser.new_context(viewport={'width':1510,'height':880},device_scale_factor=1)
  page=await context.new_page()
  page.on('pageerror',lambda exc:errors.append(str(exc)))
  navigation_log=[]
  browser_log=[]
  durable_socket_trace=[]
  step='Chờ ứng dụng khởi tạo trên /chat'
  # Lưu sự kiện ngoài execution context để không mất dấu khi React/Vite điều hướng.
  page.on('framenavigated',lambda frame:navigation_log.append(frame.url) if frame==page.main_frame else None)
  def on_console(msg):
   message=msg.text
   if message.startswith('[CV46_TRACE] '):
    try:durable_socket_trace.append(json.loads(message[len('[CV46_TRACE] '):]))
    except (ValueError,TypeError):browser_log.append(message)
   elif msg.type in ('error','warning'):
    browser_log.append(f'{msg.type}: {message}')
  page.on('console',on_console)
  try:
   if args.offline_bundle:
    # Restricted CI browser fallback only: unmodified source modules precompiled to CJS,
    # test-only MemoryRouter selects the application's /chat route.
    css=(args.offline_bundle/'style.css').read_text(encoding='utf8')
    js=(args.offline_bundle/'bundle.js').read_text(encoding='utf8')
    sock=(ROOT/'mockSocket.js').read_text(encoding='utf8')
    html='<html><head><meta charset="utf-8"><title>CV46 /chat original-app fallback</title><style>'+css+'</style></head><body><div id="root"></div><script>'+sock+'\n'+js+'</script></body></html>'
    await page.set_content(html,wait_until='load')
   else:
    # Real BrowserRouter /chat under the project's own Vite server.
    # This hook is injected into an isolated Playwright context only.
    await context.add_init_script(path=str(ROOT/'mockSocket.js'))
    await page.goto(args.url,wait_until='domcontentloaded',timeout=30000)
   step='Khởi động /chat, khôi phục phiên và chờ tiêu đề App Chat'
   await page.get_by_role('heading',name='App Chat').wait_for(timeout=8000)
   await page.get_by_text('Đã kết nối').wait_for(timeout=6000)
   check(await page.get_by_text('Khoi',exact=True).count()>=1,'Real app booted','Original App + AppRoutes(/chat) + ChatLayout + Redux auth via RE_LOGIN; socket mocked')
   check(await page.get_by_role('button',name='Tham gia phòng').count()==1,'Real sidebar','ConversationSidebar available under AppRoutes(/chat)')
   step='JOIN_ROOM lần 1'
   # first join
   await page.get_by_role('button',name='Tham gia phòng').click()
   dialog=page.get_by_role('dialog',name='Tham gia phòng')
   await dialog.get_by_role('textbox',name='Tên phòng chính xác').fill(NAME)
   check((await page.evaluate('window.__cv46.stats.requests.JOIN_ROOM || 0'))==0,'No automatic initial JOIN','Opening initial JoinRoom causes no socket send')
   await dialog.get_by_role('button',name='Tham gia phòng').click()
   await page.wait_for_function('window.__cv46.stats.responses.JOIN_ROOM===1',timeout=5000)
   await page.get_by_role('heading',name=NAME).wait_for()
   check((await page.evaluate('window.__cv46.stats.requests.JOIN_ROOM'))==1,'First JOIN confirmed','One outgoing JOIN_ROOM, server mock status=success')
   step='Nhập bản nháp và kiểm tra quyền gửi'
   # draft, room info loaded
   await page.get_by_role('textbox',name='Tin nhắn').fill(DRAFT)
   await page.wait_for_timeout(160)
   check(DRAFT in (await page.get_by_role('textbox',name='Tin nhắn').inner_text()),'Draft prepared',DRAFT)
   check(await page.get_by_role('button',name='Gửi',exact=True).is_enabled(),'Send enabled before leave','Real Composer + ChatLayout canSend')
   step='Rời phòng và nhận OUT_ROOM/error giả lập'
   # launch real members and leave
   await page.get_by_role('button',name='Thành viên').click()
   panel=page.get_by_role('dialog',name='Danh sách thành viên phòng '+NAME)
   await panel.get_by_role('button',name='Rời phòng').click()
   leave=page.get_by_role('dialog',name='Rời phòng '+NAME+'?')
   check(DRAFT in (await leave.inner_text()),'Draft visible in actual LeaveRoom','RoomMembersPanel passed draft into LeaveRoom')
   await leave.get_by_role('button',name='Xác nhận rời phòng').click()
   await page.wait_for_function('window.__cv46.stats.responses.OUT_ROOM===1',timeout=4000)
   await page.wait_for_timeout(250)
   check((await page.evaluate('window.__cv46.trace.find(x=>x.event==="OUT_ROOM"&&x.direction==="mock_server_response").payload.status'))=='error','OUT business error received','roomsApi handles mocked socket OUT_ROOM/error')
   await leave.get_by_role('button',name='Hủy').click()
   step='Sau OUT error: cảnh báo, bản nháp và nút Gửi'
   # Real MemberList warning should stay visible and message send disabled
   await panel.get_by_text('Cần xác minh',exact=False).wait_for(timeout=4000)
   check(await page.get_by_role('button',name='Gửi',exact=True).is_disabled(),'Send blocked by Redux','ChatLayout sees leaveRejected from RoomMembersPanel dispatch')
   check(DRAFT==(await page.get_by_role('textbox',name='Tin nhắn').inner_text()),'Draft retained after rejected OUT','ChatLayout useChatDrafts + real Composer')
   check((await page.evaluate('window.__cv46.stats.requests.JOIN_ROOM'))==1,'No automatic JOIN on OUT error','JOIN request count still 1')
   await page.screenshot(path=str(OUT/'01_chat_OUT_error_draft_preserved_send_disabled.png'),full_page=True)
   await panel.get_by_role('button',name='Đóng').click()
   step='Mở lại form JOIN và kiểm tra không tự gửi'
   # reopen join from actual sidebar, no auto join
   await page.get_by_role('button',name='Tham gia phòng').click()
   join=page.get_by_role('dialog',name='Tham gia phòng')
   await join.get_by_role('textbox',name='Tên phòng chính xác').fill(NAME)
   joinButton=join.get_by_role('button',name='Tham gia phòng')
   check(await joinButton.is_enabled(),'Rejoin button enabled','Previous JOIN success cleared after business error')
   check((await page.evaluate('window.__cv46.stats.requests.JOIN_ROOM'))==1,'Open rejoin does not send','No extra JOIN_ROOM before explicit confirmation')
   await page.screenshot(path=str(OUT/'02_chat_rejoin_open_no_request.png'),full_page=True)
   step='Xác nhận JOIN lần 2 và chặn gửi trùng khi pending'
   await joinButton.click()
   await page.wait_for_function('window.__cv46.stats.requests.JOIN_ROOM===2')
   await page.wait_for_function('window.__cv46.stats.pendingSnapshot?.dialogVisible===true',timeout=5000)
   pending=await page.evaluate('window.__cv46.stats.pendingSnapshot')
   check(pending['buttonDisabled'],'Pending prevents duplicates','Actual JoinRoom submit disabled while pending')
   check(pending['requestsBeforeAttempt']==2 and pending['requestsAfterAttempt']==2,'Only one extra JOIN','Actual disabled button click did not send another JOIN; count 2')
   step='Chờ JOIN_ROOM/success mới và khôi phục quyền Gửi'
   await page.wait_for_function('window.__cv46.stats.responses.JOIN_ROOM===2',timeout=10000)
   await page.wait_for_timeout(200)
   check((await page.evaluate('window.__cv46.stats.requests.JOIN_ROOM'))==2,'Exactly one rejoin','Total JOIN requests exactly 2')
   check(await page.get_by_role('button',name='Gửi',exact=True).is_enabled(),'Send re-enabled after JOIN success','Real Redux roomConfirmed cleared leaveRejected; ChatLayout canSend true')
   check((await page.get_by_role('textbox',name='Tin nhắn').inner_text())==DRAFT,'Draft preserved after rejoin','Real useChatDrafts remains unchanged')
   check((await page.evaluate('window.__cv46.stats.sendAttempts'))==0,'No SEND_CHAT','Draft not automatically sent')
   step='Xác nhận cảnh báo biến mất sau JOIN success'
   # show member panel again for explicit warning absence
   await page.get_by_role('button',name='Thành viên').click()
   panel=page.get_by_role('dialog',name='Danh sách thành viên phòng '+NAME)
   check('Cần xác minh' not in (await panel.inner_text()),'Warning removed','MemberList no leaveRejected after JOIN success')
   check('Máy chủ từ chối OUT_ROOM' not in (await panel.inner_text()),'Error banner removed','Redux + leave request reset')
   await page.screenshot(path=str(OUT/'03_chat_join_success_warning_removed_send_enabled.png'),full_page=True)
   await panel.get_by_role('button',name='Đóng').click()
   await page.screenshot(path=str(OUT/'04_chat_after_join_send_enabled_draft_retained.png'),full_page=True)
   check(len(errors)==0,'No browser JS exceptions',str(errors))
   trace=await page.evaluate('window.__cv46.trace')
   check([t['payload']['status'] for t in trace if t['direction']=='mock_server_response' and t['event'] in ['JOIN_ROOM','OUT_ROOM']]==['success','error','success'],'Correct response sequence','JOIN success → OUT error → JOIN success')
   summary={
    'scenario':'JOIN success -> OUT business error -> manual JOIN request -> JOIN success',
    'route': '/chat (AppRoutes test via test-only MemoryRouter fallback)' if args.offline_bundle else args.url,
    'real_components':['App','AppRoutes','ProtectedRoute','ChatLayout','ConversationSidebar','RoomMembersPanel','MemberList','LeaveRoom','JoinRoom','ChatPage','Composer','RichTextEditor','Redux auth/rooms/conversations/messages slices'],
    'mock_boundary':'Window.WebSocket constructor replaced only in test context; real socketClient, roomsApi, authApi, Redux and components run unchanged',
    'not_actual_live_server':True,
    'limitations': (['Offline CJS-transpiled original sources; MemoryRouter selects /chat; browser URL is about:blank'] if args.offline_bundle else ['Real BrowserRouter /chat under Vite']) + ['RE_LOGIN, GET_USER_LIST, GET_ROOM_CHAT_MES and JOIN_ROOM responses also mocked to make a deterministic isolated test; OUT_ROOM/error fault injected', 'No proof of live server OUT_ROOM/error'],
    'checks':checks, 'socket_trace':trace,
    'request_counts':await page.evaluate('window.__cv46.stats'),
    'console_errors':errors,
   }
   (OUT/'CV46_chat_integration_trace.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
   (OUT/'CV46_chat_test_results.txt').write_text('\n'.join(f"[PASS] {x['check']}: {x['detail']}" for x in checks)+'\n',encoding='utf8')
   print('INTEGRATION COMPLETE',len(checks),'PASS')
  except Exception:
   # Quan trọng: ghi lỗi gốc TRƯỚC, không để lỗi page.evaluate() che khuất nó.
   original_error=traceback.format_exc()
   print('\n=== CV46: BAI KIEM THU THAT BAI ===',flush=True)
   print('BUOC DANG CHAY:',step,flush=True)
   print('LOI GOC:\n'+original_error,flush=True)
   async def safe_page_read(read,attempts=4):
    last_error=''
    for attempt in range(attempts):
     try:
      return await asyncio.wait_for(read(),timeout=3)
     except Exception as error:
      last_error=f'{type(error).__name__}: {error}'
      if attempt<attempts-1:await asyncio.sleep(0.25)
    return {'unavailable':last_error}
   url=page.url
   trace=await safe_page_read(lambda:page.evaluate('() => window.__cv46?.trace ?? null'))
   body=await safe_page_read(lambda:page.locator('body').inner_text(timeout=2500))
   report={
    'step':step,'original_error':original_error,'last_url':url,
    'navigation_history':navigation_log,'browser_messages':browser_log,
    'page_errors':errors,'durable_socket_trace':durable_socket_trace,
    'page_trace':trace,'page_body_tail':body[-2000:] if isinstance(body,str) else body,
    'scope':'Real /chat components + Redux, mocked WebSocket responses',
    'result':'FAIL - khong duoc tinh PASS',
   }
   (OUT/'FAIL_diagnostics.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
   (OUT/'FAIL_original_error.txt').write_text('STEP: '+step+'\nURL: '+url+'\n\n'+original_error,encoding='utf8')
   try:
    await asyncio.wait_for(page.screenshot(path=str(OUT/'FAIL_debug.png'),full_page=True,timeout=3000),timeout=4)
   except Exception as screenshot_error:
    print('KHONG CHUP DUOC SCREENSHOT:',str(screenshot_error),flush=True)
   print('URL CUOI:',url,flush=True)
   print('LICH SU DIEU HUONG:',navigation_log,flush=True)
   print('LOG DA LUU:',OUT/'FAIL_diagnostics.json',flush=True)
   print('ANH LOI:',OUT/'FAIL_debug.png',flush=True)
   print('SO KIEM TRA DAT TRUOC KHI LOI:',len(checks),flush=True)
   raise
  finally:
   await browser.close()
asyncio.run(main())
