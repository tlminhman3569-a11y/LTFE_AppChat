# CV06 — Thử API thầy ngày 11/11/2026

- WebSocket `wss://chat.longapp.io.vn/chat/chat`
- `LOGIN` thành công, có mã `RE_LOGIN_CODE`
- `GET_USER_LIST` thành công trên cùng socket. Lượt thử ban đầu nhận 3 phòng (`type: 1`)
- Mô tả PR ghi một lượt thử khác nhận 15 mục. Số mục tùy lịch sử hội thoại của tài khoản
- Theo tài liệu dự án, `type: 0` là người dùng. Lượt thử chưa có mẫu loại này và chưa xác minh múi giờ `actionTime`

## Chạy lại trong WebStorm

Mở dự án, chọn **Terminal** và dùng PowerShell. Từ thư mục gốc repo, chạy đoạn sau với Node.js 26 rồi nhập tài khoản thử khi được hỏi

```powershell
cd frontend
$account = Get-Credential -Message 'Nhập tài khoản thử API App Chat'
if ($account) {
    $env:APPCHAT_PROBE_USER = $account.UserName
    $env:APPCHAT_PROBE_PASS = $account.GetNetworkCredential().Password
    try {
        node scripts/check-api.mjs
    } finally {
        Remove-Item Env:APPCHAT_PROBE_USER, Env:APPCHAT_PROBE_PASS
    }
}
```

- Nhập đúng tài khoản thử được cấp thì script in `PASS: LOGIN and GET_USER_LIST (<số mục> entries)`
- Nhập sai thông tin thì script in `FAIL`. Lỗi kết nối hoặc phản hồi sai cấu trúc cũng trả `FAIL`
- Số mục tùy lịch sử hội thoại. Có thể chụp dòng lệnh và dòng `PASS` trong terminal để gửi nhóm

Để thử đăng nhập lại sau lỗi và timeout bằng socket giả, chạy trong thư mục `frontend`

```powershell
node scripts/check-login-retry.mjs
```

Kết quả cần thấy là hai dòng `PASS`. Lượt kiểm tra lại ngày 12/11/2026 nhận 17 mục từ API thật

## Mẫu request và response đã che dữ liệu

`LOGIN`

```json
{"action":"onchat","data":{"event":"LOGIN","data":{"user":"<tai-khoan-thu>","pass":"<da-che>"}}}
```

```json
{"status":"success","event":"LOGIN","data":{"RE_LOGIN_CODE":"<da-che>"}}
```

`GET_USER_LIST`

```json
{"action":"onchat","data":{"event":"GET_USER_LIST","data":{}}}
```

```json
{"event":"GET_USER_LIST","status":"success","data":[{"name":"phong_mau","type":1,"actionTime":"<chuoi-thoi-gian>"}]}
```

## Ghép vào phần của Kiệt và Khôi

- Dùng `login(username, password)` từ `authApi.ts` để mở socket và đăng nhập. CV07 sẽ nối vào form
- Sau khi đăng nhập, Khôi gọi `socketClient.request('GET_USER_LIST', {})` trong CV42. Kiểm tra `status`, `data` và từng mục trước khi cập nhật danh sách. Nếu tải lại lỗi thì giữ danh sách đang hiển thị
- Kiệt dùng cùng `socketClient` để đọc lịch sử chat riêng, dùng `roomsApi.loadRoom` để đọc phòng và xử lý `SEND_CHAT` theo `HOP_DONG.md`
- Bắt lỗi khi `request` reject. Với tác vụ ghi đã gửi mà mất phản hồi, giữ kết quả ở trạng thái chưa xác định. `wasSent` cho biết client đã gọi `WebSocket.send` thành công
