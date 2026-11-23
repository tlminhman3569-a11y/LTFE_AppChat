# CV46 — Đối chiếu khi UI còn `member` nhưng máy chủ từ chối `OUT_ROOM`

## 1. Nguồn và phạm vi

- Người phụ trách: **Trương Hoàng Minh Khôi**; kiểm tra chéo: **Trần Lê Minh Mẫn**.
- Nền áp dụng: source `LTFE_AppChat(4).zip` được gửi cùng yêu cầu, Git HEAD trong ZIP `6a7aec0`, nhánh `fix/khoi/cv46-out-room-rejected`.
- Căn cứ: `AppChat_PhanCong_NgayChuan.xlsx` (CV45–CV47), `PHAN_CONG_CHI_TIET_CV01_CV54.md`, `HOP_DONG.md`, `LUONG_GIAO_DIEN.md` (F05, F15–F18), `README.md`, `docs/CV045.md`, `docs/CV046.md`, `docs/CV047.md`.
- Đã mở URL GitHub công khai để kiểm tra tên repo, cấu trúc và quy trình làm việc. ZIP chứa nhánh đang làm việc, khác với trang mặc định `main`; bản sửa chỉ dựa vào nội dung ZIP đã nhận, không tự push/merge.
- Ảnh lỗi là **hiện tượng**: trạng thái giao diện `member` nhưng thao tác `OUT_ROOM` bị từ chối. Chưa có log phản hồi máy chủ và tài khoản kiểm thử để xác định nguyên nhân cuối cùng. Không suy diễn máy chủ sai hoặc tự gán `left`.

## 2. Đối chiếu mã nguồn trước sửa

1. `roomsSlice.mergeMetadata` nâng `membership` thành `member` khi `GET_ROOM_CHAT_MES` có `userList` chứa username. Danh sách có thể là dữ liệu trước thao tác, không bảo đảm lệnh `OUT_ROOM` hiện tại sẽ thành công.
2. `LeaveRoom.tsx` hiển thị lỗi nghiệp vụ, nhưng callback `onStatusChange` chỉ báo `'error'` mà không truyền `error.kind/message` về panel quản lý phòng.
3. `RoomMembersPanel` chưa có hành động tái đọc dữ liệu phòng sau khi `OUT_ROOM` bị từ chối.
4. `ChatLayout` cho phép gửi vào phòng khi `room.membership === 'member'` và không có yêu cầu rời pending/unknown, kể cả khi thao tác rời vừa bị máy chủ từ chối.
5. Trạng thái `member` cũ được giữ qua `RE_LOGIN` sau reconnect. Thành viên có thể đã thay đổi trên máy chủ trong thời gian mất kết nối; client cần kiểm lại.

## 3. Thay đổi trong bản vá

| File | Thay đổi |
| --- | --- |
| `frontend/src/store/slices/roomsSlice.ts` | Bổ sung cờ `leaveRejected` *tách biệt* membership; chỉ phản hồi `OUT_ROOM/error/business` đánh dấu xung đột. `GET_ROOM_CHAT_MES` không tự xóa cờ xung đột; chỉ `JOIN_ROOM`/`CREATE_ROOM` thành công hoặc `OUT_ROOM` thành công mới xóa cờ. `RE_LOGIN` hạ `member` cũ thành `unknown` để đợi đọc lại; giữ metadata để tham chiếu, không xóa phòng. |
| `frontend/src/features/rooms/LeaveRoom.tsx` | Truyền `ApiError` thật về callback khi `status === 'error'`, phân biệt lỗi nghiệp vụ với lỗi chưa gửi được. |
| `frontend/src/features/rooms/RoomMembersPanel.tsx` | Khi máy chủ *xác nhận từ chối* OUT_ROOM, lưu lỗi xung đột, gọi lại `refreshRoomMembers` (`GET_ROOM_CHAT_MES`) nếu còn kết nối. Không tự gửi `JOIN_ROOM`. |
| `frontend/src/features/rooms/MemberList.tsx` | Hiển thị “Cần xác minh”, lời từ chối máy chủ và thông tin `userList` có/không liệt kê tài khoản. Danh sách thành viên và quyền thực thi lệnh được trình bày tách biệt; sau khi rời thành công không còn ghi nhãn “Bạn · Thành viên” chỉ vì metadata cũ. |
| `frontend/src/components/ChatLayout.tsx` | Khóa gửi phòng khi có `leaveRejected`. Phần gửi chat riêng giữ nguyên; Mẫn/Kiệt cần review điểm nối này. |
| `frontend/src/features/rooms/leaveRoomRequestState.ts` | JOIN_ROOM thành công xóa kết quả OUT_ROOM cũ đã kết thúc (error/unknown/success), giữ nguyên OUT_ROOM đang pending, để không hiển thị lỗi cũ và không khóa rời sau JOIN mới. |
| `frontend/scripts/check-cv46-rejected.mjs` | 15 ca kiểm thử hồi quy offline, không đăng nhập hay thao tác với máy chủ. |

## 4. Nguyên tắc hành vi sau sửa

