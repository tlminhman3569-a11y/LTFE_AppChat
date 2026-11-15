# CV43 — Nhật ký tích hợp CV25/CV26 và xác minh WebSocket (đã che thông tin)

**Cập nhật:** 15/11/2026  
**Source đích:** `LTFE_AppChat(1).zip` (nhánh CV43). **Source tham chiếu để khôi phục CV25/CV26:** `LTFE_AppChat-develop(2).zip`.  
**Tài liệu API:** `chat_API(1).xlsx`, sheet `0Sheet1`/`Sheet1`, các dòng `LOGIN`, `GET_PEOPLE_CHAT_MES`, `CHECK_USER_EXIST`, `CHECK_USER_ONLINE`, `SEND_CHAT`.

> **Phân biệt bằng chứng:** Các kết quả `npm run lint`, TypeScript, 69/69 và các bài test qua socket giả lập chứng minh code; không chứng minh một username có thật trên máy chủ. Không ghi `API_THẬT: PASS` khi không có phản hồi từ WebSocket đã xác thực.

## 1. Đường đi đã ghép (source, kiểm thử cục bộ)

- **CV43:** `CheckUser.tsx` chỉ gọi `usersApi.checkExists(user)` khi xác nhận username đầy đủ. Username tồn tại: `onSelectConversation({ kind: 'people', name: user })`. Không tồn tại: báo lỗi, không tạo người/hội thoại giả. Username chính mình không gửi request. Chọn người có kiểm tra online một lần, nhãn không giả realtime.
- **CV25:** `ChatLayout` giữ `selectedConversation`; `ChatPage → useChat → fetchHistoryPage → chatApi.loadHistory` truy vấn `GET_PEOPLE_CHAT_MES` với `{ name: conversation.name, page: 1 }`, currentUser lấy từ Redux auth. Lịch sử được lưu theo khóa `[kind,name]`; kết quả chậm không ghi sang cuộc chat vừa chọn. Lịch sử phòng giữ phạm vi adapter CV45 của thành viên khác.
- **CV26:** `ChatLayout` gọi `sendText()` thật, subscribe `SEND_CHAT`; `messagesSlice` có `messageReceived`, `markViewed`, `unread`, `selectUnreadCount`. Chưa xem tăng cục bộ khi nhận tin ở cuộc chat khác và xóa khi mở; không biến tin echo thành ACK, không tự tạo read receipt. Tùy chọn mock ở sidebar chỉ là thử danh sách, không được dùng để gửi tin lên máy chủ.
- **CV09:** socket dùng chung, dọn listener, reconnect và tải lại theo vòng đời phiên. Không tạo kết nối WebSocket mới trong ChatLayout.

### Khác biệt trong tên event ở workbook

Bảng `chat_API(1).xlsx` mô tả **event trên dây** (gửi/nhận) là `CHECK_USER_EXIST` và `CHECK_USER_ONLINE`. Hợp đồng nội bộ của CV43 dùng tên lời gọi `CHAT_CHECK_USER_EXIST` / `CHAT_CHECK_USER_ONLINE`.

Bản ghép giữ tên nội bộ để không làm hỏng service/hợp đồng, nhưng `socketClient.request` ánh xạ **event gửi thật** thành `CHECK_USER_EXIST` / `CHECK_USER_ONLINE`, đồng thời chờ reply cùng event tương ứng. Điều này được kiểm tra bằng Fake WebSocket trong `check-cv43-cv26-behavior.mjs`. **Chưa khẳng định máy chủ chấp nhận mapping này nếu chưa chạy live.**

Payload tương ứng đã đối chiếu workbook (chỉ hiển thị tên đã che):

```json
{"action":"onchat","data":{"event":"CHECK_USER_EXIST","data":{"user":"[USERNAME_REDACTED]"}}}
```

```json
{"event":"CHECK_USER_EXIST","status":"success","data":{"status":true}}
```

*Hai khối JSON trên là quy ước API trong workbook, không phải hai response đã quan sát ở máy chủ.*

## 2. Kết quả thực thi trên bản đã ghép

Môi trường: Node.js **22.16.0**, 15/11/2026. Thư mục chạy: `frontend/`.

