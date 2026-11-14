# CV43: Ghép CV09 reconnect và CV24 chat riêng (bản ngày 14/11/2026)

## Nguồn và phạm vi

Bản này được ghép từ ZIP `LTFE_AppChat-develop (1).zip` do người dùng gửi và các file CV43 đã bàn giao trước đó. Trong ZIP mới nhất, CV09 thực sự xuất `retrySocketConnection` từ `frontend/src/features/auth/reconnectSession.ts`, còn `useSocket()` chỉ cung cấp `connectionStatus`, `reconnectCount`, `canUseSocket`. Không thay đổi `reconnectSession.ts`, `useSocket.ts`, `socketClient.ts`, `authApi.ts`, `App.tsx` của CV09.

`ChatLayout.tsx` là phiên bản CV09 gốc cộng thêm adapter CV24 và chuyển đổi mock/API của CV43. Không còn gọi `reLogin()` trực tiếp, không dùng `setReconnectCount()` cục bộ. Nút **Thử kết nối lại** chỉ hiện khi trạng thái `disconnected`, gọi `retrySocketConnection` của CV09. Không có trạng thái lỗi thủ công riêng vì CV09 quản lý trạng thái qua Redux. Giữ `loadHistory` của CV24 cho chat riêng khi ở API thật; chat phòng tiếp tục mock chờ CV45.

`ChatPage.tsx` buộc phải nhận `reconnectCount`. `ChatHistory` được đánh lại key bằng `[sessionGeneration, conversationKey, reconnectCount]`. `Composer` chỉ theo `conversationKey`; người dùng vẫn ở hội thoại cũ và bản nháp lưu trong `useChatDrafts()` thuộc `ChatLayout`.

Ngoài hai file trọng tâm, bản ZIP đầy đủ đã mang theo phần CV43 tra cứu chính xác (`CheckUser`, parser `data.status`, `usersApi`, `ConversationSidebar`, presence slice) từ bộ CV43 đã chuẩn bị trước đó, vì ZIP `develop` gửi tới chưa chứa CV43.

## Kết quả kiểm tra thực hiện được

- `check-cv43-cv09-flow.mjs`: **15/15 PASS** trên mô phỏng luồng CV09 thực, gồm auto reconnect, ba lần tự thử thất bại, retry thủ công, tránh hai `RE_LOGIN` cùng lúc, chỉ tăng `reconnectCount` sau kết quả success. Kiểm tra trạng thái hội thoại/bản nháp được kết hợp với hợp đồng khóa UI, không phải chạy DOM thực.
- `check-cv43-cv09-contract.mjs`: **13/13 PASS** trên mã nguồn.
- `check-cv43-cv24-bridge.mjs`: **18/18 PASS** trên mã nguồn.
- `check-cv43.mjs`: **69/69 PASS**.
- `check-cv42.mjs`: **52/52 PASS**.
- Kiểm tra cú pháp TSX: cần xem log `CV43_KIEM_TRA_CUC_BO.txt` trong bộ bàn giao.
- Môi trường chạy kiểm thử tạo ZIP: **Node.js v22.16.0**. Đây không phải môi trường Node.js v26.11.1 của người dùng.
- `npm ci` trong môi trường tạo ZIP bị chặn truy cập registry và cache thiếu gói; **chưa xác nhận build/lint/Vitest**. Không đánh dấu các mục này PASS.
- **Chưa có kết nối API thật đã đăng nhập**, vì vậy các ca WebSocket thật và log username thật **chưa chạy**. Không tạo log PASS giả.

## Chạy ở WebStorm / Node.js v26.11.1

```powershell
cd D:\LTFE_AppChat\frontend
node -v
npm ci
node --experimental-strip-types scripts/check-cv43-cv09-flow.mjs
node scripts/check-cv43-cv09-contract.mjs
node scripts/check-cv43-cv24-bridge.mjs
node --experimental-strip-types scripts/check-cv43.mjs
node --experimental-strip-types scripts/check-cv42.mjs
npm test -- scripts/cv09-reconnect.test.ts
npm test -- scripts/cv24-history.test.ts
npm run build
npm run lint
```

## Kiểm thử API thật và xuất log đã che

