# CV43 × CV09 × CV24: Sửa sau review, giữ code nhóm

## Vấn đề cần giải quyết

- Khi lấy `develop` vào `feat/khoi/cv43`, `ChatLayout.tsx` phải giữ nút **Thử kết nối lại** và prop `reconnectCount` của **CV09 (Trần Lê Minh Mẫn)**.
- Giữ bộ chọn API thật/mock của CV43. Khi dùng API thật với chat riêng, `ChatLayout` phải gọi adapter `chatApi.loadHistory(conversation, page, currentUser)` của **CV24 (Cao Tuấn Kiệt)** thay vì `mockChatService`. Mock chỉ còn áp dụng khi chủ động chọn dữ liệu mẫu hoặc lịch sử phòng chưa xong CV45.
- Sau ba lần tự kết nối thất bại phải còn nút thử thủ công. Chỉ khi `RE_LOGIN` thành công mới phát tín hiệu tăng `reconnectCount`; từ đó `ChatHistory` đang mở tải lại bằng API. Nháp vẫn nằm ở `ChatLayout/useChatDrafts` và `Composer` không bị remount chỉ vì reconnect.
- Khóa `ChatHistory` có thể là `JSON.stringify([sessionGeneration, reconnectCount, conversationKey])` hoặc cú pháp tương đương. Script không được bắt buộc thứ tự hai phần tử như bản CV43 cũ.

## Vì sao không chép nguyên ChatLayout cũ lên develop

Bản mã nguồn đã cung cấp trước đó (13/11/2026) **chưa chứa phần CV09 mới**. Ghi đè `ChatLayout.tsx` bằng ZIP CV43 cũ sẽ lại làm mất nút thử lại và tín hiệu tải lịch sử sau khôi phục. Vì vậy, `merge-cv43-keep-cv09.mjs` lấy **bản hiện tại trên `origin/develop` của chính repo bạn**, giữ logic CV09 ở đó và ghép phần CV43/CV24 vào. Công cụ mặc định **chỉ tạo bản xem trước, không ghi đè file**.

## Bước thực hiện trong WebStorm (Node.js v26.11.1)

Mở Terminal từ thư mục gốc dự án:

```powershell
cd D:\LTFE_AppChat
git switch feat/khoi/cv43
git fetch origin
node -v
node frontend/scripts/merge-cv43-keep-cv09.mjs
```

Mở `docs/CV43_ChatLayout_CV09_preview.txt` trong WebStorm, so sánh với `frontend/src/components/ChatLayout.tsx`. Kiểm tra phần retry của Mẫn, các trạng thái khác của nhóm, nút thử lại và đoạn adapter CV24. Công cụ **không bảo đảm tự bảo tồn mọi thay đổi khác chưa merge trên CV43**, vì thế cần xem diff trước khi áp dụng.

Khi đã đối chiếu và thống nhất bản xem trước:

```powershell
node frontend/scripts/merge-cv43-keep-cv09.mjs --apply
git diff -- frontend/src/components/ChatLayout.tsx
```

`--apply` tạo bản sao `CV43_ChatLayout_truoc_khoi_phuc.txt` ở thư mục gốc trước khi thay file. **Không commit file sao lưu và file preview.** Nếu không tìm thấy nút **Thử kết nối lại** hay biến `reconnectCount` trong `origin/develop`, script dừng và không ghi đè. Khi đó cần Mẫn cung cấp/merge đúng code CV09 trước khi ghép.

Phải kiểm tra `frontend/src/features/chat/ChatPage.tsx` trên nhánh hiện tại đã nhận `reconnectCount` và dùng nó trong khóa `ChatHistory`. Nếu ChatPage chưa có thì cần phối hợp Kiệt/Mẫn ghép phần CV09, không tự thay bằng bản từ ZIP CV43 cũ.

## Chạy kiểm tra

```powershell
cd D:\LTFE_AppChat
node frontend/scripts/check-cv43-cv24-bridge.mjs
node --experimental-strip-types frontend/scripts/check-cv43.mjs
node --experimental-strip-types frontend/scripts/check-cv42.mjs
cd frontend
npm run build
npm run lint
```

Kết quả trên **bản mã nguồn 13/11/2026 trong môi trường kiểm tra Node v22.16.0**:

| Bộ kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| CV43 | 69/69 PASS | Mã nguồn cũ, chưa xác minh trên Node 26 |
| CV42 | 52/52 PASS | Mã nguồn cũ, chưa xác minh trên Node 26 |
| CV43 × CV24 | 16 PASS, CV09 SKIP | Bản cũ chưa có `reconnectCount` |
| CV43 × CV24 trên fixture CV09 mô phỏng | 17 PASS | **Chỉ mô phỏng hình dạng props/key**, không chứng minh reconnect thật |

