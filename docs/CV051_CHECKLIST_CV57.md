# CV51 → CV57 — Checklist gửi ảnh và quyền phòng

**Phụ trách kiểm thử:** Khôi (Trương Hoàng Minh Khôi). **Kiểm tra chéo:** Mẫn.  
**Nguồn hợp đồng:** `docs/MEDIA_DECISION.md` (CV55 PR #49), `docs/HOP_DONG.md`, Excel `Cong_viec` dòng 63/65/66.  
**Điều kiện bắt đầu CV57:** đã merge CV56, CV60 và CV62; đối chiếu CV58 khi thử hủy upload, logout và đổi phiên. Không chỉ dựa vào trang service `/scripts/check-upload.html`.

## 1. Chuẩn bị

- [ ] Checkout commit tích hợp mới trên `develop`, ghi SHA vào evidence; kiểm tra `npm run build` và `npm run lint`.
- [ ] Dùng **hai tài khoản đã được phép** A và B; hai trình duyệt/profile tách phiên. Không ghi mật khẩu, RE_LOGIN_CODE, token, cookie hay nội dung chat riêng vào evidence.
- [ ] Điền `VITE_CLOUDINARY_CLOUD_NAME` và `VITE_CLOUDINARY_UPLOAD_PRESET` trong `.env.local` của máy thử; bảo đảm preset unsigned chỉ cho JPEG/PNG/WebP và thư mục demo. Không commit file này.
- [ ] Tạo phòng P (A là chủ, B là thành viên); thêm phòng Q khác P; thử một người và một phòng **cùng tên** nếu môi trường cho phép; ghi rõ tên thử do mình tạo.
- [ ] Chạy `node --experimental-strip-types --test scripts/check-cv51.mjs` (máy có Node 22); chạy `node scripts/cv51-generate-size-fixtures.mjs` để sinh file biên dung lượng. Chỉ dùng ảnh thử, không có dữ liệu nhạy cảm.
- [ ] Mở DevTools Network (lọc `api.cloudinary.com`) và log WebSocket (lọc `SEND_CHAT`, `GET_ROOM_CHAT_MES`). Che mọi bí mật trước khi chụp/chia sẻ.

## 2. Ma trận kiểm thử ảnh và metadata

Mỗi dòng khởi đầu **Chưa chạy**. Kết quả phải dựa trên lần thực hiện, không dựa trên ảnh minh họa hoặc dữ liệu JSON mẫu.

| Mã | Thao tác | Kỳ vọng | Trạng thái |
| --- | --- | --- | --- |
| IMG01 | Người A chọn `valid-jpeg.jpg` gửi chat riêng B | Xem trước đúng; 1 POST upload hợp lệ; `SEND_CHAT` type `people`, `to=B` và `mes` prefix `APPCHAT_IMAGE_V1` | Chưa chạy |
| IMG02 | Chọn `valid-png.png` gửi phòng P từ A | `type=room`, `to=P`; đúng quyền chủ, không gửi vào chat riêng cùng tên | Chưa chạy |
| IMG03 | B chọn `valid-webp.webp` gửi phòng P | Đúng quyền thành viên; A nhận được ảnh; không tự tạo trạng thái Đã đọc | Chưa chạy |
| IMG04 | Kiểm tra metadata từ response Cloudinary | `secure_url`, `public_id`, `format`, `bytes`, `width`, `height` ánh xạ đúng `UploadedImage`; URL thuộc cloud thật | Chưa chạy |
| IMG05 | Reload tab / đăng nhập lại, đọc lịch sử riêng và phòng | Chuỗi tin ảnh giữ đúng `clientMessageId`, người gửi, đích; URL đọc được trong `MessageBubble` | Chưa chạy |
| IMG06 | File `empty.jpg`, `not-image.txt` | Chặn validation và **không** POST upload | Chưa chạy |
| IMG07 | File `fake-jpeg.jpg` (nội dung text, đuôi `.jpg`) | Client có thể nhận MIME theo đuôi; Cloudinary **phải từ chối nội dung giả**, UI báo lỗi, không SEND_CHAT | Chưa chạy |
| IMG08 | `generated/invalid-over-5MiB.png` | Chặn >5 MiB từ client; không POST upload, không SEND_CHAT | Chưa chạy |
| IMG09 | `generated/valid-exactly-5MiB.png` | Không bị chặn bởi kiểm tra **dung lượng client**; nếu Cloudinary từ chối/biến đổi do cấu hình phải ghi phản hồi thực tế | Chưa chạy |
| IMG10 | URL sai cloud, HTTP, cổng riêng, `..`, `%2e%2e`, `blob:`, `data:` | Parser/display không tự render URL bị từ chối; thông báo ảnh lỗi an toàn | Chưa chạy |
| IMG11 | Upload lỗi 400/timeout/mất mạng sau POST | Có lỗi rõ, giữ nháp ảnh; không tự POST lại hoặc tự gửi `SEND_CHAT` | Chưa chạy |
| IMG12 | Xóa ảnh trước khi ấn Gửi | Object URL preview được thu hồi; không tạo tin chat; không gửi URL blob/file địa phương | Chưa chạy |
| IMG13 | Gửi hai ảnh cùng nội dung ở hai lần bấm riêng | Hai `clientMessageId` độc lập; không gộp chỉ vì ảnh/text giống nhau | Chưa chạy |
| IMG14 | Mở ảnh từ lịch sử khi URL hỏng hoặc ảnh đã bị gỡ | Không crash, hiện trạng thái lỗi/tải lại, không thực thi HTML | Chưa chạy |

## 3. Ma trận quyền phòng

| Mã | Trạng thái / thao tác | Kỳ vọng | Trạng thái |
| --- | --- | --- | --- |
| ROOM01 | A chủ phòng, B thành viên, cả hai online và quyền đã xác nhận | Cả hai có thể chọn/gửi ảnh; chỉ 1 gửi cho mỗi xác nhận | Chưa chạy |
| ROOM02 | Chỉ có phòng trong `GET_USER_LIST` gần đây, membership `unknown` | Không cho gửi ảnh, không coi gần đây là chứng cứ quyền phòng | Chưa chạy |
| ROOM03 | B bấm Rời phòng rồi **Hủy** khi đang có ảnh nháp | Không gửi `OUT_ROOM`; giữ nguyên ảnh nháp và quyền ban đầu | Chưa chạy |
| ROOM04 | B xác nhận `OUT_ROOM`, request đang chờ | Ngay lập tức khóa gửi ảnh, không dùng quyền cũ để gửi trong lúc pending | Chưa chạy |
| ROOM05 | `OUT_ROOM` success từ B | Phòng chuyển `left`, khóa gửi ảnh, không mất dữ liệu phòng khỏi server | Chưa chạy |
| ROOM06 | `OUT_ROOM` timeout hoặc response không xác định | Hiện trạng thái chưa chắc, khóa gửi và **không tự OUT/JOIN** lại | Chưa chạy |
| ROOM07 | B mở form JOIN nhưng chưa xác nhận / JOIN đang pending | Không gửi ảnh; không tự JOIN chỉ vì chọn phòng | Chưa chạy |
| ROOM08 | B `JOIN_ROOM` success đúng P | Mở quyền gửi ảnh **sau** success; không tự gửi lại ảnh/tin cũ | Chưa chạy |
| ROOM09 | A là chủ, thử nút Rời | Chặn rời đúng lý do, không tự xóa phòng và không suy quyền sai | Chưa chạy |
| ROOM10 | Đang upload ảnh cho P, chuyển sang Q hoặc chat người cùng tên | Không gửi nhầm đích; nếu tác vụ cũ hoàn tất phải kiểm tra session, quyền và hội thoại trước `SEND_CHAT` | Chưa chạy |
| ROOM11 | Logout, hết phiên, offline/reconnect khi có upload ảnh | Khóa gửi, không tự gửi lại, kết quả upload phiên cũ không ghi đè phiên mới | Chưa chạy |
| ROOM12 | Phòng và người cùng tên | `ConversationKey` khác nhau theo `kind`, nháp/ảnh/tin không lẫn | Chưa chạy |

**Dữ liệu máy đọc được:** `frontend/scripts/cv51-fixtures/room-rights-cases.json` liệt kê 12 tình huống nền. Danh sách trên bổ sung điều kiện chạy UI/API với hai tài khoản. Chưa có log thực tế không được đổi ô “Chưa chạy”.

## 4. Bằng chứng cần ghi cho từng ca

Dùng bảng ngắn kèm theo từng lần thử (hoặc issue/PR), không cần đưa ảnh nhạy cảm:

```text
Mã ca: IMGxx / ROOMxx
Ngày giờ, múi giờ: ...
Commit develop / nhánh: ...
Trình duyệt A / trình duyệt B: ...
Tên phòng / đích (dữ liệu test): ...
File thử + số byte: ...
Lệnh hoặc thao tác trên UI: ...
Request upload: số POST, HTTP status (KHÔNG ghi preset/mật khẩu/token)
WS event: loại lệnh, type, to, clientMessageId rút gọn
Ảnh chụp UI / log đã che bí mật: ...
Kết quả thực tế: Đạt / Không đạt / Chưa chạy / Bị chặn bởi phụ thuộc
Người xác nhận: ...
```

Với log WebSocket, chỉ lấy trường cần thiết; không đưa toàn bộ tin riêng hoặc phiên của người dùng khác vào PR. Để đối chiếu lịch sử, chụp `clientMessageId`, `to`, `type`, tên người gửi và trạng thái sau reload (đã che phần riêng tư). Lưu evidence dưới `docs/evidence/cv57/` khi **thực sự có kết quả**, không tạo ảnh chứng minh giả từ fixture.

## 5. Giao lỗi đúng người và điều kiện nghiệm thu

- **Mẫn (CV55/CV58/CV59):** uploadApi, URL/metadata từ Cloudinary, lỗi Fetch, abort/cleanup theo phiên.
- **Kiệt (CV56/CV60/CV61):** chọn/preview, serializer/parser, MessageBubble, tin tạm và lịch sử ảnh.
- **Khôi (CV62/CV63):** membership owner/member/unknown/left, pending/timeout OUT/JOIN, sidebar/phòng và khóa gửi ảnh.

CV57 chỉ đánh dấu **Đã kiểm tra** khi có đủ bằng chứng API/UI của hai tài khoản cho luồng ảnh riêng/phòng, lỗi file/upload, chuyển hội thoại, rời/JOIN lại và reload. Nếu thiếu một dependency, ghi **Bị chặn**, không ghi Đạt. Không đưa API secret hoặc đường dẫn ảnh riêng tư lên GitHub.
