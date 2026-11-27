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

Service triển khai trong `services/uploadApi.ts` với chữ ký

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

Chỉ trả success khi URL HTTPS thuộc cloud của nhóm, resource_type là image, định dạng được phép, public_id không rỗng, bytes là số dương trong giới hạn và width/height là số dương. Kiểm tra response ở runtime, không chỉ ép kiểu TypeScript

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
- Parser ảnh kiểm tra version, type, id và metadata như hợp đồng upload; đọc dữ liệu lịch sử cũng dùng cùng parser. Kiểm tra URL bằng isCloudinaryImageUrl trong utils/imageUrl.ts, không dùng startsWith trên chuỗi thô
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


## Phần 2 — service upload

Đã có `uploadImage(file, signal?)` dùng Fetch của CV10. Service đọc hai biến VITE_CLOUDINARY trong env, kiểm tra file, gửi FormData và đổi phản hồi Cloudinary thành UploadedImage

- Thiếu cấu hình, file rỗng, quá 5 MiB hoặc MIME ngoài danh sách thì trả lỗi trước khi gọi Fetch
- FormData chỉ có file và upload_preset, không có mật khẩu hoặc mã phiên AppChat, không tự đặt Content-Type và không gửi cookie
- Chỉ trả success khi URL và metadata khớp hợp đồng ở trên
- Lỗi HTTP, mạng, JSON hoặc metadata sai đều trả lỗi, không tự upload lại
- Chuyển AbortSignal cho Fetch để hủy request hoặc việc đọc phản hồi, dùng cách phân loại lỗi của CV10. Phần tự hủy khi bỏ ảnh/logout/đổi tài khoản và bỏ kết quả tác vụ cũ vẫn thuộc CV58

### Chạy bằng phản hồi giả

Trong Terminal WebStorm, mở frontend

```powershell
npm test -- scripts/cv55-upload.test.ts
npm run build
npm run lint
```

Kỳ vọng 18 test đạt. Đây là Fetch giả, không tạo ảnh trên Cloudinary và không xác nhận tài khoản/preset thật đã hoạt động

### Thử Cloudinary thật

Điền cloud name và preset Unsigned của nhóm vào frontend/.env.local theo phần cấu hình phía trên. Nếu đang chạy dev server thì khởi động lại để đọc env mới

Chọn một ảnh JPEG/PNG/WebP thử nghiệm, không dùng ảnh riêng tư. Trong Terminal WebStorm tại frontend

```powershell
$env:APPCHAT_UPLOAD_FILE = 'C:\duong-dan\anh-thu.png'
try {
    npm test -- scripts/cv55-upload-live.test.ts
} finally {
    Remove-Item Env:APPCHAT_UPLOAD_FILE
}
```

Thay đường dẫn bằng ảnh thật trên máy. Test upload qua uploadImage rồi tải lại URL để kiểm tra HTTP thành công, Content-Type là ảnh và body có dữ liệu. Kỳ vọng 1 test đạt, có thể chụp terminal để đính kèm PR

Nếu không đặt APPCHAT_UPLOAD_FILE thì test tự bỏ qua; bỏ qua không tính là đã thử Cloudinary thật. Nếu thiếu cấu hình hoặc preset sai thì test báo lỗi, không chuyển sang dữ liệu mẫu

Mỗi lần chạy thật có thể lưu thêm một ảnh trong tài khoản. Test không tự xóa ảnh, nhóm có thể xem và xóa ảnh thử trong Cloudinary Media Library. Request được giới hạn thời gian, nhưng timeout hoặc hủy chưa chứng minh máy chủ chưa lưu ảnh

### Thử từ trình duyệt

Phần 2 chưa thêm nút chọn ảnh vào /chat. Khi CV56 nối composer, dùng cùng uploadImage và theo dõi Network: request POST tới Cloudinary có file/preset, success trả URL thì mới đóng gói tin qua WebSocket. Không coi test upload đơn lẻ là đã hoàn tất gửi/nhận ảnh trong chat

Đã thử Cloudinary thật ngày 24/11/2026: upload một ảnh PNG mẫu 32 × 32 qua uploadImage bằng preset của nhóm, nhận URL đúng cloud và tải lại được nội dung ảnh từ URL. Test thật đạt 1/1

