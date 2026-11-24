# CV49 — Kiểm thử phòng thật với tài khoản được phép

**Người thực hiện:** Trương Hoàng Minh Khôi · **Kiểm tra chéo:** Trần Lê Minh Mẫn  
**Nhánh:** `feat/khoi/cv49` → PR base `develop`  
**Căn cứ:** `AppChat_PhanCong_NgayChuan.xlsx` bản mới (hàng CV49, trạng thái `Chưa làm`), `PHAN_CONG_CHI_TIET_CV01_CV54.md` (CV49), `HOP_DONG.md`, `LUONG_GIAO_DIEN.md`, `docs/ROOM_UI.md`, `docs/CV047.md`, `docs/cv43.md` và source hiện tại.

## 1. Trạng thái phải phân biệt

| Loại bằng chứng | Trạng thái tại lúc đóng gói CV49 | Ý nghĩa |
| --- | --- | --- |
| Đối chiếu source và đặc tả | **Đã thực hiện** | Đọc adapter, store và UI CV43–CV48; đối chiếu lệnh/phản hồi |
| Unit/contract test `check-cv49.mjs` | **31/31 PASS** | Dùng phản hồi giả trong bộ nhớ, không truy cập WebSocket thật |
| Regression CV44, CV45, CV46, CV47 | **PASS** | Test giả lập đã chạy lại; xem `docs/CV049.md` |
| TypeScript và ESLint file thay đổi | **PASS** | Node v22/Linux trong môi trường kiểm tra |
| `npm run build` Vite | **CHƯA XÁC NHẬN** | Bộ `node_modules` trong ZIP lấy từ Windows; thiếu binary Rolldown Linux |
| WebSocket thật với hai tài khoản hợp lệ | **CHƯA CHẠY** | Chưa có thông tin xác thực/quyền dùng hai tài khoản, không tự đăng nhập vào hệ thống |
| UI desktop/mobile thực tế | **CHƯA CHẠY** | Chỉ đánh dấu khi có ảnh/video hoặc phiếu kiểm thử từ máy người thực hiện |
| PR và review chéo | **CHƯA CÓ BẰNG CHỨNG** | Người tạo PR điền URL thật, người kiểm tra chéo xác nhận |

**Không được đổi CV49 hoặc TC06/TC07/TC09/TC10/TC11 trong Excel sang `Hoàn tất`/`Đã kiểm tra` chỉ dựa trên 31 bài mock.**

## 2. Những file thay đổi trong gói CV49

- `frontend/src/features/rooms/roomRequestState.ts`: kiểm tra lại `result.data.name === roomName` trước khi báo thành công ở lớp trạng thái UI. Nếu sai → `unknown`, không cho thao tác ghi lặp tự động.
- `frontend/scripts/check-cv49.mjs`: 31 ca kiểm thử giả lập F07/F09/F13–F16/F18 và trường hợp timeout, session cũ, double click.
- `frontend/scripts/cv49-live.mjs`: kịch bản kiểm thử máy chủ thật *có chủ đích*, cần hai tài khoản được phép và công tắc xác nhận ghi; mặc định chỉ dry run.
- `frontend/scripts/check-cv45.mjs`: cập nhật mock `parseRichMessage` vì `chatApi.ts` đã thêm import này; không thay đổi chức năng chat của Kiệt.
- `docs/CV049.md`, `docs/TEST_ROOMS.md`, `docs/CV049_LOCAL_RESULTS.txt`: hướng dẫn, đối chiếu, log kiểm thử giả lập.

Không sửa API máy chủ, `socketClient`, code chat của Kiệt hay quyền quản trị phòng. Không thêm endpoint giả.

## 3. Chạy kiểm thử cục bộ trên Windows

Mở **PowerShell** ở thư mục gốc `LTFE_AppChat` rồi chạy:

```powershell
cd .\frontend
npm ci
node .\scripts\check-cv49.mjs
node .\scripts\check-cv44.mjs
node .\scripts\check-cv45.mjs
node .\scripts\check-cv46.mjs
node .\scripts\check-cv47.mjs
npm run build
npm run lint
```

