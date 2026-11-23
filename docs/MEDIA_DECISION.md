# Gửi ảnh — CV55

## Phương án nhóm dùng

Dùng Cloudinary để lưu ảnh, dùng WebSocket của thầy để gửi URL ảnh cho người hoặc phòng

Luồng: chọn ảnh → xem trước → xác nhận gửi → Fetch upload → lấy URL → đóng gói vào `mes` → SEND_CHAT → đối chiếu tin nhận/lịch sử

API hiện có nhận `mes` dạng chuỗi, chưa có endpoint gửi file ảnh trong tài liệu nhóm nhận được. Định dạng bên dưới là quy ước của frontend, không phải event mới của máy chủ

Phần 1 chốt hợp đồng và dữ liệu mẫu. Chưa gọi upload thật, chưa nối composer hay xác nhận máy chủ giữ nguyên chuỗi tin ảnh khi gửi và đọc lịch sử

## Chuẩn bị Cloudinary

1. Tạo tài khoản của nhóm và mở phần Upload presets trong Console
2. Tạo preset Unsigned, chỉ cho phép `jpg`, `jpeg`, `png`, `webp`, bật `disallow_public_id` và giữ chế độ sinh tên duy nhất để tránh ghi đè
3. Đặt thư mục lưu ảnh thử trong preset theo chế độ folder của tài khoản, không lấy thư mục từ người gửi
4. Sao chép `frontend/.env.example` thành `frontend/.env.local`, điền cloud name và preset name rồi khởi động lại dev server

```dotenv
VITE_CLOUDINARY_CLOUD_NAME=ten_cloud_cua_nhom
VITE_CLOUDINARY_UPLOAD_PRESET=ten_preset_cua_nhom
```

Đây là hai giá trị công khai, mọi biến `VITE_` đều có thể xuất hiện trong bản frontend. Không thêm API secret, mật khẩu hoặc chữ ký bí mật vào frontend hay Git

Preset unsigned cho phép upload không cần đăng nhập AppChat. Dùng cho bản demo, theo dõi dung lượng và tắt preset sau khi kết thúc thử nghiệm. URL ảnh là công khai, ai có URL có thể xem; không dùng ảnh riêng tư

Theo tài liệu Cloudinary, preset không có giới hạn dung lượng riêng cho từng preset. Mức 5 MiB bên dưới do frontend kiểm tra, không phải rào chắn phía máy chủ. Nếu cần xác thực tài khoản và áp dụng giới hạn bắt buộc phía máy chủ thì phải bổ sung backend ký upload

