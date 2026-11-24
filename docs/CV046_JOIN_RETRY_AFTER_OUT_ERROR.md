# CV46/CV47 – Cho phép xác nhận JOIN lại sau khi OUT_ROOM bị từ chối

Ngày sửa: 23/11/2026. Chủ phần việc: Trương Hoàng Minh Khôi. Review chéo: Mẫn (phần kết nối/session) và Kiệt (quyền gửi, nháp).

## Tái hiện được trước sửa

1. Người dùng nhập đúng tên phòng, xác nhận `JOIN_ROOM` → `success`; cache `roomRequestState['join', sessionGeneration, name].status = 'success'`.
2. Người dùng xác nhận `OUT_ROOM` → máy chủ trả `status:'error'` với lỗi nghiệp vụ.
3. Người dùng chủ động mở lại **Tham gia phòng**, nhập cùng tên, bấm xác nhận: `JoinRoom.tsx` tính `locked=true` do `success` cũ; `sendRoomRequest` cũng chặn `previous && previous.status !== 'error'`, nên trả `null` mà không gửi `JOIN_ROOM` mới.

## Cách sửa

- `roomRequestState.ts`: thêm `allowJoinRetryAfterRejectedLeave(name, sessionGeneration)`. Chỉ xóa kết quả JOIN **success cũ, đúng phòng, đúng phiên** sau OUT bị máy chủ từ chối. Thông báo subscriber để nút trong `JoinRoom` mở lại. Hàm không phát lệnh JOIN và không xóa trạng thái `pending`/`unknown`.
- `LeaveRoom.tsx`: chỉ gọi hàm trên khi phản hồi OUT là `error` và `error.kind === 'business'` (sau khi kiểm tra phiên và pending request hiện hành). Không dùng cho lỗi kết nối trước khi gửi, timeout hoặc kết quả không xác định.
- `ConversationSidebar.tsx`: không tiếp tục hiển thị thông báo JOIN thành công cũ trong lúc `leaveRejected` đang tồn tại. Sau JOIN success mới, `roomConfirmed` dọn cảnh báo và thông báo thành công có thể trở lại.
- **Giữ nguyên** `RoomMembersPanel` đánh dấu `leaveRejected` và đọc lại thành viên bằng GET_ROOM_CHAT_MES. Giữ nguyên `ChatLayout` khóa gửi nếu còn `leaveRejected`, `pending/unknown/success` OUT. `JoinRoom` tự gọi `resetLeaveAfterJoin` và `onJoined` **chỉ sau success khớp tên**, nên sau đó bỏ cảnh báo, mở gửi. Chưa rõ kết quả thì không tự JOIN.
- **Giữ nguyên bản nháp**: callback `onLeaveConfirmed` chỉ chạy khi OUT success; nháp chỉ xóa trong callback đó của `ChatLayout`, không chạy khi OUT error.

## Kiểm thử tự động (không gọi WebSocket thật)

Chạy từ `frontend`:

```powershell
npm ci
node scripts/check-cv46-rejoin.mjs
node scripts/check-cv46-rejected.mjs
node scripts/check-cv46.mjs
node scripts/check-cv47.mjs
node scripts/check-cv44.mjs
npm run lint
npm run build
```

Kết quả trong môi trường kiểm tra: TypeScript/ESLint PASS; CV44 42/42; CV46 35/35; CV46-rejected 15/15; CV46-rejoin **14/14**; CV47 8/8.

Đã kiểm tra trên Chromium headless bằng cách render **các component React thật** (`JoinRoom.tsx`, `LeaveRoom.tsx`), dùng các phản hồi JOIN success/OUT business error/JOIN success giả lập. Tương tác bằng click/tên phòng và xác nhận: trước OUT có JOIN_COUNT=1, sau OUT lỗi nháp còn/khóa gửi, mở lại dialog nút JOIN enabled, sau click có JOIN_COUNT=2, pending disabled, JOIN success thì cảnh báo hết, nút gửi enabled. Không có lỗi JavaScript tại trang thử. Ảnh trong `docs/CV046_UI_OFFLINE_*.png` là **giao diện thử riêng**, KHÔNG phải ảnh ứng dụng AppChat chạy với server thật.

`npm run build` Vite trên máy Linux kiểm tra chưa chạy hết vì phụ thuộc `@rolldown/binding-linux-x64-gnu` không có trong `node_modules` Windows của ZIP và môi trường kiểm tra không truy cập registry để cài thêm. Chạy lại `npm ci && npm run build` trên Windows trước PR.

## Bắt buộc kiểm tra giao diện app thật trước nghiệm thu

1. Mở `frontend` → `npm run dev`, mở ứng dụng và đăng nhập hai tài khoản thử nghiệm được phép (A là chủ, B thành viên). Ở B, mở phòng, soạn bản nháp và ghi lại nội dung nháp.
2. Gửi JOIN thành công đúng tên phòng trong một phiên, sau đó OUT bị server trả `error/business` (dùng môi trường test có thể tái hiện; **không giả lập bằng thao tác nguy hiểm với máy chủ ngoài quyền**).
3. Bấm **Tham gia phòng**, nhập tên cũ. Đối chiếu WebSocket Frames: trước nhấn xác nhận không có `JOIN_ROOM` mới; sau nhấn có **một JOIN_ROOM mới**, đúng tên, không có gửi trùng khi pending.
4. Trong khi OUT lỗi và JOIN chưa success, cảnh báo **Cần xác minh** hiện, bản nháp còn, composer không cho gửi. Sau JOIN success đúng event/tên/phòng, cảnh báo biến mất và nút gửi được mở; bản nháp không tự gửi.
5. Kiểm tra thêm lỗi trước gửi, OUT unknown/timeout, chủ phòng, reconnect, chuyển phòng/phiên và chủ động bấm Hủy. Nếu phản hồi JOIN vẫn bị server từ chối, **không ép khôi phục quyền gửi**.
6. Ghi minh chứng đã ẩn tên thật/mã phiên và review PR vào `develop`. Không tự đánh dấu hoàn thành Excel trước khi tích hợp thực tế đạt.
