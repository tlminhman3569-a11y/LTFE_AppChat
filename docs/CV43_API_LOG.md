# CV43 — Nhật ký kiểm thử API thật (đã che dữ liệu)

> Trạng thái: **chưa ghi nhận kết quả chạy thật trong môi trường bàn giao này**. Không có phiên đăng nhập/socket đang hoạt động hoặc tài khoản kiểm thử được cung cấp kèm source. Không tự điền response giả thành bằng chứng API thật.

## Cách ghi log

Chạy frontend với API thật, đăng nhập bằng tài khoản được phép, mở bộ lọc **Người dùng**, nhập username đầy đủ rồi bấm **Kiểm tra người dùng**. `usersApi.checkExists` sẽ ghi log metadata ở chế độ development. Username và response thô không được ghi.

Log được kỳ vọng khi máy chủ trả thành công:

```text
[CV43][API] {
  request: 'CHAT_CHECK_USER_EXIST',
  username: '[REDACTED]',
  responseEvent: 'CHECK_USER_EXIST',
  outcome: 'exists'
}
```

Ca username không tồn tại:

```text
[CV43][API] {
  request: 'CHAT_CHECK_USER_EXIST',
  username: '[REDACTED]',
  responseEvent: 'CHECK_USER_EXIST',
  outcome: 'not-found'
}
```

Đây là **định dạng log do frontend phát ra**, không phải log kết quả đã chạy. Chỉ chép hai khối này vào phần kết quả sau khi console thực tế hiển thị đúng.

## Ma trận chạy thật cần hoàn tất

| Ca | Dữ liệu nhập | Kết quả cần quan sát | Bằng chứng |
|---|---|---|---|
| Username tồn tại | Tài khoản kiểm thử được phép, đã che tên | `CHECK_USER_EXIST` trả true; sidebar chọn `{ kind: 'people', name: '[REDACTED]' }`; ChatPage gọi `GET_PEOPLE_CHAT_MES` qua `loadHistory` | Dán log console đã che + Network/WS frame đã xóa username, nội dung tin, token |
| Username không tồn tại | Username thử nghiệm không thuộc fixture, đã che | `CHECK_USER_EXIST` trả false; hiện thông báo không tìm thấy; không chọn chat và không gọi `GET_PEOPLE_CHAT_MES` | Dán log console đã che + WS frame đã xóa dữ liệu riêng |

## Kiểm tra luồng username ngoài fixture

1. Đảm bảo sidebar đang ở chế độ **API thật**, không chọn chế độ mock.
2. Chuyển bộ lọc sang **Người dùng** để hiển thị form kiểm tra username chính xác.
3. Nhập username ngoài danh sách `GET_USER_LIST` và xác nhận. Không dùng việc thiếu gợi ý làm kết luận không tồn tại.
4. Với tài khoản tồn tại: callback chọn `people` mở đúng cuộc trò chuyện; `ChatLayout` gọi `loadHistory`, và `chatApi.loadHistory` gửi `GET_PEOPLE_CHAT_MES` với `name` và `page: 1`. Đối chiếu tin trả về phải có cặp `name/to` thuộc đúng hai tài khoản.
5. Với tài khoản không tồn tại: không mở chat, không tải lịch sử.
6. Khi chia sẻ bằng chứng, che username ở cả request và response, token/code phiên, nội dung tin, thời gian/ID nếu có thể nhận diện người dùng.

**Lưu ý:** Không ghi `exists`/`not-found` nếu response API không parse được; khi timeout hoặc lỗi kết nối phải ghi `unknown`/`error`, không suy diễn kết quả.
