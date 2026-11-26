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

Trong thư mục frontend, cấp biến môi trường qua terminal, không ghi vào file được commit:

- `APPCHAT_PROBE_USER`, `APPCHAT_PROBE_PASS`: tài khoản gửi.
- `APPCHAT_PROBE_PEOPLE`, `APPCHAT_PROBE_PEER_PASS`: tài khoản nhận.

Chạy `npx vitest run scripts/cv32-live.test.ts`. Thiếu tài khoản thì bộ live test bị bỏ qua. Khi đã cấp tài khoản, lỗi hoặc blocker trả mã thoát khác 0.

Chạy `node scripts/check-cv32-session.mjs` để đối chiếu trực tiếp LOGIN → CREATE_ROOM → GET_ROOM_CHAT_MES bằng WebSocket gốc. Phép thử tạo một phòng có tên riêng; không tự xóa phòng hoặc rời chủ phòng vì API không có thao tác phù hợp. Các phòng thử chỉ chứa dữ liệu kiểm thử.

Chỉ khi được phép kết thúc phiên của tài khoản thử, thêm `--fresh-session` cho script trên hoặc đặt `APPCHAT_CV32_FRESH_SESSION=1` cho live test. Chế độ này LOGIN/LOGOUT để làm sạch trước khi thử, không tự bật và không bảo đảm hết lỗi. Ca ngắt sau gửi tự RE_LOGIN trước khi bắt đầu, tránh lấy socket đã đóng từ ca trước làm kết quả của ca này.

## Chưa nghiệm thu

- Có một lượt đầy đủ đạt, nhưng chưa tái lập ổn định; CV32 chưa hoàn tất.
- Đã kiểm thử hai tab giao diện bằng bộ điều khiển trình duyệt trong ứng dụng. Cách khởi chạy Edge/Playwright trước đó timeout không tính là kiểm thử sản phẩm.
- Chưa kiểm thử IME và mất mạng trên giao diện; chưa thử bàn phím điện thoại thật.
- Chuyển kết quả API cho Mẫn đối chiếu máy chủ, sau đó chạy lại ma trận. CV32 đang làm, chưa đủ điều kiện đánh dấu hoàn tất.
