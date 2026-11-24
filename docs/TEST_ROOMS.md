# CV49 — Kiểm thử phòng thật với tài khoản được phép

**Người thực hiện:** Trương Hoàng Minh Khôi · **Kiểm tra chéo:** Trần Lê Minh Mẫn  
**Nhánh:** `feat/khoi/cv49` → PR base `develop`  
**Căn cứ:** `AppChat_PhanCong_NgayChuan.xlsx` bản mới (hàng CV49, trạng thái `Chưa làm`), `PHAN_CONG_CHI_TIET_CV01_CV54.md` (CV49), `HOP_DONG.md`, `LUONG_GIAO_DIEN.md`, `docs/ROOM_UI.md`, `docs/CV047.md`, `docs/cv43.md` và source hiện tại.

## 1. Trạng thái phải phân biệt

| Loại bằng chứng | Trạng thái cập nhật 24/11/2026 | Ý nghĩa |
| --- | --- | --- |
| Đối chiếu source và đặc tả | **Đã thực hiện** | Đọc adapter, store và UI CV43–CV48; đối chiếu lệnh/phản hồi |
| Unit/contract test `check-cv49.mjs` | **31/31 PASS** | Dùng phản hồi giả trong bộ nhớ, không truy cập WebSocket thật |
| Regression CV44, CV45, CV46, CV47 | **139/139 PASS** | Theo báo cáo Khôi; xem `docs/CV049.md` |
| TypeScript và ESLint file thay đổi | **PASS** | Node v22/Linux trong môi trường kiểm tra |
| `npm run build` Vite và lint | **PASS** | Theo báo cáo Khôi trên máy cá nhân; không phải lần chạy Linux ban đầu |
| WebSocket thật với hai tài khoản hợp lệ | **PASS theo báo cáo Khôi** | Tạo/trùng, JOIN, thành viên, OUT, JOIN lại; log gốc cần đối chiếu tại PR |
| UI thật theo phạm vi review | **PASS theo báo cáo Khôi** | Tạo/trùng, JOIN, thành viên, Hủy giữ nháp, OUT, JOIN lại; chưa xác nhận riêng mobile |
| UI timeout OUT (mock socket) | **12/12 PASS** | Chromium ngoại tuyến, MemoryRouter; ảnh/log trong gói mới |
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
node --test .\scripts\check-cv49-live.mjs
node .\scripts\check-cv49.mjs
node .\scripts\check-cv44.mjs
node .\scripts\check-cv45.mjs
node .\scripts\check-cv46.mjs
node .\scripts\check-cv46-rejected.mjs
node .\scripts\check-cv46-rejoin.mjs
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
New-Item -ItemType Directory -Force ..\docs\evidence\cv49 | Out-Null
$env:CV49_EVIDENCE_PATH = Join-Path (Resolve-Path ..\docs\evidence\cv49) 'api-live.json'
node .\scripts\cv49-live.mjs --live 2>&1 | Tee-Object -FilePath ..\docs\evidence\cv49\api-live.txt
$LASTEXITCODE
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
| CV49-UI03 / TC09 | A tạo phòng `cv49_*` mới; bấm lặp lúc pending; tạo trùng tên | Chỉ tạo một phòng mới sau response success đúng tên; pending không gửi hai request | PASS tạo/trùng theo Khôi; double click UI chưa xác nhận riêng |
| CV49-UI04 / TC09 | B thử JOIN phòng không tồn tại; mở JOIN rồi Hủy; JOIN phòng A bằng nút xác nhận; JOIN lần nữa | Hủy không gửi request; lỗi không thêm phòng giả; success đúng phòng không sinh mục trùng | PASS JOIN theo Khôi; các bước phụ chưa xác nhận riêng |
| CV49-UI05 / TC10 | A/B mở thành viên; xem own, userList, đóng, làm mới; thử lỗi tải bằng môi trường kiểm thử | Thiếu danh sách khác `[]`; refresh lỗi giữ danh sách cũ và cảnh báo; đóng panel không logout/rời phòng | PASS danh sách thành viên theo Khôi; lỗi refresh UI chưa xác nhận riêng |
| CV49-UI06 / TC11 | A là chủ; xem nút Rời phòng | Không cho chủ phòng tự rời, không giả chức năng chuyển chủ/xóa phòng | Chưa chạy |
| CV49-UI07 / TC11 | B soạn nháp, mở Rời phòng rồi Hủy; sau đó xác nhận OUT_ROOM | Hủy giữ nháp; chỉ xác nhận OUT thành công mới xóa nháp và khóa gửi | PASS Hủy giữ nháp và OUT theo Khôi |
| CV49-UI08 / TC11 | B mở mục Phòng đã rời, Hủy JOIN; sau đó xác nhận JOIN lại | Không auto JOIN khi xem/chọn/Hủy; success khôi phục đúng một mục và quyền theo xác nhận | PASS JOIN lại theo Khôi; Hủy JOIN lại chưa xác nhận riêng |
| CV49-UI09 / TC11 | Trong môi trường thử giả lập riêng, tạo timeout JOIN/OUT hoặc ngắt socket khi đang chờ | Trạng thái chưa xác định, không tự gửi lại; cần đối chiếu trước thao tác tiếp | PASS 12/12 UI timeout OUT; ảnh/log mục 9 |
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
- **Giới hạn:** Khôi báo đã có bằng chứng live/UI, nhưng file ảnh/log gốc chưa được cung cấp trong lượt cập nhật này; reviewer đối chiếu tại PR. Chưa ghi Excel gốc.


