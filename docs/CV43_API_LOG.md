# CV43 — Nhật ký kiểm chứng WebSocket thật (đã che thông tin)

**Ngày rà soát:** 15/11/2026 · **Chủ trách nhiệm:** Khôi · **Review:** Mẫn (CV06), Kiệt (history CV24/CV25).
**Nguồn:** nhánh `feat/khoi/cv043`, đối chiếu `origin/develop` tại `b44417c`.

**Trạng thái:** `NOT_VERIFIED`. Không có tài khoản thử được cung cấp và không có response đã đăng nhập, nên chưa xác nhận sự tương thích với máy chủ thật. Kết quả tsc/lint hay Vitest (mock) không thể thay thế kiểm thử này.

## 1. Hợp đồng yêu cầu xác minh

| Tác vụ | Event gửi trên WebSocket | Event nhận | Điều kiện chấp nhận |
|---|---|---|---|
| Kiểm tra tồn tại | `CHECK_USER_EXIST` | `CHECK_USER_EXIST` | `data.status` boolean, `status` ngoài có thể `success` hoặc vắng mặt |
| Kiểm tra online | `CHECK_USER_ONLINE` | `CHECK_USER_ONLINE` | `data.status` boolean; lỗi/timeout là `unknown` |
| Lịch sử chat riêng A | `GET_PEOPLE_CHAT_MES` | `GET_PEOPLE_CHAT_MES` | `{name:A,page:1}`, response thành công với đúng cặp người hoặc mảng rỗng |

`usersApi.ts` gọi trực tiếp tên event thật, không thay `socketClient.ts` của Mẫn. Các tên trên dựa vào tài liệu API nhóm; chỉ thử server thật mới xác nhận được.

## 2. Chạy thử API thật trên máy có Internet và tài khoản được phép

Mở PowerShell trong `frontend/`. **A phải là người tồn tại ngoài fixture, khác tài khoản đăng nhập. B phải chắc chắn không tồn tại.** Không ghi mật khẩu vào source hoặc log:

```powershell
$cred = Get-Credential -Message 'Tai khoan kiem thu AppChat'
$env:APPCHAT_PROBE_USER = $cred.UserName
$env:APPCHAT_PROBE_PASS = $cred.GetNetworkCredential().Password
$env:APPCHAT_PROBE_PEOPLE = Read-Host 'Username A ton tai ngoai fixture'
$env:APPCHAT_PROBE_NOT_FOUND = Read-Host 'Username B khong ton tai'
try {
    node scripts/check-cv43-live.mjs
} finally {
    Remove-Item Env:APPCHAT_PROBE_USER, Env:APPCHAT_PROBE_PASS, Env:APPCHAT_PROBE_PEOPLE, Env:APPCHAT_PROBE_NOT_FOUND -ErrorAction SilentlyContinue
}
```

Script sẽ dùng **một WebSocket độc lập cho phép thử**, không mở thêm kết nối trong React, thử `LOGIN` → `CHECK_USER_EXIST` A/B → `GET_PEOPLE_CHAT_MES` A trang 1; xuất `frontend/CV43_API_LIVE_DA_CHE.txt` chỉ chứa metadata. File kết quả được `../.gitignore` bỏ qua. `API_RESULT: PASS` chỉ khi từng phép kiểm chứng thực sự đạt, không được tự điền PASS. Nếu response đến muộn sau timeout, script đóng socket để không đối chiếu nhầm người.

## 3. Xác minh luồng UI thật

Chạy `npm run dev`, đăng nhập tại `/chat`, chọn API thật, lọc **Người dùng**. Dùng A ngoài fixture, nhấn **Kiểm tra người dùng** và đối chiếu trên Network → WS: phát `CHECK_USER_EXIST`, nhận `data.status:true`, mở đúng chat riêng A, tải `GET_PEOPLE_CHAT_MES {name:A,page:1}` và hiển thị lịch sử (kể cả hợp lệ rỗng). A phải có trong sidebar của phiên và còn khi làm mới; logout không giữ mục A cục bộ.

Dùng B và xác nhận `data.status:false`; không tạo chat B, không gửi lịch sử B. Kiểm tra tự nhập username đăng nhập, timeout, đổi phiên và lỗi online. Chỉ chia sẻ metadata đã che; không xuất frame chứa tên thật, nội dung tin, mã phiên.

## 4. Kết quả có bằng chứng tính đến 15/11/2026

| Ca | Phản hồi LOGIN/WS | Kết quả UI | Trạng thái |
|---|---|---|---|
| A có thật, ngoài fixture | Chưa có phản hồi thật | Chưa thử trên UI đã LOGIN | `NOT_VERIFIED` |
| B không tồn tại | Chưa có phản hồi thật | Chưa thử trên UI đã LOGIN | `NOT_VERIFIED` |
| Online A, timeout và đổi phiên | Chưa có phản hồi thật | Chưa thử trên UI đã LOGIN | `NOT_VERIFIED` |

```text
UTC: CHUA_CO
Git_commit: CHUA_CO_COMMIT_SAU_SUA
LOGIN: KHONG_CO_PHIEN_XAC_THUC
CHECK_USER_EXIST_A_true: KHONG_CO_RESPONSE_THAT
CHECK_USER_EXIST_B_false: KHONG_CO_RESPONSE_THAT
GET_PEOPLE_CHAT_MES_A_page1: KHONG_CO_RESPONSE_THAT
UI_A_va_sidebar: CHUA_KIEM_CHUNG
UI_B_khong_tao_chat: CHUA_KIEM_CHUNG
KET_LUAN: NOT_VERIFIED
```

Sau khi chạy thực tế, ghi ngày/commit, kết quả A/B và tình huống UI đã che vào đây. Không đưa thông tin nhạy cảm hoặc bí mật phiên vào tài liệu/repo.
