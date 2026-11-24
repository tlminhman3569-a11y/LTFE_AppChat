### CV46 — Bổ sung kiểm thử tích hợp luồng `/chat`

Đã bổ sung kiểm thử có giao diện AppChat/Redux thật thay cho `ui_probe.html`. Bộ kiểm thử tự động thao tác qua `ConversationSidebar`, `JoinRoom`, `RoomMembersPanel`, `LeaveRoom`, `ChatLayout`, `Composer` và các Redux slices gốc; **chỉ giả lập phản hồi lớp WebSocket**.

**Kết quả: 23/23 PASS.**

- JOIN lần đầu trả `success`: 1 lệnh JOIN.
- OUT trả `status:error` (mock lỗi nghiệp vụ): nháp giữ nguyên, cảnh báo **Cần xác minh** xuất hiện, nút **Gửi** bị khóa.
- Mở lại **Tham gia phòng**: nút mở, chưa phát sinh JOIN mới (vẫn 1 lệnh).
- Bấm xác nhận: có đúng một JOIN mới (tổng 2 lệnh); khi pending nút bị vô hiệu hóa và không gửi trùng.
- JOIN mới trả `success`: cảnh báo hết, Gửi hoạt động, nháp còn, `SEND_CHAT` không bị gọi tự động.

**Bằng chứng:** `docs/CV046_CHAT_INTEGRATION/01...png` đến `04...png`; `CV46_chat_integration_trace.json`; `CV46_chat_test_results.txt`. Script chạy lại với Vite: `frontend/scripts/cv46-chat-integration/run_chat_e2e.py` và `mockSocket.js`.

**Giới hạn:** Ảnh kèm PR thu trong Chromium với source React/Redux thật nhưng route `/chat` được chọn bằng MemoryRouter tại sandbox (trình duyệt bị chặn điều hướng localhost); khi chạy script trên Windows/Vite thật sẽ dùng BrowserRouter `/chat`. Tất cả phản hồi server trong bài test đều là giả lập, **không phải log WebSocket thật**. Chưa đánh dấu nghiệm thu tích hợp máy chủ thật.