Lượt phần 2 chạy bằng Vitest trong Node, chưa kiểm tra CORS trong trình duyệt, chưa gửi ảnh qua WebSocket hoặc hiển thị ảnh trong chat. Kết quả thử trình duyệt và ba định dạng thật nằm ở phần 3 bên dưới

Cấu hình nhóm đã điền ở frontend/.env.local, file này được Git bỏ qua. Máy khác cần tự điền cloud name/preset theo hướng dẫn, không lấy kết quả test skip làm bằng chứng upload thành công

Kết quả phần 2: 37/37 test giả, 1/1 test upload thật; toàn bộ bộ test khi không chọn ảnh có 134 ca đạt và 1 ca thật tự bỏ qua; build và lint đạt. Phần kiểm thử gửi–nhận ảnh và ảnh bằng chứng giao diện tiếp tục ở bước tích hợp


## Phần 3 — thử trên trình duyệt và bàn giao

Đã thử ngày 24/11/2026 bằng Chrome từ dev server Vite. Trang thử dùng đúng uploadImage, không thay Fetch hoặc phản hồi Cloudinary

| Trường hợp | Kết quả |
| --- | --- |
| Ảnh JPEG 80 × 60 | Một POST, upload thành công, trình duyệt đọc được response và tải được ảnh từ URL |
| Ảnh PNG 80 × 60 | Một POST, upload thành công, trình duyệt đọc được response và tải được ảnh từ URL |
| Ảnh WebP 80 × 60 | Một POST, upload thành công, trình duyệt đọc được response và tải được ảnh từ URL |
| File text | Trả lỗi validation, không có POST tới Cloudinary |
| Ảnh lớn hơn 5 MiB | Trả lỗi validation, không có POST tới Cloudinary |

CORS đã hoạt động cho lượt thử từ `http://127.0.0.1:5188`. Đây chưa phải kết quả cho domain triển khai sau này. Trang đăng nhập vẫn mở được, không có form upload thử trong giao diện sản phẩm

### Cách thử lại trên web

1. Điền hai cấu hình Cloudinary trong frontend/.env.local trên máy đang thử
2. Trong Terminal WebStorm tại frontend, chạy npm run dev
3. Mở `http://localhost:5173/scripts/check-upload.html`, nếu Vite báo cổng khác thì thay cổng tương ứng
4. Chọn ảnh JPEG/PNG/WebP nhỏ hơn 5 MiB, bấm Upload ảnh một lần
5. Chờ dòng Upload thành công, đã tải được ảnh từ URL, bên dưới có kết quả và ảnh thật tải từ Cloudinary
6. Mở DevTools Network, lọc upload: có một POST tới api.cloudinary.com cho lượt vừa bấm. Lúc đang upload nút và ô chọn file bị khóa
7. Thử một ảnh lớn hơn 5 MiB: hiện lỗi dung lượng và không có POST mới. Muốn đối chiếu các lỗi khác, chạy bộ Vitest giả ở phần 2

Đây là trang thử trong scripts, chỉ phục vụ kiểm tra service qua dev server. Không nằm trong menu hoặc route chat, không phải màn hình gửi ảnh của sản phẩm và không được đưa vào entry build chính. Trang không yêu cầu đăng nhập AppChat vì preset unsigned của Cloudinary hoạt động độc lập

Mỗi lần thử thành công có thể lưu thêm một ảnh. Ảnh xem trước trên trang này lấy từ URL Cloudinary trả về, không phải object URL cục bộ. Chưa có nút Gửi tin nhắn và không gọi SEND_CHAT

Bằng chứng để đính kèm PR: `CV55-upload-jpg.png`, `CV55-upload-png.png`, `CV55-upload-webp.png` và `CV55-chan-anh-qua-lon.png`

### Kiệt và Khôi tiếp tục từ đâu

- Kiệt dùng types/media.ts và uploadImage của CV55 cho CV56, giữ file/đích hội thoại tại lúc bắt đầu gửi. Chỉ serialize tin ảnh sau upload success, không coi upload success là tin đã lưu
- Khôi đối chiếu phương án trong CV51, thử quyền phòng khi nối đầy đủ, không dùng trang upload riêng này làm bằng chứng quyền gửi hoặc thành viên
- CV58 nối việc hủy và bỏ kết quả tác vụ cũ theo phiên. Caller phải chặn kết quả không còn thuộc file/tài khoản/hội thoại đang gửi
- Vòng SEND_CHAT → nhận tin → đọc lịch sử cho chat riêng/phòng vẫn phải kiểm tra sau khi CV56/CV60 được tích hợp