## 8. Review lần 2 – ma trận bằng chứng bắt buộc

Cập nhật 24/11/2026: Khôi báo đã chạy hai tài khoản thật và có bằng chứng API/UI cho bảy ca chính, CV49 31/31, hồi quy 139/139, build/lint PASS. Các file live gốc chưa được cung cấp ở lượt này, tên ảnh live bên dưới là tên tham chiếu đề xuất để reviewer đối chiếu. Riêng ảnh/log timeout mock được tạo và kiểm tra trong gói này. Test validator 21/21 là kết quả giả lập đợt trước.

Dùng hai browser profile riêng hoặc một cửa sổ thường và một ẩn danh (A chủ phòng, B thành viên). Chạy API script trước, sau đó dùng một phòng thử riêng cho UI (script đã OUT B ở cuối). Chỉ tạo phòng nếu được phép, không có API xóa. Mở DevTools Network > WS > Messages trên mỗi profile; đối chiếu frame gửi/nhận và chụp màn hình đã che token, username, nội dung riêng; dùng A/B làm nhãn nhất quán. Không xuất HAR/raw frame chứa LOGIN.

| Ca | API cần đối chiếu | UI và bằng chứng dự kiến | Kết quả thật |
| --- | --- | --- | --- |
| Tạo phòng | CREATE_ROOM success, đúng name | A thấy phòng mới; 01-create.png | PASS theo Khôi; đối chiếu ảnh/log tại PR |
| Trùng tên | CREATE_ROOM error | Hiện lỗi, không thêm mục trùng; 02-duplicate.png | PASS theo Khôi; đối chiếu ảnh/log tại PR |
| JOIN | JOIN_ROOM success đúng name | B thấy đúng một phòng; 03-join.png | PASS theo Khôi; đối chiếu ảnh/log tại PR |
| Thành viên | GET_ROOM_CHAT_MES success, đúng name, danh sách hợp lệ chứa A/B | Panel A/B khớp API; 04-members-A.png, 04-members-B.png | PASS theo Khôi; đối chiếu ảnh/log tại PR |
| Hủy khi có nháp | Không có OUT_ROOM trong khoảng thao tác Hủy | Nháp thử vẫn nguyên, vẫn gửi được nếu được phép; 05-cancel-before.png, 05-cancel-after.png, log số frame OUT=0 | PASS theo Khôi; đối chiếu ảnh/log tại PR |
| Rời phòng | OUT_ROOM success đúng name hoặc không có name và mes hợp lệ | B mất phòng khỏi hội thoại, nháp xóa sau success; 06-leave.png | PASS theo Khôi; đối chiếu ảnh/log tại PR |
| JOIN lại | JOIN_ROOM success đúng name | B khôi phục đúng một mục; 07-rejoin.png | PASS theo Khôi; đối chiếu ảnh/log tại PR |
| Chủ không được rời | Mock metadata own=A; không gửi OUT_ROOM | Nút rời bị chặn; 08-owner-mock.png | Chưa chạy UI mock |
| Timeout | Mock OUT đã gửi nhưng không nhận phản hồi; không gửi lại | Unknown, giữ nháp/quyền chưa xác định theo luồng; ảnh mục 9 | 12/12 PASS UI mock OUT; contract PASS |

