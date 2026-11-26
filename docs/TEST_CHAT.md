# CV32 — Kiểm thử chat thật

Nhánh `test/kiet/cv32`, từ develop `be36ed7` (đã có CV31 và CV15).
Thực hiện ngày 24/11/2026, UTC+7; Node.js v24.21.0.

## Phạm vi và cách thử

Hai tài khoản thử đã được cấp: `TomRiddo` và `test`. Không lưu mật khẩu/mã phiên trong tài liệu hoặc script. API: `wss://chat.longapp.io.vn/chat/chat`.

`frontend/scripts/cv32-live.test.ts` tạo hai bộ module độc lập để mỗi phiên dùng chính authApi, socketClient, chatApi, roomsApi và Redux của dự án. Gửi dữ liệu thật bằng SEND_CHAT, nhận qua subscribeToMessages, đọc lại bằng adapter. Mỗi tin có clientMessageId riêng và tiền tố CV32; không đối chiếu chỉ bằng chữ giống nhau.

Ma trận gồm: chat riêng/phòng; tiếng Việt, emoji, xuống dòng, đoạn thường/đậm/nghiêng và size 12/14/16/18/24; RE_LOGIN rồi đọc lại; trang 2; hai đích đọc liên tiếp; ngắt socket ngay sau gửi và hòa giải bằng lịch sử, không gửi lại. Phép ngắt kết nối ở lớp service không thay cho thao tác mất mạng trên giao diện.

## Kết quả thực tế

| Lượt | Kết quả |
|---|---|
| 19:39, mã `CV32_1795523985101` | 10 ca gửi/nhận/đọc lại tức thời đạt: chat riêng và phòng × 5 size. Chuỗi mes và dữ liệu parser khớp toàn bộ, gồm emoji, xuống dòng và định dạng. 4 ca còn lại chưa đạt. |
| 19:40, mã `CV32_1795524028948` | Không tái lập ổn định: 13 ca lỗi, 1 ca đạt. Tin chat riêng đến realtime nhưng không tìm thấy mã thử trong trang 1; phòng có chủ không khớp tài khoản tạo. Không xem lượt đầu là bằng chứng nghiệm thu đầy đủ. |
| 19:42, mã `CV32_1795524121851` | Tái hiện chủ phòng khác tài khoản tạo; một tin riêng nhận realtime nhưng không xuất hiện trong trang 1 vừa đọc. |
| 19:44, phòng `cv32_raw_1795524271372` | Kiểm tra độc lập bằng WebSocket gốc, không import source dự án: LOGIN TomRiddo thành công; CREATE_ROOM/GET_ROOM_CHAT_MES trả chủ phòng là tài khoản khác. Tài khoản test JOIN thành công, nhưng chủ phòng vẫn không khớp. |
| 19:47, mã `CV32_1795524474815` | Bộ thử có guard: 1 FAIL tại kiểm tra chủ phòng, 13 SKIP. Dừng trước các lệnh gửi tin tiếp theo. |
| 20:09, mã `CV32_1795525751504` | 14/14 PASS sau lượt làm sạch phiên thủ công: đủ gửi/nhận/lưu riêng và phòng, RE_LOGIN, trang 2 và ngắt sau gửi. Chỉ chứng minh lượt này đạt. |
| 20:18, mã `CV32_1795526321513` | Làm sạch rồi đăng nhập xen kẽ từng tài khoản: sai chủ phòng, 1 FAIL, 13 SKIP. |
| 20:19, mã `CV32_1795526390464` | Làm sạch cả hai trước rồi đăng nhập cả hai: 12 PASS, 2 FAIL. Đúng chủ phòng, 10 ca định dạng và RE_LOGIN đạt; đọc trang 2 lỗi, ca sau gặp socket đã đóng. Chưa xác định nguyên nhân đọc trang 2. |
| 20:25, mã `CV32_1795526713867` | Lặp cách làm sạch hai pha vẫn sai chủ phòng: 1 FAIL, 13 SKIP. Cách chuẩn bị phiên chưa phải biện pháp khắc phục ổn định. |

**Blocker API:** phản hồi `own` của phòng vừa tạo không khớp tài khoản đã LOGIN. Đã tái hiện cả qua service và WebSocket gốc. Chưa xác định nguyên nhân nằm ở xác thực, ánh xạ người dùng hay xử lý phòng trên máy chủ. Không sửa frontend để giả chủ phòng, đổi tên tác giả hoặc bỏ kiểm tra cặp tài khoản.