Nguồn cấu hình: [Upload presets](https://cloudinary.com/documentation/upload_presets), [Client-side uploading](https://cloudinary.com/documentation/client_side_uploading)

## File được chọn

- Mỗi tin một ảnh, chưa có chú thích, nhiều ảnh hoặc video
- JPEG, PNG hoặc WebP, dung lượng lớn hơn 0 và tối đa 5 MiB (5 × 1024 × 1024 byte)
- Frontend kiểm tra MIME và dung lượng trước upload; Cloudinary kiểm tra định dạng thực tế theo preset, không chỉ dựa vào đuôi tên file
- Không đổi định dạng hoặc resize trong preset ở giai đoạn này để tránh nhầm metadata ảnh gốc và ảnh lưu
- Preview dùng object URL cục bộ và phải được thu hồi khi bỏ ảnh/tháo component. Không gửi `blob:`, `data:`, đường dẫn máy hay base64 vào chat
- Người dùng vẫn phải có phiên hợp lệ, đúng hội thoại và quyền gửi trước upload, kiểm tra lại trước SEND_CHAT

## Hợp đồng upload cho CV56

Phần 2 triển khai trong `services/uploadApi.ts` với chữ ký

```ts
uploadImage(file: File, signal?: AbortSignal): Promise<UploadResult>
```

Kiểu dùng chung nằm ở `src/types/media.ts`, mẫu nằm ở `src/fixtures/imageMessages.ts`

Request: `POST https://api.cloudinary.com/v1_1/{cloudName}/image/upload`, body là FormData gồm `file` và `upload_preset`. Dùng `fetchJson` của CV10, không tự đặt Content-Type cho FormData, không gửi thông tin đăng nhập AppChat sang Cloudinary

Các trường cần đọc trong response Cloudinary

```json
{
  "secure_url": "https://res.cloudinary.com/<cloud-name>/image/upload/v123/appchat/anh-thu.jpg",
  "public_id": "appchat/anh-thu",
  "resource_type": "image",
  "format": "jpg",
  "bytes": 125000,
  "width": 800,
  "height": 600
}
```

Đây là mẫu cấu trúc, không phải log API thật. Adapter đổi `secure_url` thành `url`, `public_id` thành `publicId`, map `jpg`/`jpeg` sang `image/jpeg`, `png` sang `image/png`, `webp` sang `image/webp`

Chỉ trả success khi URL HTTPS thuộc cloud của nhóm, resource_type là image, định dạng được phép, public_id không rỗng, bytes là số nguyên trong giới hạn và width/height là số nguyên dương. Kiểm tra response ở runtime, không chỉ ép kiểu TypeScript

Kết quả frontend

```ts
{ status: 'success', data: UploadedImage }
{ status: 'error', error: { kind, message, statusCode? } }
```

`kind` gồm config, validation, http, network, parse và aborted. Config thiếu thì không gọi Fetch. Lỗi mạng chưa chứng minh ảnh chưa được lưu, không tự upload lại. Bỏ ảnh hoặc logout không đồng nghĩa đã xóa ảnh trên Cloudinary; việc xóa do người quản lý tài khoản xử lý, không đưa khóa xóa lên frontend

## Dạng tin ảnh qua WebSocket

Giữ nguyên SEND_CHAT với `type: people/room`, `to` và chuỗi `mes`. Ví dụ đích chat riêng

```json
{
  "action": "onchat",
  "data": {
    "event": "SEND_CHAT",
    "data": {
      "type": "people",
      "to": "ban_thu",
      "mes": "APPCHAT_IMAGE_V1{\"version\":1,\"type\":\"image\",\"clientMessageId\":\"55aabbcc00112233445566778899aabbcc\",\"image\":{\"url\":\"https://images.example.com/appchat/anh-thu.jpg\",\"publicId\":\"appchat/anh-thu\",\"mimeType\":\"image/jpeg\",\"bytes\":125000,\"width\":800,\"height\":600}}"
    }
  }
}
```

URL `images.example.com` trong mẫu chỉ để đối chiếu cấu trúc, không dùng làm ảnh tải thật hoặc nới kiểm tra URL production. Muốn dựng preview, Kiệt dùng ảnh thử cục bộ và tách rõ khỏi kết quả upload

- `APPCHAT_IMAGE_V1` + JSON của `ImageMessageContent`, không có dấu phân cách khác giữa prefix và JSON
- Chat phòng dùng `type: room` và đúng tên phòng, không lấy tên hội thoại đang mở sau khi upload xong để thay đích đã chụp lúc gửi
- Tạo clientMessageId một lần cho tác vụ gửi, giữ lại khi đối chiếu hoặc người dùng thử lại cùng tin; giữ nguyên phân biệt người/phòng trong khóa hội thoại
- 1.900 byte UTF-8 là mức giới hạn frontend chọn cho tin ảnh để thống nhất với tin chữ hiện có, chưa phải giới hạn máy chủ đã xác minh. Tính cả prefix và JSON bằng TextEncoder, báo lỗi nếu vượt, không cắt URL
- Giữ `APPCHAT_RICH_V1` cho tin chữ, không đổi RichMessageContent hoặc gửi ảnh vào trường runs
- Parser ảnh kiểm tra version, type, id và toàn bộ metadata như hợp đồng upload, URL chỉ nhận HTTPS từ cloud của nhóm; đọc dữ liệu lịch sử cũng dùng cùng parser
- Chuỗi có prefix ảnh nhưng sai dữ liệu thì báo tin ảnh không hợp lệ, không render HTML hoặc tự tải URL chưa được kiểm tra
- Upload success chỉ nghĩa đã có ảnh trên storage. Tin chỉ Đã lưu khi đối chiếu được đúng clientMessageId, tác giả và hội thoại từ SEND_CHAT/lịch sử; không tự thêm nhãn Đã đọc hoặc Đã giao
- Trước khi bật gửi ảnh cho nhóm, phải thử URL thật qua SEND_CHAT ở chat riêng và phòng rồi đọc lại lịch sử, xác nhận payload không bị đổi hoặc cắt

## Chia phần ghép code

| CV | Người làm | Bàn giao |
| --- | --- | --- |
| CV55 | Mẫn | Quy ước này, types/mẫu, uploadImage và kiểm tra upload thật |
| CV56 | Kiệt | Chọn/xem trước/bỏ ảnh, parser/serializer, nhận URL từ uploadImage rồi gửi đúng đích |
| CV58 | Mẫn | Nối hủy upload và cleanup theo phiên, chặn kết quả phiên cũ |
| CV60 | Kiệt | Hiển thị ảnh nhận/lịch sử, ảnh lỗi và hành vi xem ảnh |
| CV51 | Khôi | Đối chiếu hợp đồng, bộ ảnh thử và ca quyền phòng, không chặn CV55 bắt đầu |

CV56 có thể dựng UI bằng mẫu trong lúc chờ uploadImage. Trước khi CV58 hoàn tất không coi luồng bỏ ảnh/đổi tài khoản/logout lúc upload đang chờ là đã nghiệm thu

## Cách kiểm tra phần 1

Trong Terminal WebStorm, mở `frontend`

```powershell
npm run build
npm run lint
```

Build kiểm tra types và dữ liệu mẫu khớp nhau, lint kiểm tra các file TypeScript mới. Phần 1 chưa có nút chọn ảnh trên web, chưa có test upload hoặc log upload thật; các phần đó làm ở bước sau