`npm ci` phải có mạng hoặc package cache phù hợp. Nếu dự án đã có `node_modules` hợp lệ trên Windows, có thể chạy các lệnh kiểm thử trước khi cài lại. Những bài trên chỉ giả lập, **không tạo phòng thật**.

## 4. Chạy script kiểm thử máy chủ thật (chỉ khi được phép)

**Lưu ý:** Script sẽ tạo **một phòng thử riêng có tên `cv49_*` trên server**. Hiện không có API xóa phòng trong hợp đồng, nên phòng thử có thể tiếp tục tồn tại. Không chạy với tài khoản người khác, không dùng phòng đang có dữ liệu thật. Script **không thử OUT_ROOM trên tài khoản chủ phòng**.

Kiểm tra dry run, không tạo kết nối:

```powershell
node .\scripts\cv49-live.mjs
```

Nếu và chỉ nếu bạn có **hai tài khoản thử A/B** được phép tạo/tham gia/rời phòng, mở **PowerShell phiên riêng**, điền biến môi trường ngay trong cửa sổ đang dùng:

```powershell
$env:CV49_A_USER = 'USERNAME_A_DUOC_PHEP'
$env:CV49_A_PASS = 'MAT_KHAU_A'
$env:CV49_B_USER = 'USERNAME_B_DUOC_PHEP'
$env:CV49_B_PASS = 'MAT_KHAU_B'
$env:CV49_ALLOW_WRITES = 'YES'
node .\scripts\cv49-live.mjs --live
```

Hai tài khoản phải khác nhau. Không commit lệnh đã điền mật khẩu, `.env` thực tế, token phiên, DevTools raw frame có bí mật hoặc lịch sử chat. **Không gửi ảnh chụp PowerShell chứa mật khẩu.** Xóa biến môi trường hoặc đóng cửa sổ PowerShell khi xong.

Script sử dụng đúng event đã có bằng chứng thực tế trong `docs/cv43.md`: gửi `CHECK_USER_EXIST`, nhận `CHECK_USER_EXIST` (khác hợp đồng đề xuất cũ `CHAT_CHECK_*`). Không tự đổi hợp đồng chung của Mẫn.

Script tự động kiểm tra: LOGIN hai phiên, danh sách gần đây, người có/không tồn tại, JOIN phòng không tồn tại, CREATE phòng riêng, CREATE trùng tên, JOIN phòng, JOIN khi đã là thành viên (ghi nhận phản hồi có thể idempotent), đọc phòng trên hai tài khoản, OUT_ROOM của thành viên, JOIN lại, OUT_ROOM dọn quyền thành viên. Nếu có timeout/sai format, script dừng, **không tự gửi lại thao tác ghi**. Không đọc hoặc ghi tin nhắn của người không liên quan.

Bằng chứng JSON **đã lược bỏ** username/mật khẩu/token/tên phòng/nội dung phản hồi được lưu tại thư mục tạm của máy (script in đường dẫn). Muốn đổi vị trí, đặt `CV49_EVIDENCE_PATH` trước khi chạy. **Chỉ gửi cho người review JSON đã kiểm tra an toàn và ảnh UI đã che thông tin riêng**. Script không tự ghi bằng chứng lên GitHub.

## 5. Checklist kiểm thử giao diện thật cho TC06, TC07, TC09, TC10, TC11