**Chưa có kết quả build/lint của bản đã ghép trên máy người dùng** và **chưa chạy được server thật trong môi trường này**. Không sao chép kết quả mô phỏng thành PASS API thật.

## Bằng chứng bắt buộc từ API thật

Khởi động app bằng `npm run dev` và đăng nhập tài khoản thử được phép. Mở `/chat`, chọn **API thật**, dùng Chrome/Edge DevTools → Sources → Snippets. Chạy từng file:

1. `frontend/scripts/cv43-live-check.js`: nhập một username thực sự tồn tại và một username thật sự không tồn tại. Script gọi `CHAT_CHECK_USER_EXIST`, ghi kết quả parser và mẫu phản hồi **đã che** (`data.status=true/false`). Tải file **`CV43_API_LIVE_DA_CHE.txt`**.
2. `frontend/scripts/cv43-cv24-live-snippet.txt`: chạy trước khi thao tác tra cứu người dùng. Nhập một username **tồn tại trên server nhưng không có trong fixture**, nhấn **Kiểm tra người dùng**, chờ mở chat riêng và tải lịch sử. Xuất **`CV43_CV24_LICH_SU_NGOAI_FIXTURE_DA_CHE.txt`**.
3. `frontend/scripts/cv43-cv09-reconnect-live-snippet.txt`: mở chat riêng có nội dung nháp chưa gửi, bật snippet để theo dõi. Ngắt mạng, chờ chu kỳ **3 lần thử tự động thất bại**, nhấn **Ghi nhận nút thử lại** khi thấy nút **Thử kết nối lại**. Bật mạng lại rồi nhấn nút thử; sau `RE_LOGIN` thành công, chờ lịch sử tải xong. Xuất **`CV43_CV09_RECONNECT_DA_CHE.txt`**. Công cụ theo dõi API nhưng **không đếm chính xác các lần thất bại khi chưa mở được WebSocket**, nên cần đối chiếu số lần retry trên giao diện/log CV09.

Các snippet không tạo WebSocket thứ hai và không gửi lại tin nhắn. Log chỉ có tên lệnh, trạng thái, số tin và kết quả UI, không chứa username, mật khẩu, mã phiên, token, nội dung tin hoặc bản nháp. Các tập tin log **chỉ xuất hiện sau khi chính người kiểm thử chạy API thật**, không nằm sẵn trong ZIP.

## Trạng thái và phân công ghi vào PR

| Hạng mục | Phụ trách | Trạng thái |
|---|---|---|
| `CHECK_USER_EXIST`, mở chat riêng, kiểm thử ngoài fixture | **Trương Hoàng Minh Khôi, CV43** | Mã nguồn/kiểm tra có; cần thêm log server thật |
| `GET_PEOPLE_CHAT_MES`, lọc theo `currentUser`, khôi phục lịch sử | **Cao Tuấn Kiệt, CV24** | Cần Kiệt xác nhận trên server thật |
| Thử lại thủ công, giới hạn 3 lần, `RE_LOGIN`, tăng `reconnectCount` | **Trần Lê Minh Mẫn, CV09** | Phải giữ từ `develop`; kiểm tra lại toàn luồng sau merge |
| Lịch sử phòng thật | **Trương Hoàng Minh Khôi, CV45**; Kiệt phối hợp phần UI | Ngoài phạm vi CV43 |

**Chưa có các log API thật thì ghi `CHƯA XÁC NHẬN`, không ghi PASS.** Khi đạt, đính kèm đủ ba log đã che và kết quả Node v26.11.1/build/lint vào PR.

## Chỉ up những file nào

Sau khi tạo và chấp nhận bản ChatLayout đã ghép:

```powershell
cd D:\LTFE_AppChat
git add frontend/src/components/ChatLayout.tsx
git add frontend/scripts/merge-cv43-keep-cv09.mjs
git add frontend/scripts/check-cv43-cv24-bridge.mjs
git add frontend/scripts/cv43-cv09-reconnect-live-snippet.txt
git add docs/CV043_REVIEW_CV09_CV24.md
git status
git commit -m "Restore CV09 reconnect and CV24 history in CV43"
git push origin feat/khoi/cv43
```

`cv43-live-check.js` và `cv43-cv24-live-snippet.txt` chỉ cần up lại nếu trước đó chưa có trên nhánh. Không up file preview hoặc backup. Nếu có log thật đã che, có thể đính kèm vào PR thay vì commit vào repo.