| Lệnh | Kết quả quan sát | Phạm vi |
|---|---|---|
| `npm run lint` | **PASS**, exit 0 | Toàn bộ frontend |
| `node node_modules/typescript/bin/tsc -b` | **PASS**, exit 0 | TypeScript |
| `node scripts/check-cv43.mjs` | **69/69 PASS** | Parser, service, contract và nối CV25/CV26 (mock) |
| `node scripts/check-cv43-cv24-bridge.mjs` | **18/18 PASS** | Điểm nối tra người và tải lịch sử (source) |
| `node scripts/check-cv43-cv09-contract.mjs` | **13/13 PASS** | Reconnect và hợp đồng nguồn |
| `node scripts/check-cv43-cv09-flow.mjs` | **15/15 PASS** | State machine reconnect (mock) |
| `node scripts/check-cv43-cv26-behavior.mjs` | **12/12 PASS** | Gửi, nhận, unread, event trên dây, kiểm tra username, lịch sử qua Fake WebSocket |
| `npm test` | **KHÔNG CHẠY ĐƯỢC** (`vitest: not found`) | ZIP đính kèm không chứa Vitest trong node_modules; không có kết nối registry để `npm ci` |
| `npm run build` | **CHƯA ĐẠT trong môi trường này** | `tsc -b` xong; Vite thiếu native `@rolldown/binding-linux-x64-gnu`, ZIP có bản Windows |

**Không được đổi dòng `npm test` thành 43/43 PASS trước khi thực sự chạy Vitest.** Trên máy có Internet và Node phù hợp, chạy `npm ci`, `npm test`, `npm run build`, `npm run lint` và ghi log mới vào PR.

## 3. Kết quả kết nối máy chủ thật đã thử

Thử mở handshake *không có tài khoản đăng nhập* tới `wss://chat.longapp.io.vn/chat/chat` bằng Node WebSocket trong môi trường này:

```text
handshake: ERROR (network or DNS; no LOGIN attempted)
```

Lệnh `node scripts/check-cv43-live.mjs` khi không có tài khoản được cấp báo:

```text
CHƯA CHẠY: cần APPCHAT_PROBE_USER/PASS/PEOPLE/NOT_FOUND; ba username phải khác nhau.
Exit code: 2
```

Không có dữ liệu đăng nhập được phép để gửi `LOGIN`. Do đó **không có response thật** `CHECK_USER_EXIST` cho ca A/B, cũng chưa quan sát thao tác UI thật cho A. Đây là giới hạn môi trường kiểm thử, không phải bằng chứng server đã trả `false` hay chức năng thất bại.

### Hai ca cần có log WebSocket được che

| Ca | Điều kiện | Response cần xác minh | Chat/UI cần xác minh | Kết quả thực tế |
|---|---|---|---|---|
| **A** | Username tồn tại, khác người đăng nhập, ngoài `src/fixtures/users.ts` | `CHECK_USER_EXIST` với `data.status: true` | Mở `{kind:'people', name:A}`, gọi `GET_PEOPLE_CHAT_MES {name:A,page:1}` success, hiển thị lịch sử hoặc trạng thái trống hợp lệ | **CHƯA XÁC MINH API THẬT** |
| **B** | Username chắc chắn không tồn tại | `CHECK_USER_EXIST` với `data.status: false` | Hiện không tìm thấy, không chọn cuộc chat B, không gọi lịch sử B | **CHƯA XÁC MINH API THẬT** |

*Không có tệp TXT chứa hai response thật từ một phiên đã đăng nhập để điền log PASS; không lấy dữ liệu ví dụ trong Excel làm kết quả thực tế.*

## 4. Công cụ kiểm tra THỰC SỰ CÓ SẴN trong nhánh PR

Hai file này đã được thêm vào **`frontend/scripts/` của bản ghép**:

1. **`frontend/scripts/check-cv43-live.mjs`** — probe độc lập Node 22+ với một WebSocket thật: LOGIN, kiểm tra A (true) / B (false), tải lịch sử A trang 1; xuất `frontend/CV43_API_LIVE_DA_CHE.txt` chỉ chứa metadata. Kiểm tra A ngoài fixture; timeout đóng kết nối để không gán phản hồi muộn cho B. Script gửi `CHECK_USER_EXIST` đúng workbook; không dùng fixture API.
2. **`frontend/scripts/cv43-cv24-live-snippet.js`** — chạy trong DevTools/Sources/Snippets **trên UI `/chat` đang đăng nhập**, theo dõi `socketClient` dùng chung để xác minh A mở đúng chat riêng và màn hình hiển thị lịch sử sau request; xuất `CV43_CV24_LICH_SU_NGOAI_FIXTURE_DA_CHE.txt`. Snippet không mở socket thứ hai và không lưu username hoặc nội dung tin.

### Chạy probe thật từ PowerShell (Windows)

Chạy **trong thư mục `frontend`** của PR có hai script. Dùng tài khoản kiểm thử được phép; không lưu mật khẩu vào mã nguồn / terminal history:

