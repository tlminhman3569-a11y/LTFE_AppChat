# CV43 + CV25/CV26 — Biên bản ghép mã

Ngày 15/11/2026. Nguồn đích `LTFE_AppChat(1).zip`, tham chiếu CV25/CV26 từ `LTFE_AppChat-develop(2).zip`.

## Mã đã phục hồi

- `frontend/src/store/slices/messagesSlice.ts`: khôi phục `messageReceived`, `markViewed`, `unread`, `selectUnreadCount`, cùng logic lịch sử CV25.
- `frontend/src/components/ChatLayout.tsx`: khôi phục gửi tin thật `sendText`, nhận `subscribeToMessages`, pending/unconfirmed/error, xóa unread khi mở. Giữ tín hiệu chế độ mock của CV43 để khóa gửi khi demo.
- `frontend/src/features/chat/ChatPage.tsx`: trở lại `useChat` + Redux, hiển thị tin đã tải, retry/older, tin chưa xác nhận. Có nhãn kiểm tra online theo CV43; không suy online realtime.
- `frontend/src/services/socketClient.ts`: tên gọi nội bộ CV43 vẫn `CHAT_CHECK_USER_EXIST`/`CHAT_CHECK_USER_ONLINE`; frame đi thật `CHECK_USER_EXIST`/`CHECK_USER_ONLINE` theo workbook `chat_API(1).xlsx`, phản hồi cùng event.
- Giữ nguyên chức năng CV43 trong sidebar, `CheckUser`, parser, presence và các khóa `{kind,name}`.
- Thêm `frontend/scripts/check-cv43-live.mjs` và `frontend/scripts/cv43-cv24-live-snippet.js` vào PR; không phải công cụ ở ngoài nhánh.

## Bằng chứng đã chạy

`npm run lint`: PASS (exit 0). `tsc -b`: PASS (exit 0). `check-cv43.mjs`: 69/69. `check-cv43-cv24-bridge.mjs`: 18/18. `check-cv43-cv09-contract.mjs`: 13/13. `check-cv43-cv09-flow.mjs`: 15/15. `check-cv43-cv26-behavior.mjs`: 12/12.

`npm test`: **không thể chạy Vitest** trên máy phân tích do ZIP Windows không có package `vitest`, npm registry không phân giải DNS. Do vậy **chưa được tuyên bố 43/43 PASS**.

`npm run build`: typecheck hoàn tất nhưng Vite thiếu `@rolldown/binding-linux-x64-gnu` vì ZIP chỉ có binding Windows. Đây là blocker môi trường kiểm thử Linux; phải kiểm lại build sau `npm ci` trên máy phát triển có mạng.

`check-cv43-live.mjs`: chạy khi không có biến môi trường thoát mã 2 (đúng), không phát sinh log giả. Handshake không xác thực riêng đến WSS bị lỗi mạng/DNS, không thu được response server; yêu cầu kiểm thử có tài khoản hợp lệ và hai username được phép.

## Lệnh nghiệm thu trên máy phát triển

```bash
cd frontend
npm ci
npm test
npm run build
npm run lint
node scripts/check-cv43.mjs
node scripts/check-cv43-cv26-behavior.mjs
```

Các bước API thật, bảo mật log, và luồng UI ngoài fixture ở `docs/CV43_API_LOG.md`. Không push mã lên main, tạo PR vào `develop` theo phân công.
