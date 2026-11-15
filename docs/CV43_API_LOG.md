# CV43 — Biên bản kiểm tra API WebSocket thật (ẩn thông tin riêng)

**Ngày rà soát:** 15/11/2026  
**Nguồn đối chiếu:** `LTFE_AppChat-develop.zip`, `CV43_API_LOG.md` và bản vá CV43 đã bàn giao trước đó.  
**Phạm vi nghiệm thu:** username tồn tại **ngoài fixture**, username **không tồn tại**, mở đúng chat riêng và tải lịch sử API trang 1.

> **Trạng thái:** **CHƯA CÓ BẰNG CHỨNG API THẬT CHO CV43**. Không có phiên đăng nhập/tài khoản kiểm thử được cấp kèm nguồn, cũng không có file log thu từ `CHECK_USER_EXIST` trong tài liệu đã cung cấp. **Không thay thế bằng log mẫu hoặc kết quả mock.** Bộ thu log thật ở `frontend/scripts/check-cv43-live.mjs` đã được kiểm tra cú pháp nhưng **chưa chạy phiên đăng nhập thật**; thiếu các biến tài khoản kiểm thử.

## 1. Đối chiếu phiên bản source

| Hạng mục | Bản `develop` người dùng gửi | Kết luận |
|---|---|---|
| `frontend/src/services/usersApi.ts` | Chỉ chứa `getRecentConversations()`, **không có** `checkExists()` | Chưa tích hợp CV43 |
| `frontend/src/features/users/CheckUser.tsx` | **Không có** | Không thể bấm kiểm tra username trên bản này |
| `frontend/src/utils/parseUserChecks.ts` | **Không có** | Chưa có parser cho `CHECK_USER_EXIST` |
| `frontend/src/components/ConversationSidebar.tsx` | Có danh sách/gợi ý, **không gắn `CheckUser`** | Chưa mở chat mới bằng tra cứu tên chính xác |
| `frontend/src/components/ChatLayout.tsx`, `features/chat/ChatPage.tsx` | ChatPage dùng `useChat()` hiện tại; chưa thấy đường nối từ CV43 sang `loadHistory` API trong `ChatLayout` | Chưa thể xác nhận UI tự tải lịch sử thật khi chọn người ngoài fixture |
| `docs/CV06_Ket-Noi-API.md` | Có ghi phép thử `LOGIN` và `GET_USER_LIST` thật | **Không phải** log CV43 |
| `docs/CV24.md` | Có ghi lượt thử `GET_PEOPLE_CHAT_MES` riêng ngày 13/11/2026 | **Không chứng minh** username ngoài fixture do CV43 chọn đã mở đúng chat |

**Điều kiện trước khi thử UI:** cập nhật/merge mã CV43 và phần nối lịch sử CV43–CV24 vào nhánh đang chạy, rồi kiểm tra lại source. Không đánh dấu UI PASS khi chỉ chạy trên `develop(1)` chưa tích hợp.

## 2. Kết quả kiểm tra dựa trên chứng cứ hiện có

| Mã | Kịch bản | WebSocket thật | Giao diện/thông điệp | Kết luận |
|---|---|---|---|---|
| A | Username **tồn tại**, ngoài `src/fixtures/users.ts`, khác tài khoản đang đăng nhập | Chưa có response thực của `CHAT_CHECK_USER_EXIST → CHECK_USER_EXIST` | Chưa có bằng chứng mở `{kind: 'people', name: <tên A>}` và tải `GET_PEOPLE_CHAT_MES` đúng A | **CHƯA XÁC MINH** |
| B | Username **không tồn tại** | Chưa có response thực của `CHAT_CHECK_USER_EXIST → CHECK_USER_EXIST` | Chưa có bằng chứng báo không tìm thấy; không đổi chat và không tải lịch sử B | **CHƯA XÁC MINH** |

Bộ **69/69** ca và ESLint/TypeScript PASS đã ghi trong bản vá CV43 trước đó là kiểm thử logic/mô phỏng **trên source đã vá**, **không phải** kết quả API thật và cũng **không phải** kết quả chạy trên `develop(1)` mới tải lên.

## 3. Thu log API thật (một phiên WebSocket xác thực, không mock)

Thêm tệp `frontend/scripts/check-cv43-live.mjs` vào source của bạn. Script dùng **một kết nối WebSocket độc lập cho lệnh kiểm thử**, xác thực `LOGIN`, lần lượt gửi `CHAT_CHECK_USER_EXIST` cho A và B, nhận `CHECK_USER_EXIST`, rồi chỉ khi A thực sự tồn tại mới gửi `GET_PEOPLE_CHAT_MES` trang 1. Script tự kiểm tra A **không có trong** `src/fixtures/users.ts` và không ghi username, mật khẩu, token, `RE_LOGIN_CODE`, hoặc nội dung chat vào log.

Đặt bốn biến môi trường **trên máy chạy kiểm thử, không commit lên GitHub**:

- `APPCHAT_PROBE_USER`: tài khoản đăng nhập thử có quyền
- `APPCHAT_PROBE_PASS`: mật khẩu của tài khoản thử
- `APPCHAT_PROBE_PEOPLE`: **A**, username thật tồn tại, ngoài fixture, khác người đang đăng nhập
- `APPCHAT_PROBE_NOT_FOUND`: **B**, username chắc chắn không tồn tại và khác A

Ví dụ chạy bằng **PowerShell** từ thư mục `frontend/` (nhập bí mật tại máy cá nhân):