RE_LOGIN báo thành công nhưng lượt đầu đọc lịch sử tiếp theo qua adapter trả lỗi; lượt sau tin chưa được tìm thấy trong lịch sử. Chưa đủ bằng chứng kết luận tin bị mất vĩnh viễn hoặc do cùng nguyên nhân với chủ phòng. Cần kiểm tra thêm sau khi danh tính phiên được xác minh.

Bộ live test hiện kiểm tra chủ phòng trước. Nếu sai, ca này FAIL và các ca ghi tiếp theo SKIP với lý do rõ ràng; không ghi nhận các ca bị chặn là PASS.

Đã đối chiếu bảng API của giảng viên ở chế độ chỉ xem: CREATE_ROOM phải tự gán người tạo làm chủ; LOGOUT giải phóng phiên/cache. LOGIN → LOGOUT → LOGIN có thể giúp một lượt đạt nhưng chưa chứng minh nguyên nhân hoặc sửa được backend. Không đổi endpoint, nới kiểm tra tác giả hay giả metadata phòng.

### Hai phiên giao diện dùng API thật

Đã chạy trên hai tab độc lập bằng TomRiddo/test, với mã `CV32_UI_1795525949196` và phòng của lượt 20:09:

- Chat riêng: gửi tiếng Việt, xuống dòng, emoji, đậm/nghiêng, 24 px; người nhận thấy đúng một tin và đúng định dạng. Reload rồi mở lại vẫn còn bản lưu.
- Tài khoản thứ hai trả lời; bên nhận thấy số chưa xem và mở được tin.
- Đổi nhanh riêng/phòng ba lần: giữ nháp riêng từng đích, không hiện tin riêng trong phòng.
- Tin phòng có emoji được nhận và đọc lại sau reload. Hai bên đã đăng xuất khi kết thúc.
- Nhấn xem tin cũ giữ được hai tin thử; số tin hiển thị không tăng, chưa tính là bằng chứng tải thêm trang có dữ liệu.

Ảnh bằng chứng ngoài repo: `cv32-evidence/ui-room.jpg` trong workspace làm việc. Đây là kết quả của lượt phiên hợp lệ, không phủ nhận lỗi API khi lặp lại.

Build/lint đạt. Bộ mặc định không cấp tài khoản: 102 PASS, 15 SKIP (14 ca CV32 và 1 ca live CV15); đây không phải 102 ca API thật. Ca ngắt sau send chấp nhận hai kết quả đúng: tìm thấy bản lưu thì hòa giải; chưa tìm thấy thì giữ chưa xác nhận, không tự kết luận thất bại.

## Tái lập

Ảnh và bản chụp DOM được giữ ngoài repo; người phụ trách đính kèm ảnh trực tiếp vào mô tả PR #50. Các đường dẫn workspace bên dưới là vị trí gốc của lượt thử, không phải liên kết công khai cho người review. Không coi bằng chứng đã được đính kèm trước khi thực hiện bước này.

Trong thư mục frontend, cấp biến môi trường qua terminal, không ghi vào file được commit:

- `APPCHAT_PROBE_USER`, `APPCHAT_PROBE_PASS`: tài khoản gửi.
- `APPCHAT_PROBE_PEOPLE`, `APPCHAT_PROBE_PEER_PASS`: tài khoản nhận.

CV32 chỉ chạy khi có cả `APPCHAT_CV32_LIVE=1` và bốn biến tài khoản trên. Chỉ đặt tài khoản không bật CV32. Đây là phép thử có ghi dữ liệu: mỗi lượt có thể tạo thêm phòng thật không xóa được qua API, gửi tin thật và kết thúc phiên nếu bật fresh-session.

Trong PowerShell, bật công tắc riêng cho đúng một file rồi gỡ trong finally:

```powershell
$env:APPCHAT_CV32_LIVE = '1'
try {
    npx vitest run scripts/cv32-live.test.ts --maxWorkers=1
} finally {
    Remove-Item Env:APPCHAT_CV32_LIVE -ErrorAction SilentlyContinue
}
```