Với mỗi ca, ghi thời gian, nhãn A/B, môi trường (live hoặc mock UI), event/status, name khớp hay không, kết quả UI, tên ảnh/log. Với ca Hủy, ghi số OUT_ROOM trước/sau và xác nhận nháp còn nguyên. Với timeout/owner mock, dùng môi trường test riêng, không tạo lỗi trên production. Chỉ ghi PASS sau khi kiểm tra đủ bằng chứng. Script API không xác nhận hành vi UI.

Kèm `api-live.json`, `api-live.txt`, ảnh đã che thông tin, bảng kết quả điền thực tế vào PR sau khi chạy. JSON mới ghi các thuộc tính an toàn event/status/namePresent/nameMatches/mesPresent, cùng kết quả kiểm tra A/B trong danh sách. Không commit mật khẩu, token, tên thật hoặc tin nhắn. Nếu thiếu bằng chứng hoặc có failed/unverified thì giữ CV49 chưa nghiệm thu.

## 9. Timeout OUT_ROOM trên UI bằng socket giả

Kịch bản mới không sửa runtime. Mock socket cài riêng trong browser context, giả lập tài khoản/phòng, cố ý bỏ phản hồi OUT_ROOM; dùng timeout 10 giây thực của client và quan sát thêm 11 giây.

Chạy trên Windows: mở terminal 1 trong frontend và `npm run dev`. Terminal 2 trong frontend:

```powershell
python -m pip install playwright
python -m playwright install chromium
python .\scripts\cv49-timeout-ui\run_timeout_ui.py --url http://localhost:5173/chat --out ..\docs\evidence\cv49\timeout-mock
```

Nếu Vite dùng port khác, thay URL theo terminal 1. Không nhập tài khoản thật.

Kết quả đã chạy ngoại tuyến: 12/12 PASS. Chromium dùng source transpile CommonJS và MemoryRouter /chat do localhost bị chặn; mock WebSocket, không gọi server thật. Không phải bằng chứng timeout JOIN hoặc chủ phòng trên UI.

| Bằng chứng | Nội dung |
| --- | --- |
| `evidence/cv49/timeout-mock-offline/01-out-pending.png` | OUT pending, nút xác nhận bị khóa, nháp còn |
| `evidence/cv49/timeout-mock-offline/02-timeout-unknown.png` | Hết thời gian chờ, chưa rõ kết quả, không cho gửi lại OUT |
| `evidence/cv49/timeout-mock-offline/03-unknown-membership-draft.png` | Quyền phòng chưa xác định, nháp còn, Gửi bị khóa |
| `evidence/cv49/timeout-mock-offline/timeout-ui.json` và `timeout-ui.txt` | 12 kiểm tra PASS, trace socket và số lệnh ghi: CREATE=0, JOIN=1 ban đầu, OUT=1, SEND_CHAT=0; OUT response=0 |

RE_LOGIN và GET_USER_LIST có thể tự chạy để khôi phục phiên sau timeout, không phải tự gửi lại lệnh ghi phòng. Đính kèm ảnh/log mock này cùng bằng chứng live đã có; không thay thế log live.