```powershell
$cred = Get-Credential -Message 'Tài khoản thử AppChat'
$env:APPCHAT_PROBE_USER = $cred.UserName
$env:APPCHAT_PROBE_PASS = $cred.GetNetworkCredential().Password
$env:APPCHAT_PROBE_PEOPLE = Read-Host 'Username A tồn tại, ngoài fixture'
$env:APPCHAT_PROBE_NOT_FOUND = Read-Host 'Username B không tồn tại'
try {
    node scripts/check-cv43-live.mjs
} finally {
    Remove-Item Env:APPCHAT_PROBE_USER, Env:APPCHAT_PROBE_PASS, Env:APPCHAT_PROBE_PEOPLE, Env:APPCHAT_PROBE_NOT_FOUND -ErrorAction SilentlyContinue
}
```

Script sinh `frontend/CV43_API_LIVE_DA_CHE.txt`. Dòng `API_RESULT: PASS` chỉ xuất hiện khi **đã đăng nhập WebSocket thật**, nhận đúng hai response có giá trị boolean khớp mong đợi và `GET_PEOPLE_CHAT_MES` trả trang 1 hợp lệ, các bản ghi tin (nếu có) đúng cặp người gửi/nhận. **Mảng lịch sử rỗng vẫn hợp lệ** nếu máy chủ trả success; không tự tạo tin giả. Nếu timeout, mất kết nối hay parse sai, `API_RESULT: NOT_VERIFIED`; timeout đóng socket để tránh gán phản hồi muộn của A cho B.

**Kiểm tra công cụ ở môi trường biên soạn:** `node --check frontend/scripts/check-cv43-live.mjs` **PASS**; chạy không cung cấp biến môi trường kết thúc với mã `2`, **không ghi nhận response API**. Đây là kiểm tra công cụ, **không phải** kiểm tra server.

## 4. Kiểm tra mở đúng chat riêng và lịch sử qua UI thật

Chỉ làm sau khi CV43 đã được đưa vào bản frontend chạy và ChatLayout đã gọi adapter `chatApi.loadHistory` cho hội thoại `people`.

1. Từ `frontend/` chạy `npm run dev`; đăng nhập bằng tài khoản được phép, kiểm tra WebSocket `connected`. Trong sidebar chọn nguồn **API thật**, không chọn mock.
2. Mở Chrome DevTools → **Sources → Snippets**, dán file `frontend/scripts/cv43-cv24-live-snippet.js` trong gói bàn giao này và chạy. Snippet **dùng socketClient đang chạy trong trình duyệt, không mở socket thứ hai**; chỉ xuất metadata đã che.
3. Tại bộ lọc **Người dùng**, nhập chính xác A nằm ngoài fixture và bấm **Kiểm tra người dùng**. Đợi giao diện tải xong. Ở bảng theo dõi bấm **Xuất log đã che** để nhận `CV43_CV24_LICH_SU_NGOAI_FIXTURE_DA_CHE.txt`.
4. Trong log UI, đối chiếu: `Username ngoai fixture: PASS`; `CHECK_USER_EXIST data.status=true: PASS`; `GET_PEOPLE_CHAT_MES trang 1 dung username: PASS`; `Phan hoi lich su: success`; `Chat rieng mo dung: PASS`; `Giao dien hien thi du lieu lich su: PASS`; `KET QUA: PASS`. **Các dòng này là tiêu chí yêu cầu, không phải kết quả đã chạy.**
5. Thử B trên form UI: phải báo **“Không tìm thấy tài khoản với username này.”**, giữ nguyên cuộc chat đang mở (nếu có), và không gửi `GET_PEOPLE_CHAT_MES` cho B. Thu bằng chứng UI/Network đã che riêng; không tự suy diễn chỉ từ việc không có gợi ý trong danh sách gần đây.
6. Sau khi thu file, kiểm tra không còn username, ID người dùng, nội dung tin, mật khẩu hoặc mã phiên; ghi commit Git và ngày chạy. Chỉ chuyển bảng ở mục 2 thành **PASS** nếu các kết quả thực tế tương ứng đều đạt.

## 5. Khối bằng chứng phải chèn sau khi chạy thực tế

**A — Username tồn tại ngoài fixture**

- Thời gian UTC: **chưa có**
- Commit frontend: **chưa có**
- `CHAT_CHECK_USER_EXIST → CHECK_USER_EXIST`, boolean `true`: **chưa thu log thật**
- `GET_PEOPLE_CHAT_MES` trang 1 đúng tên A, response success: **chưa thu log thật**
- UI mở đúng chat riêng A; lịch sử tải xong: **chưa thu log thật**
- Tệp bằng chứng: `CV43_API_LIVE_DA_CHE.txt`, `CV43_CV24_LICH_SU_NGOAI_FIXTURE_DA_CHE.txt` (**chưa được cung cấp**)

**B — Username không tồn tại**

- Thời gian UTC: **chưa có**
- Commit frontend: **chưa có**
- `CHAT_CHECK_USER_EXIST → CHECK_USER_EXIST`, boolean `false`: **chưa thu log thật**
- UI không tìm thấy; không mở B, không tải lịch sử B: **chưa thu log thật**
- Tệp bằng chứng: `CV43_API_LIVE_DA_CHE.txt` và ảnh/quan sát UI đã che (**chưa được cung cấp**)

**Trạng thái nghiệm thu CV43 API/UI:** **CHƯA XÁC MINH**. Chỉ thay trạng thái khi có hai log từ phiên API đã xác thực và kiểm tra UI ở mục 4. Không chép log ví dụ, không tự sửa `NOT_VERIFIED` thành `PASS`.