Không dùng `npm test` để chạy live khi công tắc đang bật, không chạy suite/script API khác đồng thời với hai tài khoản này. `cv15-live` thuộc phần việc khác và hiện vẫn bật theo biến tài khoản; công tắc riêng CV32 không thay đổi hành vi đó. Thiếu công tắc hoặc tài khoản thì CV32 bị bỏ qua. Khi đã bật đủ, lỗi hoặc blocker trả mã thoát khác 0.

Chạy `node scripts/check-cv32-session.mjs` để đối chiếu trực tiếp LOGIN → CREATE_ROOM → GET_ROOM_CHAT_MES bằng WebSocket gốc. Phép thử tạo một phòng có tên riêng; không tự xóa phòng hoặc rời chủ phòng vì API không có thao tác phù hợp. Các phòng thử chỉ chứa dữ liệu kiểm thử.

Chỉ khi được phép kết thúc phiên của tài khoản thử, thêm `--fresh-session` cho script trên hoặc đặt `APPCHAT_CV32_FRESH_SESSION=1` cho live test. Chế độ này LOGIN/LOGOUT để làm sạch trước khi thử, không tự bật và không bảo đảm hết lỗi. Ca ngắt sau gửi tự RE_LOGIN trước khi bắt đầu, tránh lấy socket đã đóng từ ca trước làm kết quả của ca này.

## Chưa nghiệm thu

### Bổ sung ngày 26/11/2026 — kiểm tra frontend độc lập API

`frontend/scripts/cv32-composer.test.tsx`: 9 ca đạt, gọi callback thật của RichTextEditor/Composer với hooks mô phỏng trong Node:

- Enter gọi gửi một lần; giữ phím không gửi lặp.
- Shift+Enter thêm xuống dòng, giữ định dạng, không gửi (con trỏ mặc định ở đầu).
- Composition đang chạy, native isComposing hoặc keyCode 229 không kích hoạt gửi.
- Kết thúc composition cập nhật đủ chuỗi tiếng Việt/emoji và giữ định dạng; không gửi sớm.
- Không gửi qua submit/Enter khi offline hoặc hết phiên, rỗng, chỉ khoảng trắng hoặc vượt byte; không gọi thay đổi nháp.
- Composer khóa gửi trong composition và cho gửi sau khi kết thúc.

Đây là kiểm tra callback: không chạy layout effect, không kiểm tra DOM/selection/rerender hoặc thứ tự sự kiện của bộ gõ Windows. Không dùng kết quả này thay cho kiểm thử IME thật hay ngắt mạng trên giao diện. Kiểm tra độc lập mã test không phát hiện lỗi chặn; chưa cần sửa mã sản phẩm từ các ca trên.

Bộ mặc định: 111 PASS, 15 SKIP; lint và TypeScript cho file test mới đạt. Không chạy lại API và không tạo thêm phòng/tin thử trong lượt này theo yêu cầu tạm để blocker API.

Trình duyệt tích hợp không mở được localhost/127.0.0.1:5174 (ERR_CONNECTION_TIMED_OUT) dù Vite đã khởi động. Edge phát hiện thao tác người dùng; lần đọc lại bị hủy trước khi thực thi. Đã dừng điều khiển cửa sổ đó. Các ca IME/mất mạng trên UI vẫn chưa được xác nhận trong lượt bổ sung này.

### Tiếp tục ngày 26/11/2026 — đã chạy UI cục bộ

Đã xác định lượt mở trang trước bị thiếu quyền mạng của tiến trình Vite. Cấp quyền và khởi động lại thì HTTP trả 200, Edge và trình duyệt tích hợp mở được trang. Không thay đổi firewall hoặc cấu hình mạng Windows.

Trang thử tạm mount Composer/RichTextEditor và MessageBubble thật; không sửa component để kiểm thử. Dùng dữ liệu cục bộ, không tính là lượt API production:

- Gõ chuỗi Unicode `CV32 Chào tiếng Việt`, Shift+Enter, `Dòng hai`: DOM giữ đúng dấu và xuống dòng; số gửi vẫn 0.
- Enter gửi đúng một lần, ô soạn rỗng; Enter tiếp ở ô rỗng không gửi thêm.
- Khi canSend chuyển offline: nút gửi khóa, Enter không tăng số gửi, nháp giữ nguyên. Nối lại không tự gửi nháp.
- Máy chủ WebSocket thử trên 127.0.0.1:5186 nhận SEND_CHAT rồi chủ động đóng mã 1011 trước xác nhận. UI dùng socketClient/sendText, Redux, useOutgoingMessages và parser/serializer thật: một tin Chưa xác nhận, ô soạn rỗng, nút gửi khóa.
- Trong lúc socket đóng, gõ nháp mới và Enter: nháp còn nguyên, tổng số gửi vẫn 1. Nối lại cùng máy chủ thử: useOutgoingMessages tự đọc lịch sử, tin chuyển Đã lưu, danh sách chưa xác nhận rỗng; tổng số gửi vẫn 1, nháp mới không mất.

