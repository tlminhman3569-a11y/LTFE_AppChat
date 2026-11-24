# CV46 – Bằng chứng kiểm thử tích hợp giao diện AppChat /chat

## Kết quả

**23/23 kiểm tra PASS** trên Chrome/Chromium với các module giao diện và Redux gốc của `LTFE_AppChat`, đặc biệt: `ChatLayout`, `ConversationSidebar`, `RoomMembersPanel`, `MemberList`, `JoinRoom`, `LeaveRoom`, `Composer`, `useChatDrafts`, `roomsSlice`, `socketClient`, `roomsApi`.

Kịch bản: `JOIN_ROOM/success` → `OUT_ROOM/error` (business) → nháp còn / Gửi bị khóa / cảnh báo hiện → mở form không gửi JOIN → bấm xác nhận phát sinh 1 JOIN mới → pending khóa trùng → `JOIN_ROOM/success` → cảnh báo biến mất / Gửi mở / nháp còn / không tự gửi.

### Bằng chứng

- `01_chat_OUT_error_draft_preserved_send_disabled.png`: ảnh cảnh báo `Cần xác minh`, thông báo lỗi OUT, bản nháp và nút **Gửi** bị khóa.
- `02_chat_rejoin_open_no_request.png`: form JOIN lại có thể bấm và chưa phát sinh JOIN mới.
- `03_chat_join_success_warning_removed_send_enabled.png`: JOIN mới thành công; cảnh báo đã biến mất ở danh sách thành viên.
- `04_chat_after_join_send_enabled_draft_retained.png`: ảnh bản nháp còn, nút **Gửi** được mở.
- `CV46_chat_integration_trace.json`: bản ghi request/response ở **socket giả lập**, có thứ tự và số lần gọi; KHÔNG phải log Network WS của server thật.
- `CV46_chat_test_results.txt`: danh sách 23 assertions đạt.

### Phạm vi và giới hạn

- Chỉ **lớp WebSocket trong phiên kiểm thử** được thay bằng socket mock; hành vi giao diện/Redux/room API chạy từ **source thực tế**, không dùng `ui_probe.html` và không viết cảnh báo, bản nháp hay `canSend` trong harness.
- Môi trường sandbox không cho Chromium đi tới localhost, vì thế bản minh chứng ở đây được biên dịch offline từ source thật; **AppRoutes được chọn tuyến `/chat` bằng MemoryRouter chỉ trong test entry**. URL trình duyệt bằng `about:blank`, không phải Vite live URL.
- Các phản hồi `RE_LOGIN`, `GET_USER_LIST`, `GET_ROOM_CHAT_MES`, `JOIN_ROOM` cũng được mock để có kịch bản nhất quán; phản hồi `OUT_ROOM/error` được cố ý tiêm vào mock.
- Bộ script kèm theo cho phép thành viên chạy lại trên `http://localhost:5173/chat` với **BrowserRouter thật của dự án**. Chưa thể chứng minh trên máy chủ WebSocket thật hiện trả lỗi.
- Đừng gắn nhãn những file này là log server thật. Không thay đổi dữ liệu/DB hay WebSocket server nhóm.

### Đối chiếu số lần gọi

```
JOIN_ROOM request #1 -> JOIN_ROOM success
OUT_ROOM request #1  -> OUT_ROOM error (business, simulated)
GET_ROOM_CHAT_MES    -> success (metadata đối chiếu; cảnh báo vẫn giữ)
Mở lại form JOIN    -> JOIN_ROOM request count vẫn là 1
Xác nhận JOIN       -> JOIN_ROOM request #2
Chặn pending        -> JOIN_ROOM request count vẫn là 2
JOIN_ROOM success   -> Gửi enabled, draft unchanged, SEND_CHAT count=0
```