CV55 đã có hợp đồng, service upload và kết quả upload thật từ Node/trình duyệt. Chưa nghiệm thu toàn bộ tính năng gửi ảnh trong chat ở giai đoạn này


Bộ test upload đã gom 37 ca hiển thị thành 17 test theo hành vi, giữ các đầu vào và ca biên cũ. Lượt chạy sau khi viết lại: 17/17 upload giả, toàn bộ Vitest 114 đạt và 1 test thật bỏ qua khi không chọn ảnh. File test live giữ nguyên


### Cập nhật sau review CV55

URL upload và URL trong tin nhận/lịch sử phải dùng chung `isCloudinaryImageUrl(value, cloudName)` ở `utils/imageUrl.ts`. Hàm phân tích bằng new URL trước khi so khớp, vì trình duyệt có thể chuẩn hóa dấu .., %2e%2e hoặc gạch chéo ngược thành đường dẫn khác

- protocol là https, hostname đúng res.cloudinary.com
- Không có username/password hoặc cổng riêng; cổng HTTPS mặc định 443 được URL chuẩn hóa thành cổng trống
- pathname sau chuẩn hóa bắt đầu bằng /<cloudName>/image/upload/
- URL không phân tích được hoặc trỏ sang cloud khác thì từ chối, không đưa vào src ảnh

Giới hạn tin chữ/ảnh lấy từ `maxMessageBytes` trong types/message.ts. `maxImageMessageBytes` trong types/media.ts chỉ là tên export lại để giữ hợp đồng CV55, không khai báo thêm giá trị 1900. Giới hạn này vẫn là mức frontend chọn, chưa phải giới hạn máy chủ đã xác minh

Test sau review bổ sung URL đi qua .., %2e%2e, gạch chéo ngược, cổng riêng và cổng HTTPS mặc định. Bộ upload hiện có 18 test; các tình huống URL sai vẫn được gom theo hành vi


## CV58 phần 1 — quản lý lượt upload

Bộ quản lý nằm ở features/upload/uploadTask.ts, dùng lại uploadImage của CV55. Mỗi bộ giữ một lượt đang chạy, không lưu vào Redux hoặc storage

```ts
const upload = createUploadTask()
const res = await upload.start(file, conversation, sessionGeneration)
```

- Giữ lại file, loại/tên hội thoại và sessionGeneration lúc bắt đầu. Đổi đối tượng hội thoại bên ngoài không đổi đích đã chụp
- start tự hủy lượt trước của cùng bộ quản lý. Hai bộ quản lý riêng không hủy lẫn nhau
- cancel hủy lượt hiện tại, gọi lại khi không có lượt đang chạy thì không làm gì. Promise của start trả null khi lời gọi upload kết thúc, không phải ngay khi cancel được gọi. Hủy không bảo đảm ảnh chưa được Cloudinary lưu
- Lượt bị hủy hoặc bị thay thế trả null, kể cả khi service vẫn trả thành công hoặc ném lỗi đến muộn. Caller bỏ qua null, không dùng nó làm lỗi của ảnh mới
- Lượt hiện tại trả kết quả upload kèm conversation và sessionGeneration. Lỗi upload thông thường giữ nguyên kind/message và không tự thử lại
- Lỗi ngoài dự kiến được ném lại cho caller, controller vẫn được dọn. Lượt cũ kết thúc không dọn controller của lượt mới

Giữ một bộ quản lý trong vòng đời composer, không tạo lại mỗi lần gõ hoặc mỗi lần chọn ảnh. Khi cần dừng, gọi upload.cancel()

Ở phần 1, sessionGeneration chỉ là thông tin đi kèm, bộ quản lý chưa tự đọc phiên hiện tại hoặc quyền gửi. Phần 2 bên dưới bổ sung lớp quản lý theo phiên và nối vào đăng xuất. Thao tác bỏ ảnh và kiểm tra quyền gửi trên chat vẫn chờ giao diện CV56