Bằng chứng ngoài repo trong workspace: `cv32-evidence/ui-local-reconnected.png` và `ui-local-reconnected.txt`. Fixture kiểm soát dữ liệu máy chủ cục bộ; không chứng minh backend production đã sửa, không thay thế hai tài khoản thật hoặc cắt mạng Internet toàn hệ thống. Không phát hiện lỗi sản phẩm trong các ca UI vừa chạy.

Fixture tự dựng callback queue/gửi/xóa nháp, chưa mount toàn bộ ChatLayout. Bộ đếm UI đếm callback; log máy chủ cục bộ ghi đúng một SEND_CHAT cho ca ngắt/kết nối lại, dùng làm bằng chứng không phát lại trên dây ở ca này. Kết quả không chứng minh toàn bộ hành trình production.

Gõ Unicode bằng công cụ nhập ký tự không chứng minh Windows IME đã phát composition. Đã bàn giao trang thử cho người dùng. Khi nhận lại điều khiển, tin gồm hai dòng `fsafsa` và `fasfasfs`, số callback gửi là 1, ô soạn rỗng, composition start/end đều 0. Nối lại socket chuyển đúng tin sang Đã lưu, không phát lại. Lượt này xác nhận bàn phím/xuống dòng/gửi thật nhưng không có chữ tiếng Việt có dấu hoặc sự kiện composition, nên chưa ghi IME thật là đạt. Một số bộ gõ không dùng composition; số 0 riêng lẻ không chứng minh bộ gõ bị lỗi.

Bằng chứng lượt người dùng: `cv32-evidence/ui-user-keyboard.txt` và `ui-user-keyboard.png`. Đã đóng trang thử, dừng máy chủ thử và chuyển bản sao fixture ra ngoài repo trước khi xóa đúng hai tệp tạm trong frontend. Không thay đổi code sản phẩm, không commit/push thêm.

Lượt thử bổ sung bằng bộ gõ của người dùng: mở lại fixture, người dùng nhập `Là` rồi xuống dòng `Kiệt` và gửi. DOM trước đối chiếu giữ chính xác `Là\nKiệt`, số gửi 1, ô soạn rỗng. Máy chủ thử đóng socket sau nhận; nối lại đọc lịch sử chuyển đúng một tin sang Đã lưu, giữ dấu và xuống dòng, danh sách chưa xác nhận rỗng. Đạt ca gõ tiếng Việt có dấu/Shift+Enter/Enter với bộ gõ người dùng trên UI cục bộ. Composition start/end vẫn 0, nên không tuyên bố đã phủ bộ gõ phát composition hoặc Enter chọn ứng viên IME. Bằng chứng: `cv32-evidence/ui-vietnamese-keyboard.txt` và `.png`. Đã dọn lại fixture tạm sau lượt này.

- Có một lượt API đầy đủ đạt, nhưng chưa tái lập ổn định; không kết luận API production đã hết lỗi.
- Đã kiểm thử hai tab giao diện bằng bộ điều khiển trình duyệt trong ứng dụng. Cách khởi chạy Edge/Playwright trước đó timeout không tính là kiểm thử sản phẩm.
- Đã thử người dùng gõ tiếng Việt có dấu trên UI cục bộ; chưa xác minh luồng IME phát composition. Mất mạng khi gửi trên UI với API production chưa đạt bằng chứng ổn định. Ngắt socket và hòa giải qua UI với máy chủ cục bộ đã đạt; chưa thử bàn phím điện thoại thật.
- Theo quyết định của người phụ trách, tạm dừng điều tra blocker API và bàn giao phần kiểm thử CV32 kèm giới hạn đã ghi. Sửa backend và chạy lại ma trận production được để lại; không ghi các ca chưa kiểm chứng là đạt. Chưa gửi thông báo/review cho thành viên khác hoặc tự xác nhận nghiệm thu thay người review.
