# CV46 – chạy kiểm thử tích hợp trên /chat

Bộ test **không sửa mã React hoặc Redux của ứng dụng**. Tương tác với chính trang `/chat`: `ConversationSidebar` → `JoinRoom` → `RoomMembersPanel` → `LeaveRoom` → Redux `roomsSlice` → `ChatLayout` → `Composer`.

**Chuẩn bị máy Windows / VS Code:**

1. Chép nguyên thư mục `frontend/scripts/cv46-chat-integration/` vào source đã áp dụng bản vá CV46 JOIN retry.
2. Trong terminal `LTFE_AppChat/frontend`, chạy `npm ci` rồi `npm run dev`.
3. Cài Python 3.10+ và Playwright: `python -m pip install playwright` sau đó `python -m playwright install chromium`.
4. Ở một terminal mới, đang tại thư mục `frontend`, chạy:

```powershell
python scripts/cv46-chat-integration/run_chat_e2e.py --url http://localhost:5173/chat
```

Nếu Vite dùng cổng khác (5174, 5175...), thay trong `--url`. Ảnh và log xuất vào `frontend/scripts/cv46-chat-integration/evidence_out/`.

Bản test sử dụng trình duyệt Chromium ở **browser context riêng**, `add_init_script(mockSocket.js)` chỉ thay đối tượng `WebSocket` tới `chat.longapp.io.vn`. HMR WebSocket của Vite vẫn được giữ nguyên. Giả lập cả đăng nhập thử và GET/JOIN/OUT (không dùng tài khoản thật); luôn cố ý trả `OUT_ROOM/error`. **Không gửi bất kỳ yêu cầu tới máy chủ chat thật**.

Nếu trình duyệt/ứng dụng chưa mở được, xác nhận `npm run dev` đã chạy và đúng cổng; nếu thiếu Chromium của Playwright, chạy lại lệnh cài ở bước 3.

### Đánh giá bắt buộc

- `JOIN_ROOM` lần đầu success.
- `OUT_ROOM` trả `status:error` → cảnh báo hiện, bản nháp còn, `Gửi` disabled.
- Mở JOIN không tự gọi `JOIN_ROOM`.
- Nhấn xác nhận, có đúng một JOIN mới; `pending` disabled và không gửi trùng.
- JOIN mới success → cảnh báo biến mất, `Gửi` enabled, bản nháp còn, không có `SEND_CHAT` tự động.
- File `CV46_chat_integration_trace.json` phân biệt rõ `client_request` và `mock_server_response`.

**Lưu ý:** Hình ảnh và log kèm sẵn trong `docs/CV046_CHAT_INTEGRATION/` được thu ở môi trường fallback offline (MemoryRouter chọn `/chat`) vì hạn chế điều hướng của sandbox. Khi chạy lệnh `--url` trên Windows, ứng dụng thật dùng BrowserRouter của Vite tại `http://localhost:5173/chat`. Bằng chứng này vẫn không thay thế xác nhận lỗi thực tế của server.
