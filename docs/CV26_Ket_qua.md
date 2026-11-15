# CV26 — Kết quả kiểm tra gửi và nhận tin

- Hai tài khoản thử đăng nhập trên hai WebSocket độc lập. Adapter gửi một tin chat riêng với `type: "people"` đến tài khoản thử còn lại.
- Phiên nhận nhận đúng nội dung và cặp người gửi/nhận. Sự kiện `SEND_CHAT` chứa `id`, `name`, `to`, `mes` và `type: 0`. Phản hồi trong lượt thử không có `createAt`.
- Phiên gửi không nhận được sự kiện xác nhận trong lượt thử, nên tin tạm vẫn ở trạng thái **Chưa xác nhận**.
- Lượt thử xác nhận đường truyền qua API cho chat riêng. Chat phòng chờ quyền thành viên từ CV45. Đồng bộ tin đến trong lúc mất mạng và thêm hội thoại mới vào sidebar là các điểm còn cần phối hợp.
