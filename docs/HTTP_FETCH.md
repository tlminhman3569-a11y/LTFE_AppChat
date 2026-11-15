# CV10 — Fetch wrapper

`fetchJson<T>(url, options?)` trong `frontend/src/services/apiClient.ts` dùng cho tài nguyên HTTP trả JSON. Truyền các tùy chọn Fetch qua `options`. Để hủy, truyền `{ signal: controller.signal }` và gọi `controller.abort()` khi không còn cần kết quả

| Kết quả | Ý nghĩa |
| --- | --- |
| `status: 'success'` | HTTP thành công và đọc được JSON |
| `error.kind: 'http'` | `response.ok` là false. Kết quả có `statusCode` và bỏ qua bước đọc JSON |
| `error.kind: 'network'` | Gửi yêu cầu hoặc đọc nội dung phản hồi bị lỗi |
| `error.kind: 'parse'` | Phản hồi HTTP thành công nhưng nội dung không phải JSON hợp lệ, gồm cả phản hồi rỗng như HTTP 204 |
| `error.kind: 'aborted'` | Yêu cầu bị hủy khi đang chờ phản hồi hoặc đang đọc nội dung |

`T` là kiểu TypeScript do bên gọi khai báo. Bên gọi cần kiểm tra cấu trúc dữ liệu thực tế trước khi dùng

Chưa xác minh được endpoint HTTP nghiệp vụ. CV10 bàn giao wrapper và bộ test dùng Fetch giả. Đăng nhập, danh sách hội thoại, lịch sử và thao tác phòng tiếp tục dùng WebSocket của thầy

## Chạy thử trong WebStorm

Mở Terminal tại `frontend` và chạy:

```powershell
npm test -- scripts/cv10-fetch.test.ts
```

Bộ test dùng Fetch giả để kiểm tra JSON, lỗi HTTP, lỗi mạng, JSON sai và hủy yêu cầu. Kết quả kỳ vọng là **6 tests passed**