### Chạy kiểm tra trong WebStorm

Mở Terminal tại frontend

```powershell
npm test -- scripts/cv58-upload-task.test.ts
```

Kỳ vọng 9 test đạt. Bộ test dùng uploadImage giả để điều khiển thứ tự trả lời, không gửi ảnh lên Cloudinary. Các ca gồm giữ đích/phiên, lỗi mạng, hủy, đổi lượt, phản hồi muộn, cleanup và hai bộ quản lý độc lập

Phần này chưa thêm thao tác trên giao diện chat. Trang scripts/check-upload.html vẫn chỉ thử service CV55; bằng chứng bỏ ảnh/logout khi đang upload cần kiểm tra sau khi ghép composer CV56


## CV58 phần 2 — hủy upload theo phiên

Dùng createSessionUploadTask ở features/upload/sessionUploadTask.ts khi nối giao diện chọn ảnh. Bộ này bọc createUploadTask của phần 1 và đọc phiên từ Redux

- Giữ phiên tại lúc tạo bộ quản lý, chụp đích khi gọi start(file, conversation). Trả kết quả như phần 1 hoặc null nếu đã hủy/đổi phiên
- cancel() dùng khi bỏ ảnh, đổi file hoặc đổi hội thoại, sau đó vẫn dùng bộ quản lý đó để upload ảnh khác
- dispose() dùng khi rời composer, bỏ đăng ký theo dõi Redux và đóng hẳn bộ quản lý. Gọi nhiều lần không gây lỗi
- Tạo bộ quản lý trong effect của composer theo sessionGeneration và dispose trong cleanup. Không tạo lại khi gõ chữ hoặc tạo subscription trong lúc render
- Đổi tài khoản, đăng nhập lại cùng username hoặc xóa/kiểm tra phiên đều hủy lượt đang chờ. Kết quả hoặc lỗi cũ đến muộn trả null
- endSession gọi cancelSessionUploads trước khi chờ LOGOUT. Cả bộ quản lý đã có và bộ mới tạo trong lúc chờ đều không được upload bằng phiên đang đăng xuất
- Chỉ đổi trạng thái socket hoặc nối lại cùng phiên không tự hủy request HTTP tới Cloudinary. Khi cần gửi tin sau đó vẫn phải chờ quyền gửi hợp lệ
- Hủy request không bảo đảm Cloudinary chưa lưu ảnh. Không tự upload lại, xóa ảnh trên cloud hoặc phát SEND_CHAT

### Phần chờ ghép CV56

Develop hiện chưa có giao diện chọn ảnh CV56, nên phần này chưa nối nút bỏ ảnh trên chat. Khi ghép, CV56 gọi cancel lúc bỏ/đổi ảnh hoặc chuyển hội thoại, bỏ qua kết quả null và dọn bằng dispose khi rời composer

Trước khi sử dụng URL hoặc gửi SEND_CHAT, caller phải kiểm tra file đang chọn, sessionGeneration, loại/tên hội thoại và quyền gửi hiện tại. Không đổi đích sang hội thoại vừa chọn, không gửi khi đã logout hoặc không còn quyền gửi phòng. Đây vẫn là bước ghép cần kiểm tra trên giao diện khi CV56 có code

### Kiểm tra trong WebStorm

Mở Terminal ở frontend rồi chạy

```powershell
npm test -- scripts/cv58-upload-task.test.ts scripts/cv58-session-upload.test.ts
npm run build
npm run lint
```

Kỳ vọng 21 test CV58 đạt, gồm 9 test quản lý lượt và 12 test theo phiên. Upload và LOGOUT trong bộ này được giả lập, không dùng tài khoản hoặc tải ảnh thật lên Cloudinary

Các ca mới kiểm tra đăng xuất khi LOGOUT còn chờ, chặn bộ quản lý tạo lại trong phiên cũ, đổi tài khoản, đăng nhập lại cùng username, lỗi trả muộn, hủy nhiều lượt, cleanup và nối lại socket cùng phiên

Chưa có cách thử bỏ ảnh trên giao diện chat ở phần này vì còn chờ CV56. Trang scripts/check-upload.html chỉ kiểm tra service CV55, không dùng làm bằng chứng cho vòng đời upload theo phiên