| Mã | Bước thao tác với tài khoản/phòng thử được phép | Kết quả đạt cần xác nhận | Kết quả thật / ảnh / thời gian |
| --- | --- | --- | --- |
| CV49-UI01 / TC06 | A đăng nhập; tải hội thoại; tìm một phần tên người và phòng gần đây; thử tên không có trong gần đây | Gợi ý chỉ trong gần đây, không hiểu `không gợi ý` là `không tồn tại` | Chưa chạy |
| CV49-UI02 / TC07 | A nhập username chính xác của B, rồi nhập username không tồn tại | Trả `true`/`false` theo API; lỗi/timeout không biến thành `false` | Chưa chạy |
| CV49-UI03 / TC09 | A tạo phòng `cv49_*` mới; bấm lặp lúc pending; tạo trùng tên | Chỉ tạo một phòng mới sau response success đúng tên; pending không gửi hai request | Chưa chạy |
| CV49-UI04 / TC09 | B thử JOIN phòng không tồn tại; mở JOIN rồi Hủy; JOIN phòng A bằng nút xác nhận; JOIN lần nữa | Hủy không gửi request; lỗi không thêm phòng giả; success đúng phòng không sinh mục trùng | Chưa chạy |
| CV49-UI05 / TC10 | A/B mở thành viên; xem own, userList, đóng, làm mới; thử lỗi tải bằng môi trường kiểm thử | Thiếu danh sách khác `[]`; refresh lỗi giữ danh sách cũ và cảnh báo; đóng panel không logout/rời phòng | Chưa chạy |
| CV49-UI06 / TC11 | A là chủ; xem nút Rời phòng | Không cho chủ phòng tự rời, không giả chức năng chuyển chủ/xóa phòng | Chưa chạy |
| CV49-UI07 / TC11 | B soạn nháp, mở Rời phòng rồi Hủy; sau đó xác nhận OUT_ROOM | Hủy giữ nháp; chỉ xác nhận OUT thành công mới xóa nháp và khóa gửi | Chưa chạy |
| CV49-UI08 / TC11 | B mở mục Phòng đã rời, Hủy JOIN; sau đó xác nhận JOIN lại | Không auto JOIN khi xem/chọn/Hủy; success khôi phục đúng một mục và quyền theo xác nhận | Chưa chạy |
| CV49-UI09 / TC11 | Trong môi trường thử giả lập riêng, tạo timeout JOIN/OUT hoặc ngắt socket khi đang chờ | Trạng thái chưa xác định, không tự gửi lại; cần đối chiếu trước thao tác tiếp | Chưa chạy |
| CV49-UI10 / TC06,TC09–11 | Lặp lại trên màn hình điện thoại; mở/đóng panel, quay lại danh sách | Form chạm được, không tràn ngang, thao tác back không thành logout/OUT_ROOM | Chưa chạy |

**Vai trò chưa rõ:** Khi `own` hoặc `userList` thiếu, kiểm tra UI hiển thị *Chưa xác định* thay vì tự coi user hiện tại là chủ hoặc chắc chắn đã tham gia. Sau reconnect cần kiểm lại quyền bằng hành động được phép; không dùng GET_USER_LIST làm xác nhận membership.

**Với timeout thao tác ghi:** Bài test giả lập đã bao phủ; không cố tình tấn công/giữ server thật trong trạng thái lỗi. Muốn xác nhận đường đi UI thì có thể dùng mock/test environment riêng được phép, tuyệt đối không bắn yêu cầu lặp vào production.

## 6. Cách cập nhật `AppChat_PhanCong_NgayChuan.xlsx` sau khi chạy thật

Tại sheet `Ket_qua`, tập trung **TC06, TC07, TC09, TC10, TC11**; điền ngày chạy, môi trường, lượt chạy, số test đạt/lỗi, trạng thái, người chạy, liên kết ảnh/log đã che dữ liệu và kết quả thực tế. Chỉ chọn `Đã kiểm tra` khi có bằng chứng và đã được Mẫn review. Sau đó cập nhật CV49 trong `Cong_viec` theo quy trình của nhóm; không tự chấm hoàn tất bằng tài liệu hoặc mock.

## 7. Thông tin bàn giao PR

- **PR base:** `develop`.
- **PR title gợi ý:** `test(khoi): CV49 test phòng thật và guard response sai tên`.
- **Reviewer:** Trần Lê Minh Mẫn.
- **Link PR:** _Chưa có; người tạo PR điền link thật_ .
- **Mục cần kiểm tra chéo:** không tự JOIN, tạo/trùng, metadata thành viên thiếu/rỗng, không cho chủ rời, OUT thất bại/timeout giữ nháp, JOIN lại, response sai tên khóa quyền, test script không chứa thông tin xác thực.
- **Giới hạn:** Chưa có bằng chứng đăng nhập với hai tài khoản được phép, chưa ghi kết quả vào Excel gốc và chưa chạy test UI tương tác trên Windows.