- **Hủy**: không gửi `OUT_ROOM`; bản nháp được giữ.
- **OUT_ROOM success hợp lệ**: chỉ lúc này mới ghi `membership = left`, xóa nháp phòng, bỏ chọn và ẩn khỏi danh sách tham gia; không xóa phòng máy chủ.
- **OUT_ROOM error/business**: giữ membership đã ghi nhận trước đó và metadata (không tự chuyển `left`), đánh dấu *không tin cậy để gửi tiếp*, hiển thị nguyên nhân và làm mới `GET_ROOM_CHAT_MES` để đối chiếu. Làm mới có tên trong `userList` cũng **không** tự xóa xung đột. Người dùng có thể chủ động thử rời lại hoặc nhấn **Tham gia phòng** để nhận xác nhận JOIN mới; không tự JOIN.
- **OUT_ROOM timeout/lỗi sau gửi**: kết quả `unknown`, theo cơ chế CV46 hiện có, không tự gửi lặp.
- **Lỗi kết nối trước khi gửi**: là `error`, không đánh dấu mâu thuẫn quyền vì chưa có từ chối từ máy chủ, cho thử lại.
- **RE_LOGIN sau reconnect**: quyền `member` đã lưu chuyển thành `unknown` cho tới khi có dữ liệu đọc phòng mới; `owner` hoặc `left` đã biết được giữ. Không suy quyền thành viên chỉ vì danh sách hội thoại gần đây.
- **JOIN_ROOM success đúng tên**: `roomConfirmed` cập nhật quyền và dọn cờ lỗi rời; không mở lại phòng nếu người dùng đã đóng hộp xác nhận JOIN.
- Chủ phòng xác nhận qua `own` vẫn không được tự rời; không bổ sung tính năng chuyển chủ/xóa phòng, không thay đổi giao thức WebSocket.

## 5. Kiểm tra cục bộ

Chạy từ `LTFE_AppChat/frontend`:

```bash
node node_modules/typescript/bin/tsc -b --pretty false
node node_modules/eslint/bin/eslint.js .
node scripts/check-cv46.mjs
node scripts/check-cv46-rejected.mjs
node scripts/check-cv47.mjs
node scripts/check-cv44.mjs
```

Kết quả tại môi trường kiểm tra: TypeScript PASS, ESLint PASS; CV46: 35/35; CV46-rejected: 15/15; CV47: 8/8; CV44: 42/42 (đều giả lập, không phải kiểm tra máy chủ). `check-cv45.mjs` có sẵn 24 phép thử đầu PASS, sau đó dừng ở import `../utils/richMessage` không được khai báo trong bộ nạp test (lỗi fixture test cũ, chưa có chứng cứ liên quan bản vá). `npm run build` chưa chạy hết vì file `vite` trong `node_modules/.bin` giải nén từ ZIP Windows không thực thi trực tiếp trên Linux; kiểm tra build lại trên máy Windows với `npm ci` và `npm run build`.

## 6. Thử nghiệm thật bắt buộc (CV49 / review CV46)

1. Trên Windows, dùng hai tài khoản **được phép**: A tạo phòng, B tham gia phòng bằng `JOIN_ROOM` thành công; không coi `GET_USER_LIST` là chứng cứ thành viên.
2. Ở B mở phòng, chọn **Thành viên → Làm mới**, chụp trạng thái `own`, `userList` (ẩn danh khi chia sẻ); ghi `membership` trước thao tác.
3. Ở B chọn **Rời phòng → Xác nhận**; trong DevTools Network → WS → Frames ghi đúng thứ tự `OUT_ROOM` với `{name}` và phản hồi `event/status/data/mes` đã ẩn thông tin nhạy cảm. Không gửi lại tự động.
4. Nếu máy chủ trả `error`, quan sát thông báo “Cần xác minh”, bản nháp còn, quyền gửi phòng bị khóa, `GET_ROOM_CHAT_MES` được đọc lại; so sánh `own/userList` trước và sau. Không có `JOIN_ROOM` tự động.
5. Phân biệt phản hồi error của chủ phòng, lỗi không có quyền, lỗi khác từ máy chủ (chỉ phân loại khi có frame thật). Xác định tại sao trạng thái `member` cũ lệch với quyền thực tế; nếu API thực tế khác hợp đồng, đối chiếu với Mẫn trước khi đổi parser.
6. Làm mới sau reconnect/`RE_LOGIN`: không còn quyền `member` từ cache như trước khi mất kết nối; đọc dữ liệu phòng mới trước khi mở quyền gửi.
7. Kiểm tra B chủ động `JOIN_ROOM` lại: chỉ success hợp lệ mới gỡ cờ xung đột; OUT_ROOM success chỉ rời đúng phòng, không xóa phòng, không mất nháp khi lỗi.
8. Kiểm tra bằng tài khoản chủ A, thử mở phòng khác trong lúc request pending, đổi tài khoản; không ghi nhầm state vào phiên mới. PR lên `develop`, kiểm tra chéo bởi Mẫn, sau đó mới cập nhật Excel nghiệm thu.

**Chưa xác minh:** nguyên nhân từ chối cụ thể của server và hành vi live, vì không có chứng cứ WebSocket/đăng nhập của hai tài khoản. Không khai báo là “đã sửa hoàn toàn lỗi server” cho đến khi kịch bản trên đạt trên API thật.


## Bổ sung ngày 23/11/2026 — JOIN lại sau OUT_ROOM error

Bản trước còn giữ cache `JOIN_ROOM/success` cũ sau khi OUT_ROOM bị máy chủ từ chối, khiến nút Tham gia phòng khóa. Bản vá tích lũy mới chỉ xóa cache `JOIN_ROOM/success` của cùng tên và phiên khi có `OUT_ROOM/error/business`, **không tự JOIN**, giữ các trạng thái JOIN `pending`/`unknown`, và xóa cảnh báo OUT chỉ sau JOIN success mới. Chi tiết, test và giới hạn xem `docs/CV046_JOIN_RETRY_AFTER_OUT_ERROR.md`.