Dùng giao diện Vite `npm run dev` và mở `/chat` trên trình duyệt có đăng nhập, **không tạo WebSocket thứ hai**. Mở DevTools > Sources > Snippets, dán nội dung script theo từng ca. Mọi log đều cố ý không chứa username, mật khẩu, mã RE_LOGIN hay nội dung tin nhắn.

### CV09 AUTO

Mở chat riêng đã tải lịch sử, nhập bản nháp chưa gửi. Chạy `frontend/scripts/cv43-cv09-live-observe.js`, chọn `auto`. Ngắt mạng, bật lại trước khi CV09 hết lượt thử tự động. Không bấm nút thử lại. Sau khi `RE_LOGIN` trả success, kiểm tra lịch sử tải lại và bản nháp/hội thoại vẫn còn. Xuất `CV43_CV09_AUTO_DA_CHE.txt` từ nút trên màn hình. Kiểm tra log `Max simultaneous RE_LOGIN <= 1`, `Redux reconnectCount increments = 1`, `History page=1 before Redux reconnection success = 0`, `History page=1 after Redux reconnection success >= 1`.

### CV09 MANUAL

Tải lại trang và tạo bản nháp khác. Chạy snippet, chọn `manual`. Ngắt mạng đủ lâu cho ba lần tự thử, chờ giao diện hiện **Thử kết nối lại**. Bật mạng, bấm nút này. Xác nhận `RE_LOGIN` success mới tải lại lịch sử, bản nháp và hội thoại không đổi. Xuất `CV43_CV09_MANUAL_DA_CHE.txt`. Lưu ý lần kết nối thất bại trước khi mở socket sẽ không sinh request `RE_LOGIN`, vì vậy cần đối chiếu thêm console/network hoặc test CV09 (ba lần tự động) để xác nhận số lượt.

### CV43 username tồn tại / không tồn tại

Chạy `frontend/scripts/cv43-live-check.js` trong Snippets, lần lượt nhập một username thực sự tồn tại và một username không tồn tại. Script gửi yêu cầu qua `socketClient` đang có, kiểm tra parser `CHECK_USER_EXIST` và xuất `CV43_API_LIVE_DA_CHE.txt` có mẫu `data.status` boolean được che phần username. Không tự ý đưa raw JSON chứa username/token vào PR.

### CV43 ngoài fixture, mở lịch sử CV24

Chạy `frontend/scripts/cv43-cv24-live-snippet.txt` trong Snippets, chuyển sidebar sang **API thật > Người dùng**, nhập username tồn tại nhưng không nằm trong fixture rồi chọn **Kiểm tra người dùng**. Đợi chat riêng mở và phản hồi `GET_PEOPLE_CHAT_MES` trang 1. Bấm **Xuất log đã che** để có `CV43_CV24_LICH_SU_NGOAI_FIXTURE_DA_CHE.txt`. Mảng lịch sử rỗng là hợp lệ nếu chat mới; phải xác nhận UI hiển thị "Chưa có tin nhắn".

## PR và GitHub

Sau khi test đạt trên máy bạn, chỉ đưa các file cần thiết vào nhánh `feat/khoi/cv43`, tránh ghi đè lại file CV09 của Mẫn bằng phiên bản cũ. Bản ZIP **thư mục patch** là bộ phù hợp để chép vào nhánh hiện tại; ZIP **toàn dự án** chỉ dùng làm nguồn tham khảo/đối chiếu do nhánh `develop` khác nhánh CV43 của bạn.

| Mục | Phụ trách | Trạng thái |
|---|---|---|
| CV43 parser, tìm username, gọi chat riêng và ghép CV24 | Trương Hoàng Minh Khôi | Đã sửa mã nguồn, cần live logs |
| CV09 lock RE_LOGIN, 3 lần tự thử, retry thủ công | Trần Lê Minh Mẫn | Giữ nguyên source CV09; test mô phỏng đã đạt |
| CV24 loadHistory và GET_PEOPLE_CHAT_MES | Cao Tuấn Kiệt | Giữ adapter; cần live test username ngoài fixture |
| CV45 lịch sử phòng thật | Trương Hoàng Minh Khôi | Ngoài phạm vi PR này |

Chỉ ghi `PASS` cho API thật khi chính bạn chạy từ phiên đăng nhập và có log hợp lệ.
