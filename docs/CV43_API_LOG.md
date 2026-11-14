# CV43 — Nhật ký kiểm thử API thật (đã che dữ liệu)

> **Kết quả tính đến 14/11/2026:** Đã sửa lỗi `checkExists` và xác nhận **69/69 kiểm tra tự động PASS** khi chạy trực tiếp bằng Node.js 22.16.0. **Chưa có bằng chứng thực thi hai ca trên WebSocket thật đã đăng nhập** trong môi trường bàn giao: ZIP không có phiên đang hoạt động hoặc thông tin đăng nhập kiểm thử được cấp. Không đánh đồng kết quả mock với kết quả API thật; không chép log ví dụ thành log đã quan sát.

## Bằng chứng kiểm tra mã nguồn đã chạy (14/11/2026)

Thư mục: `frontend/`. Lệnh sử dụng **không cần** cờ `--experimental-strip-types`:

```text
$ node scripts/check-cv43.mjs
...
69/69 checks passed
Node.js v22.16.0
Exit code: 0
```

Kết quả bổ sung: `node node_modules/typescript/bin/tsc -b` **PASS**; `node scripts/check-cv43-cv24-bridge.mjs` **18/18**; `node scripts/check-cv43-cv09-contract.mjs` **13/13**. Các phép thử này sử dụng response mô phỏng hoặc kiểm tra mã nguồn, **không chứng minh server thật trả `true/false`**.

## Kết quả API WebSocket thật (cần phiên đăng nhập được phép)

| Ca | Phản hồi API đã quan sát trong môi trường bàn giao | UI và lịch sử đã quan sát | Trạng thái |
|---|---|---|---|
| Username **tồn tại, ngoài fixture** | Chưa có phiên đủ quyền để ghi nhận `CHECK_USER_EXIST` | Chưa ghi nhận việc mở chat riêng và `GET_PEOPLE_CHAT_MES` trên trình duyệt thật | **CHƯA XÁC MINH** |
| Username **không tồn tại** | Chưa có phiên đủ quyền để ghi nhận `CHECK_USER_EXIST` | Chưa ghi nhận thông báo không tìm thấy và điều kiện không mở chat | **CHƯA XÁC MINH** |

Khi chạy trên máy có tài khoản kiểm thử, dùng **2 công cụ quan sát có sẵn** ở phần cuối tài liệu. Chúng xuất file log đã che, không tạo WebSocket thứ hai và không ghi token, username hay nội dung tin nhắn. Chỉ thay trạng thái trên bằng `PASS` khi file xuất ra thực sự có kết quả tương ứng.

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

## Thu log thực tế đã che để hoàn tất hai dòng trên

1. Từ `frontend/`, chạy `npm run dev`, đăng nhập bằng tài khoản thử **được phép**, xác nhận WebSocket là `connected`, chọn **API thật** trên `/chat`. Nếu kết nối chưa xác thực, không dùng fixture để kết luận.
2. Mở DevTools → **Sources → Snippets**, tạo snippet từ `frontend/scripts/cv43-live-check.js`. Nhập **hai** username kiểm thử khi được hỏi: một tên tồn tại (khác tài khoản đăng nhập), một tên chắc chắn không tồn tại. Script gửi `CHAT_CHECK_USER_EXIST` qua socket hiện tại, kiểm `CHECK_USER_EXIST`/`data.status`, tải trang 1 lịch sử người tồn tại và tải `CV43_API_LIVE_DA_CHE.txt`. **Yêu cầu:** hai ca `pass: true` và `GET_PEOPLE_CHAT_MES page=1` có `status: success` (mảng rỗng có thể hợp lệ).
3. Để **xác nhận UI thực sự mở đúng chat riêng cho username tồn tại ngoài fixture**, chạy snippet thứ hai từ `frontend/scripts/cv43-cv24-live-snippet.txt`. Sau khi khởi chạy snippet, chuyển sang bộ lọc **Người dùng**, nhập tên tồn tại nhưng không có trong `src/fixtures/users.ts`, bấm **Kiểm tra người dùng**. Đợi hoàn tất lịch sử và bấm **Xuất log đã che**. File `CV43_CV24_LICH_SU_NGOAI_FIXTURE_DA_CHE.txt` phải có `Username ngoai fixture: PASS`, `CHECK_USER_EXIST data.status=true: PASS`, `GET_PEOPLE_CHAT_MES trang 1 dung username: PASS`, `Chat rieng mo dung: PASS`, `Giao dien hien thi du lieu lich su: PASS`, `KET QUA: PASS`.
4. Trong trường hợp username không tồn tại, xác nhận trên UI thông báo **Không tìm thấy tài khoản với username này.**, không mở hội thoại mới và không tải lịch sử cho tên đó. Chụp/ghi lại trạng thái không chứa tên thật.
5. Chép **nguyên nội dung đã che** của hai file xuất từ phiên đã chạy, cùng ngày/giờ và mã commit, vào mục **Kết quả API WebSocket thật** ở trên. Chỉ sao chép metadata; không đính kèm request/response thô có username, mã phiên hoặc nội dung tin.

**Giới hạn:** Script Node 69/69 chỉ kiểm tra parser/service và hợp đồng giao diện với phản hồi mô phỏng. Kết quả UI + WebSocket phải được xác nhận riêng trên trình duyệt có tài khoản kiểm thử thật; hiện chưa đủ điều kiện kết luận CV43 đã nghiệm thu API thật.