```powershell
$cred = Get-Credential -Message 'Dang nhap tai khoan kiem thu AppChat'
$env:APPCHAT_PROBE_USER = $cred.UserName
$env:APPCHAT_PROBE_PASS = $cred.GetNetworkCredential().Password
$env:APPCHAT_PROBE_PEOPLE = Read-Host 'Username A ton tai, ngoai fixture'
$env:APPCHAT_PROBE_NOT_FOUND = Read-Host 'Username B khong ton tai'
try {
    node scripts/check-cv43-live.mjs
} finally {
    Remove-Item Env:APPCHAT_PROBE_USER, Env:APPCHAT_PROBE_PASS, Env:APPCHAT_PROBE_PEOPLE, Env:APPCHAT_PROBE_NOT_FOUND -ErrorAction SilentlyContinue
}
```

Báo cáo API: `CV43_API_LIVE_DA_CHE.txt`. Chỉ ghi **PASS** khi report thực sự có `LOGIN: success`, `A-exists.pass: true`, `B-not-found.pass: true`, `A-history-page1.pass: true` và `API_RESULT: PASS`. Request history success với mảng trống vẫn hợp lệ. File được `.gitignore` chặn để tránh commit ngoài ý muốn; copy metadata đã che vào mục 5 nếu đã chạy.

### Kiểm chứng UI với username A ngoài fixture

1. `npm ci` (nếu chưa cài dependencies), `npm run dev`; đăng nhập từ `/login`, chờ WebSocket connected, tới `/chat`.
2. Mở **Chrome DevTools → Sources → Snippets**, tạo snippet từ **`frontend/scripts/cv43-cv24-live-snippet.js`**, chạy trước khi bấm nút tra cứu. Chọn **API thật**, lọc **Người dùng**, nhập **A ngoài fixture**, bấm **Kiểm tra người dùng**.
3. Đợi cuộc chat riêng được mở và lịch sử trang 1 tải xong; bấm **Xuất log đã che** trên bảng quan sát. File tải xuống phải có `Username ngoai fixture: PASS`, `CHECK_USER_EXIST data.status=true: PASS`, `GET_PEOPLE_CHAT_MES trang 1 dung username: PASS`, `Phan hoi lich su: success`, `Chat rieng mo dung: PASS`, `Giao dien hien thi du lieu lich su: PASS`, `KET QUA: PASS`.
4. Trên cùng giao diện, nhập **B** và bấm Kiểm tra; kiểm tra thông báo không tìm thấy, không chuyển chat B, không gọi history B. Quan sát Network WS, chỉ xuất/copy metadata đã che, không dùng ảnh có token/nội dung riêng.
5. Cung cấp **ngày giờ UTC + commit Git** và hai TXT đã che. Kiểm tra các file không chứa username gốc, mật khẩu, mã phiên, tin nhắn hay ID cá nhân trước khi gửi cho người review.

Nếu API thật không phản hồi đúng giao thức workbook, ghi lại `errorKind`, `responseEvent`, `responseStatus` đã che; **không tự đổi event ngược sang `CHAT_` hoặc đánh dấu PASS khi chưa quan sát phản hồi**. Trao đổi với người giữ `socketClient` trước khi đổi transport.

## 5. Khu vực dán log thực tế (không dùng log mẫu)

**Ca A — Username tồn tại ngoài fixture**

```text
Thoi_diem_UTC: CHUA_CO
Commit: CHUA_CO
LOGIN: CHUA_CO_PHIEN_XAC_THUC
CHECK_USER_EXIST(true): KHONG_CO_RESPONSE_THAT
GET_PEOPLE_CHAT_MES(page=1): KHONG_CO_RESPONSE_THAT
UI_chat_rieng_dung_A: CHUA_KIEM_CHUNG
Ket_luan: NOT_VERIFIED
```

**Ca B — Username không tồn tại**

```text
Thoi_diem_UTC: CHUA_CO
Commit: CHUA_CO
LOGIN: CHUA_CO_PHIEN_XAC_THUC
CHECK_USER_EXIST(false): KHONG_CO_RESPONSE_THAT
UI_khong_mo_B_va_khong_tai_history_B: CHUA_KIEM_CHUNG
Ket_luan: NOT_VERIFIED
```

**Nghiệm thu:** Code CV43 + CV25/CV26 đã đạt các kiểm tra offline được liệt kê tại mục 2. **Nghiệm thu WebSocket thật/UI của hai ca A/B còn thiếu bằng chứng.** Khi có hai tệp TXT thật, thay hai khối mục 5 bằng nội dung đã che đúng thực tế rồi mới đánh dấu API/UI PASS.
