# CV37 - Đọc luồng tìm kiếm và phòng (`ROOM_UI`)

> **Người phụ trách:** Trương Hoàng Minh Khôi  
> **Kiểm tra chéo:** Trần Lê Minh Mẫn  
> **Hạn theo phân công:** 04/11/2026  
> **Nhánh dự kiến:** `feat/khoi/cv37` → PR vào `develop`  
> **Phạm vi bàn giao:** Phân tích luồng và đối chiếu wireframe F07–F10, F13–F18. Không triển khai API hay giao diện trong CV37.

## 1. Mục tiêu, nguồn đối chiếu và phạm vi

Tài liệu này xác định bề mặt giao diện, hành vi người dùng, lệnh WebSocket tương ứng, trạng thái tải/trống/lỗi và điều kiện quyền trước khi lập trình sidebar, tìm người/phòng, tạo/tham gia/rời phòng và xem thành viên.

**Nguồn đã đọc:**

- `README.md` trong repo `LTFE_AppChat-develop`: mô tả kiến trúc, phân công, luồng làm việc và API.
- `docs/HOP_DONG.md` trong repo: ranh giới service, callback, kiểu dữ liệu và nguyên tắc không suy đoán kết quả máy chủ.
- Bộ tài liệu kèm theo `AppChat_TaiLieu - Copy(1).zip`: `README.md` (F07–F18), `LUONG_GIAO_DIEN.md`, `PHAN_CONG_CHI_TIET_CV01_CV54.md` (mục CV37), `FE_TachManHinh/DANH_MUC.md` và các ảnh trong `FE_TachManHinh/{Desktop,Mobile,TrangThai}/`.
- Giao thức theo tài liệu nhóm: [bảng API của thầy](https://docs.google.com/spreadsheets/d/1-EFA-OXUCUIPP6CnAk4z0_ONS-3G9SVU/edit?gid=1040781536#gid=1040781536). Tài liệu nhóm có ghi lại phép thử phòng ngày 07/11/2026; **CV37 không thực hiện lại phép thử API này**.

**Ranh giới:** Đây là website React responsive. Không tạo danh bạ toàn hệ thống, không suy diễn quyền thành viên từ danh sách gần đây, không thêm tính năng mời/đuổi, xóa/đổi tên phòng, chuyển chủ hay route riêng cho mỗi popup khi chưa có hợp đồng API. Việc dựng UI và nối service nằm ở CV38–CV49, không được báo là đã hoàn thành trong CV37.

## 2. Phân biệt sidebar, panel và dialog

| Khu vực | Desktop | Mobile (cùng website) | Luồng / thao tác |
| --- | --- | --- | --- |
| **Sidebar**: bộ chọn `Người dùng` / `Phòng`, ô `Tìm theo tên`, gợi ý, danh sách hội thoại, nút tạo/tham gia | Cột trái cố định, nội dung hội thoại ở bên phải; khi chưa chọn hiện hướng dẫn ở vùng chính | Màn danh sách chiếm chiều rộng; chạm hội thoại chuyển sang vùng chat | F07, F08; đưa người dùng vào F09/F10/F13/F14 |
| **Panel tìm/kiểm tra người** | Vùng thao tác trong khu vực tìm, không phải một cuộc chat mới hay route backend | Hiển thị theo luồng danh sách/tìm | F09, các trạng thái `TrangThai/25–29` |
| **Panel Thành viên** | Bảng phụ mở cạnh vùng chat, có `Đóng`, `Làm mới`, vai trò từng người | Một màn thông tin phụ, có `Quay lại danh sách`/`Đóng` tùy ngữ cảnh thiết kế | F15; thông báo hạn chế quyền F17 |
| **Dialog Tạo phòng** | Hộp biểu mẫu tên phòng, `Hủy`/`Tạo phòng` | Hộp/form nổi trong bố cục một cột, nút đủ lớn để chạm | F13 |
| **Dialog Tham gia phòng** | Hộp xác nhận tên chính xác và tác động tư cách thành viên | Hộp/form xác nhận, không tự gửi khi chỉ tìm | F10 → F14; F18 tham gia lại |
| **Dialog Rời phòng** | Hộp xác nhận sau khi bấm `Rời phòng` từ phòng đang mở/panel thành viên | Hộp xác nhận trong màn phòng | F16; F17 chặn khi xác định là chủ |

`Quay lại danh sách`, `Đóng` panel, `Hủy` dialog và đổi hội thoại **không** đồng nghĩa `OUT_ROOM`, `LOGOUT`, `JOIN_ROOM` hoặc gửi tin. Các màn `TrangThai` là các biến thể trạng thái đặt vào đúng vùng hiện có, không phải route độc lập.

### Đối chiếu bố cục ảnh chính

| Ảnh trong bộ `FE_TachManHinh/` | Điều quan sát được | Kết luận thiết kế |
| --- | --- | --- |
| `Desktop/03_F07_Hoi_thoai_chua_chon.png` | Sidebar có chọn loại tìm, ô tên, nút `Tạo phòng`/`Tham gia phòng`; phần chính hướng dẫn bắt đầu trò chuyện | F07 vẫn có CTA khi danh sách trống; phần chính không phụ thuộc dữ liệu tìm |
| `Desktop/05_F14_Phong_nhom_hoc_thanh_vien.png` | Phòng và người trùng tên có thể cùng nằm trong danh sách; header phòng có `Thành viên`, `Rời phòng` | Luôn giữ **kind + name**, không dùng riêng `name` làm khóa |
| `Desktop/06_F15_Thanh_vien_da_tai.png` | Panel bên phải hiện tên, tổng thành viên, `Làm mới`, vai trò và dấu thời điểm tải | Danh sách thành viên là ảnh chụp dữ liệu đã tải, không mặc định realtime |
| `Desktop/08_F13-F17_Phong_du_an_chu_phong.png` | Người đang đăng nhập có nhãn `Chủ phòng`, nút rời bị khóa và có lý do | Chỉ chặn khi đã xác định quyền chủ từ dữ liệu máy chủ |
| `Mobile/03_F07-F08_Danh_sach_hoi_thoai.png` | Tìm theo loại, CTA `Kiểm tra người dùng`, `Tạo phòng`, `Tham gia phòng` nằm cùng danh sách | Thao tác tìm/chọn không tự mở hoặc sửa quyền phòng |
| `Mobile/05_F14-F19_Phong_chat.png`, `Mobile/06_F15_Thanh_vien.png` | Điều hướng một cột, có nút quay lại danh sách và panel thành viên riêng | Back chỉ là điều hướng; giữ nháp trong phiên |
| `Mobile/07_F13_Tao_phong.png`, `Mobile/08_F14_Tham_gia_phong.png`, `Mobile/15_F16_Roi_phong.png` | Các form/xác nhận có `Hủy` và hành động chính, nhắc trạng thái request có thể tiếp tục sau khi đóng | Phân biệt hủy UI trước khi gửi với request đã gửi |

## 3. Nguyên tắc tìm kiếm, định danh và giao thức

### 3.1. Ba hành động rất dễ nhầm

| Hành động | Nguồn dữ liệu / lệnh | Điều được phép kết luận | Điều **không** được phép kết luận |
| --- | --- | --- | --- |
| **Gợi ý gần đây** (F07–F08) | `GET_USER_LIST` trả các hội thoại gần đây với `name`, `type`, `actionTime`; frontend lọc theo phần tên và loại | Có/không có mục phù hợp **trong dữ liệu gần đây đã tải** | Không có gợi ý ≠ người/phòng không tồn tại trên máy chủ; đây không phải tra cứu toàn hệ thống |
| **Kiểm tra username chính xác** (F09) | Gửi `CHAT_CHECK_USER_EXIST` với `{user}`; nhận sự kiện `CHECK_USER_EXIST` | Tài khoản chính xác tồn tại hay không khi có phản hồi hợp lệ | Không hỗ trợ quét hàng loạt hay tìm theo một phần username toàn hệ thống |
| **Tham gia phòng theo tên chính xác** (F10/F14/F18) | Người dùng xác nhận dialog rồi mới gửi `JOIN_ROOM` với `{name}` | Khi máy chủ xác nhận thành công mới cập nhật tư cách thành viên | `JOIN_ROOM` **là thao tác ghi**, không phải API tìm phòng vô hại; không tự chạy khi người dùng nhập/gõ lọc |

- `type: 0` là người, `type: 1` là phòng theo dữ liệu danh sách của tài liệu thầy; chuẩn hóa thành `kind: 'people' | 'room'` trước khi đưa vào UI.
- Khóa hội thoại dùng `JSON.stringify([kind, name])`. Có thể lọc gợi ý không phân biệt hoa thường nhưng **không đổi chữ hoa/thường của tên đích khi gọi API**.
- Một tên có thể là **chat riêng** hoặc **phòng**; phải hiện loại rõ ràng và không gộp trùng sai loại.
- Một mục phòng trong `GET_USER_LIST` **không chứng minh** còn là thành viên hoặc có quyền gửi. Quyền đến từ response/metadata hợp lệ và kiểm tra lại khi cần.
- Sau khi có danh sách, chọn một hội thoại chỉ gọi callback `onSelectConversation({kind, name})`; **không tự JOIN_ROOM** khi click item.
- Mọi kết quả `error`/`unknown` phải khác `success` với mảng rỗng; timeout của lệnh ghi không chứng minh máy chủ chưa xử lý.

### 3.2. Bản đồ lệnh liên quan

| Mục đích | Lệnh gửi trong WebSocket | Dữ liệu gửi | Phản hồi/nguồn cần nhận diện | Chủ phụ trách |
| --- | --- | --- | --- | --- |
| Danh sách hội thoại gần đây | `GET_USER_LIST` | `{}` | `GET_USER_LIST`, danh sách `name/type/actionTime` | Khôi, users API |
| Kiểm tra một tài khoản | `CHAT_CHECK_USER_EXIST` | `{user: username}` | `CHECK_USER_EXIST`, kiểm tra status hợp lệ | Khôi, users API |
| Tạo phòng | `CREATE_ROOM` | `{name}` | `CREATE_ROOM` + kết quả nghiệp vụ | Khôi, rooms API |
| Tham gia/tham gia lại | `JOIN_ROOM` | `{name}` | `JOIN_ROOM` + kết quả nghiệp vụ/metadata | Khôi, rooms API |
| Rời phòng | `OUT_ROOM` | `{name}` | `OUT_ROOM` + xác nhận/ lỗi | Khôi, rooms API |
| Đọc chi tiết/thành viên/lịch sử phòng | `GET_ROOM_CHAT_MES` | `{name, page}` | `GET_ROOM_CHAT_MES` theo phép thử được ghi trong tài liệu; `own`, `userList`, `chatData` hoặc dạng hợp lệ cần chuẩn hóa | Khôi cung cấp **một** adapter `loadRoom` cho cả Khôi và Kiệt |
| Mở lịch sử chat riêng sau kiểm tra | `GET_PEOPLE_CHAT_MES` | `{name, page}` | `GET_PEOPLE_CHAT_MES` | Kiệt, chat API |

Envelope WebSocket theo `docs/HOP_DONG.md`: `{"action":"onchat","data":{"event":"...","data":{...}}}`. Không tự thêm request ID mới vào giao thức. Tài liệu API có bất nhất ở ví dụ lịch sử phòng; sử dụng tên `GET_ROOM_CHAT_MES` đã được tài liệu nhóm ghi nhận là thử thành công, và kiểm chứng lại khi tích hợp.

## 4. Phân tích luồng giao diện F07–F10

### F07 - Nạp và làm mới danh sách

1. **Điểm vào:** phiên đã xác thực, vào `/chat` hoặc tải lại vùng danh sách.
2. **Đang tải:** sidebar hiển thị thông báo loading tại danh sách, không khóa chat đang mở. Dữ liệu trước đó có thể giữ khi refresh.
3. **Thành công có dữ liệu:** hiện từng `name`, phân biệt chat riêng/phòng, `actionTime` do máy chủ trả; chọn mục đổi hội thoại, không tự gửi lệnh JOIN.
4. **Thành công rỗng:** hiển thị hướng dẫn tìm người theo tên chính xác hoặc tạo/tham gia phòng.
5. **Lỗi tải đầu tiên:** nêu lỗi và `Thử lại`; **lỗi khi làm mới**: vẫn giữ danh sách cũ, báo có thể đã cũ. Không xóa toàn màn hình hay buộc đăng nhập lại khi chỉ lỗi vùng này.

### F08 - Gợi ý người/phòng theo tên từng phần

1. Tab `Người dùng` hoặc `Phòng` quyết định tập lọc từ `GET_USER_LIST` gần đây. Gõ `lan` có thể gợi ý `lan_chi` nếu item đã nằm trong tập được trả, không phải server trả danh bạ theo tiền tố.
2. Gợi ý có: chọn đúng item với `kind` tương ứng. Gợi ý không có: ghi rõ `Không có trong danh sách gần đây`, hướng dẫn thao tác theo tên đầy đủ.
3. Khi danh sách nguồn đang tải hoặc bị lỗi, chỉ hiện trạng thái loading/error của nguồn; đừng hiện `không tồn tại` khi dữ liệu chưa tải được. Có `Thử lại`.
4. Chọn tab người → CTA `Kiểm tra người dùng`; chọn tab phòng → CTA `Mở xác nhận tham gia`/`Tạo phòng mới`. Xóa ô tìm khôi phục tập gần đây.

### F09 - Kiểm tra người chưa có trong gợi ý

1. Người dùng nhập **username đầy đủ**, bấm `Kiểm tra người dùng`. Với chính tài khoản đang đăng nhập, hiện cảnh báo chọn chính mình; không mở chat gửi cho chính mình.
2. Đang chờ kết quả: khóa nút để tránh lặp. Gửi `CHAT_CHECK_USER_EXIST` và nhận `CHECK_USER_EXIST`.
3. `success` và tồn tại: mở chat riêng `kind:'people'`, sau đó tải lịch sử riêng; không giả một cuộc chat đã được lưu vào `GET_USER_LIST`.
4. `success` và không tồn tại: báo đúng tên chưa tồn tại theo phản hồi. Lỗi/timeout: trạng thái chưa kiểm tra được, giữ tên đã nhập để thử lại; **không** gộp lỗi với không tồn tại.

### F10 - Phòng chưa có trong gợi ý

1. Người dùng nhập **tên phòng đầy đủ**. Tìm kiếm chỉ cho thấy gợi ý gần đây; không có API `SEARCH_ALL_ROOMS` trong hợp đồng.
2. Bấm thao tác `Tham gia phòng` sẽ **mở dialog F14** để xác nhận thay đổi tư cách thành viên. Nhập/chỉnh tên **chưa gửi** `JOIN_ROOM`.
3. Chỉ sau khi xác nhận mới gửi `JOIN_ROOM`. Máy chủ báo không có phòng thì hiển thị lỗi; không tự tạo phòng. Tạo phòng dùng dialog F13, là hành động tách biệt.
4. Nếu tên phòng đã có trong danh sách gần đây, cho `Mở phòng hiện có` trước để tránh mục trùng; không coi dữ liệu gần đây là bằng chứng đã có quyền gửi.

## 5. Phân tích luồng phòng F13–F18

### F13 - Tạo phòng (`dialog`)

- **Điểm vào:** nút `Tạo phòng` ở sidebar hoặc màn chưa chọn chat. Form có `Tên phòng chính xác`, `Hủy`, `Đóng`, `Tạo phòng`; giải thích người tạo là chủ phòng sau khi máy chủ xác nhận.
- **Ràng buộc UI:** tên không được rỗng/toàn khoảng trắng; các giới hạn khác chỉ theo quy tắc server đã xác minh, không bịa độ dài tối đa.
- **Đang gửi:** ngăn submit lặp; `CREATE_ROOM {name}`. `Hủy/Đóng` sau lúc gửi chỉ đóng bề mặt UI, **không chứng minh request đã bị hủy**. Có thông báo yêu cầu đang chờ nếu chưa có kết quả.
- **Thành công:** cập nhật phòng theo phản hồi hợp lệ, tạo/chọn hội thoại `room`, nhận vai trò chủ từ metadata có thể đối chiếu, tải lịch sử qua adapter chung. Không thêm phòng giả trước xác nhận.
- **Thất bại:** trùng tên / lỗi server / kết nối / chưa xác định tách riêng; giữ lại tên đã nhập. Với timeout sau khi gửi, đối chiếu trạng thái trước khi gửi lại để tránh tạo trùng.

### F14 - Tham gia phòng (`dialog`)

- **Điểm vào:** nút `Tham gia phòng` hoặc F10; form hiển thị tên phòng và cảnh báo `Tham gia` có thể thay đổi tư cách thành viên.
- **Tác vụ:** chỉ khi xác nhận mới gửi `JOIN_ROOM {name}`; đang xử lý khóa submit lặp. Đóng khi đang chờ không hủy được request đã phát.
- **Thành công:** xác nhận membership từ server, cập nhật danh sách và thông tin thành viên, mở phòng và tải lịch sử. Không tự gửi bản nháp.
- **Lỗi:** tên rỗng, phòng không tồn tại, lỗi server, timeout/unknown; giữ tên để sửa/thử lại. Không tăng thành viên cục bộ hay bật quyền gửi khi chưa xác minh.
- **Trùng mục gần đây:** tránh tạo thêm một item trùng `kind/name`; có thể mở mục đã có nhưng quyền gửi vẫn phải được xác nhận.

### F15 - Xem thành viên (`panel`)

- **Điểm vào:** từ phòng đang chọn → `Thành viên`. Desktop mở panel bên phải; mobile hiển thị vùng thông tin phụ.
- **Dữ liệu:** dùng `userList` và `own` khi có trong kết quả đọc phòng (`GET_ROOM_CHAT_MES`, qua **một** `roomsApi.loadRoom` dùng chung). Hiển thị tổng số, tên, `Chủ phòng`/`Bạn · Thành viên` khi đủ dữ liệu, và thời điểm tải.
- **Loading / trống / lỗi:** danh sách tải lần đầu có loading; mảng rỗng **được server xác nhận** mới là trống; khi lỗi không hiện `0 thành viên` giả. Lỗi làm mới giữ kết quả cũ và nêu dữ liệu có thể cũ. Cho `Thử lại`/`Làm mới`.
- **Đóng:** quay về phòng hiện tại, không rời phòng, không làm mất nháp. Không giả định có push thay đổi thành viên realtime.

### F16 - Rời phòng đối với thành viên (`dialog`)

- **Điểm vào:** `Rời phòng` từ phòng/panel khi có quyền phù hợp. Hộp xác nhận nêu **đúng tên phòng** và cảnh báo bản nháp chưa gửi nếu `hasDraft(conversationKey)`.
- **Hủy/Đóng trước khi gửi:** giữ phòng, tư cách thành viên và bản nháp nguyên vẹn.
- **Xác nhận:** gửi `OUT_ROOM {name}` một lần; nút vào trạng thái đang xử lý. Không xóa nháp ngay khi bấm xác nhận.
- **Thành công được xác minh:** đánh dấu đã rời, bỏ phòng khỏi **danh sách đang tham gia** của UI, xóa nháp phòng đó theo cảnh báo đã đồng ý, khóa quyền gửi, điều hướng về danh sách/trạng thái chưa chọn. Rời **không xóa phòng trên server**.
- **Lỗi nghiệp vụ:** vẫn ở phòng, còn nháp, báo lý do và cho thử lại nếu an toàn. **Timeout / ngắt mạng sau phát lệnh:** trạng thái `unknown`, giữ nháp, tạm khóa gửi để tránh vi phạm quyền và đối chiếu lại bằng thao tác đọc khi có thể. Không tự `JOIN_ROOM` để kiểm tra bởi nó là thao tác ghi có thể tham gia lại.

### F17 - Chủ phòng không thể rời

- Nếu `own` hoặc metadata được xác nhận chỉ ra **người đang đăng nhập là chủ phòng**: `Rời phòng` disabled và hiện lý do; không có thao tác `Xóa phòng` hay `Chuyển chủ` thay thế.
- Khi vai trò `unknown`: không tự đánh dấu người dùng là chủ, không giả định được rời; có thể cho server quyết định bằng `OUT_ROOM` với xác nhận và phản hồi rõ ràng theo thiết kế, đồng thời xử lý kết quả chưa xác định an toàn.
- Dữ liệu `own` và `members` thiếu phải được phân biệt với rỗng; dùng cờ `ownerKnown/membersKnown`, không tùy tiện gán người đăng nhập làm owner.

### F18 - Tham gia lại phòng đã rời

- Sau khi đã rời thành công, người dùng phải chủ động mở dialog với tên chính xác và bấm `Tham gia lại`. Sau `JOIN_ROOM` thành công mới khôi phục membership, mở lịch sử và quyền gửi hợp lệ.
- Không tự động tham gia lại do click danh sách gần đây, không lấy cache cũ làm quyền hiện tại, **không khôi phục hoặc tự gửi bản nháp đã xóa khi rời thành công**.

## 6. Ma trận trạng thái bắt buộc khi triển khai

| Luồng / vùng | Bình thường / thành công | Loading / pending | Trống / kiểm tra hợp lệ | Lỗi / chưa xác định | Mẫu ảnh `TrangThai` |
| --- | --- | --- | --- | --- | --- |
| F07 danh sách | Có hội thoại, hiện loại và thời gian | Đang tải, không khóa toàn UI | Danh sách trả rỗng, CTA tìm/tạo/tham gia | Tải lỗi; làm mới lỗi thì giữ danh sách cũ | `32–35` |
| F08 lọc người | Gợi ý từ người gần đây | Nguồn gợi ý đang tải | Không có trong gần đây ≠ không tồn tại | Tải gợi ý lỗi, có `Thử lại` | `17–20` |
| F08 lọc phòng | Gợi ý từ phòng gần đây | Nguồn gợi ý đang tải | Không có trong gần đây, mở xác nhận JOIN riêng | Tải gợi ý lỗi, không auto JOIN | `21–24` |
| F09 username chính xác | Tồn tại → mở chat riêng | Đang kiểm tra, chặn lặp | Không tồn tại; chọn tài khoản chính mình | Không kiểm tra được, giữ tên | `25–29` |
| F13 tạo phòng | Máy chủ xác nhận → mở phòng | Đang gửi, chặn lặp | Tên trống | Trùng tên; server error; sau đóng còn pending; kết quả chưa rõ | `48–51`, `56–57` |
| F14 tham gia | Máy chủ xác nhận → cập nhật membership | Đang gửi, chặn lặp | Tên trống; trùng item UI không nhân bản | Phòng không tồn tại; server error; request còn chờ | `52–56`, `58` |
| F15 thành viên | Danh sách và owner theo metadata, có thời điểm tải | Đang tải/làm mới | Rỗng **có xác nhận** mới hiển thị 0 | Lỗi tải; lỗi refresh giữ bản cũ, báo có thể cũ | `44–47` |
| F16 rời phòng | Rời thành công → xóa nháp theo xác nhận, khóa gửi | OUT_ROOM đang xử lý | Hủy thì giữ nguyên phòng và nháp | Thất bại giữ nháp; unknown giữ nháp và đối chiếu | `60–63` |
| F17 vai trò | Chủ đã xác định → không thể rời | Chờ metadata/đối chiếu | Không coi metadata thiếu là không có chủ | Vai trò unknown → không tự nâng quyền | `59` |
| F18 tham gia lại | JOIN_ROOM xác nhận → phục hồi quyền | Đang gửi | Chưa xác nhận → không mở quyền gửi | Lỗi/unknown → không tự JOIN lại | Dùng trạng thái F14 |

**Dấu thời gian:** `actionTime` và thời gian thành viên trong ví dụ không có múi giờ rõ ràng; không tự chuyển timezone làm sai nghĩa. Gắn nhãn thời gian máy chủ cho đến khi giao thức được xác minh.

## 7. Kết nối với các thành viên và giới hạn tích hợp

- **Mẫn:** quản lý phiên xác thực, kết nối WebSocket, request queue/generation, hội thoại đang chọn. CV37 yêu cầu kiểm tra `authenticated` trước GET_USER_LIST, CREATE/JOIN/OUT; WebSocket OPEN đơn thuần không phải đã đăng nhập.
- **Khôi:** sở hữu sidebar, UI/adapter người và phòng; dự kiến triển khai `usersApi.getRecentConversations`, `usersApi.checkExists`, `roomsApi.loadRoom/create/join/leave` theo hợp đồng của nhóm sau CV37.
- **Kiệt:** sở hữu lịch sử và nháp. Callback `onSelectConversation({kind, name})` từ sidebar chỉ chọn hội thoại; chat lịch sử phòng **tái sử dụng `roomsApi.loadRoom(name, page)`**, không tự tạo adapter `GET_ROOM_CHAT_MES` thứ hai. Cảnh báo rời phòng hỏi `hasDraft(key)` và xóa nháp **sau rời thành công**.
- **Chuẩn hóa API:** `RoomReadResult` cần `roomName`, `messages`, `page`, `owner/members` khi có và cờ biết/chưa biết. Response thiếu trường không đồng nghĩa `[]`. Status phải phân biệt `success` / `error` / `unknown` với `business/connection/session/parse/timeout`.
- **An toàn bất đồng bộ:** Không để response trễ của phòng A cập nhật phòng B hoặc phiên người khác. Sau timeout của lệnh ghi, không tự gửi lại trên socket còn response cũ có thể đến; Mẫn xử lý generation/reconnect theo `docs/HOP_DONG.md`.

## 8. Kết quả đối chiếu và bằng chứng

### 8.1. Bằng chứng thiết kế đã kiểm tra tĩnh

| Mã | Hạng mục kiểm tra | Bằng chứng trong ZIP tài liệu | Kết quả **đối chiếu thiết kế** |
| --- | --- | --- | --- |
| TC37-01 | F07 sidebar, danh sách ban đầu/trống/lỗi/làm mới lỗi | `Desktop/03_F07_Hoi_thoai_chua_chon.png`; `TrangThai/32–35` | Đạt: đã xác định bốn trạng thái |
| TC37-02 | F08 gợi ý người/phòng có/không/tải/lỗi | `Mobile/03_F07-F08_Danh_sach_hoi_thoai.png`; `TrangThai/17–24` | Đạt: gợi ý chỉ trong danh sách gần đây |
| TC37-03 | F09 kiểm tra username chính xác | `TrangThai/25–29` | Đạt: có chờ, không tồn tại, lỗi, chính mình, tồn tại |
| TC37-04 | F10 không tự động JOIN khi gõ tìm phòng | `TrangThai/21–24`; `Desktop/10_F14_Tham_gia_phong_xac_nhan.png` | Đạt: có bước dialog xác nhận trước lệnh ghi |
| TC37-05 | F13 tạo phòng và trạng thái form | `Desktop/09_F13_Tao_phong.png`; `Mobile/07_F13_Tao_phong.png`; `TrangThai/48–51`, `56–57` | Đạt: có trống, pending, trùng, lỗi, xác nhận |
| TC37-06 | F14 tham gia phòng và tránh trùng UI | `Desktop/10_F14_Tham_gia_phong_xac_nhan.png`; `Desktop/14_F14_Phong_da_co_trong_danh_sach.png`; `TrangThai/52–56`, `58` | Đạt: xác nhận tác vụ ghi, không nhân đôi mục |
| TC37-07 | F15 panel thành viên, vai trò, refresh | `Desktop/06_F15_Thanh_vien_da_tai.png`; `Mobile/06_F15_Thanh_vien.png`; `TrangThai/44–47` | Đạt: đủ tải/trống/lỗi/stale |
| TC37-08 | F16 cảnh báo mất nháp và kết quả rời | `Desktop/11_F16_Roi_phong_xac_nhan.png`; `Mobile/15_F16_Roi_phong.png`; `TrangThai/60–63` | Đạt: hủy giữ nháp, chỉ xóa khi success |
| TC37-09 | F17 chủ phòng không thể rời, quyền chưa rõ | `Desktop/08_F13-F17_Phong_du_an_chu_phong.png`; `Desktop/13_F17_Chu_phong_khong_the_roi.png`; `TrangThai/59` | Đạt: chặn khi biết chủ, không tự đoán khi unknown |
| TC37-10 | F18 tham gia lại bằng xác nhận mới | `Desktop/12_F18_Tham_gia_lai_phong.png`; trạng thái F14 | Đạt: không tự phục hồi quyền hay nháp cũ |
| TC37-11 | Mobile back khác rời phòng / thoát phiên | `Mobile/05_F14-F19_Phong_chat.png`; `Mobile/06_F15_Thanh_vien.png`; `Mobile/15_F16_Roi_phong.png` | Đạt: ba hành động phân biệt được |
| TC37-12 | Giao thức và ranh giới quyền thành viên | Repo `README.md`, `docs/HOP_DONG.md`; ZIP `README.md`, `LUONG_GIAO_DIEN.md` | Đạt: tên lệnh, nghĩa của JOIN và nguồn membership đã được ghi rõ |

Các đường dẫn ảnh trong bảng **tính từ thư mục `FE_TachManHinh/` của ZIP tài liệu riêng**, không phải file được thêm vào repo trong PR CV37. Bằng chứng là **đối chiếu tĩnh tài liệu và PNG**, không phải ảnh chụp từ ứng dụng đã chạy.

### 8.2. Trạng thái thử nghiệm thực tế

| Kiểm tra | Trạng thái tại thời điểm làm CV37 | Ghi chú |
| --- | --- | --- |
| Đọc tài liệu, kiểm tra ảnh Desktop/Mobile/TrangThai F07–F10, F13–F18 | **Đã thực hiện** | Xem TC37-01 → TC37-12 |
| Kiểm tra source hiện tại có triển khai nghiệp vụ người/phòng chưa | **Đã kiểm tra tĩnh** | `frontend/src/services/usersApi.ts` và `roomsApi.ts` trong ZIP source đang để trống; `SidebarPlaceholder.tsx` vẫn là vùng mẫu |
| Click UI React thật, chạy tạo/tham gia/rời phòng qua WebSocket thật | **Chưa chạy trong CV37** | Thuộc các CV triển khai/tích hợp sau; không ghi `PASS` giả |
| Kiểm thử chủ phòng không thể rời bằng tài khoản thật | **Chưa chạy trong CV37** | Chờ tích hợp với metadata/permission thực |
| Kiểm thử xóa nháp sau OUT_ROOM thực tế | **Chưa chạy trong CV37** | Cần phối hợp chức năng nháp của Kiệt |
| Build/lint ứng dụng sau thay đổi CV37 | **Không áp dụng cho bản giao này** | Chỉ bổ sung Markdown, không sửa frontend/backend |

**Kết luận CV37:** Hoàn thành nội dung phân tích/đối chiếu cho F07–F10 và F13–F18, xác định đúng sidebar/panel/dialog, giới hạn gợi ý gần đây, kiểm tra tài khoản chính xác, `JOIN_ROOM` là lệnh ghi, trạng thái form, quyền chủ và cảnh báo nháp. Chưa xác nhận các tính năng đã hoạt động trên ứng dụng thật.

## 9. Thông tin PR để người kiểm tra chéo nghiệm thu

- **Nhánh / PR base:** `feat/khoi/cv37` → `develop`.
- **File thay đổi:** `docs/ROOM_UI.md` (mới). Không đẩy bộ ảnh tham chiếu, dữ liệu chat hoặc mã phiên lên GitHub trong CV37.
- **Tiêu đề PR gợi ý:** `docs: CV37 đặc tả luồng tìm kiếm và phòng`.
- **Link PR:** _Chưa có. Người tạo PR bổ sung URL thực tế tại đây hoặc trong phần mô tả PR sau khi push; không sử dụng link tự đặt._
- **Reviewer:** Trần Lê Minh Mẫn.
- **Checklist review:** [ ] F07/F08 không giả tìm toàn hệ thống; [ ] F09 `CHAT_CHECK_USER_EXIST` → `CHECK_USER_EXIST`; [ ] F10/F14/F18 chỉ JOIN sau xác nhận; [ ] F13–F16 đầy đủ pending/empty/error/unknown; [ ] F17 phân biệt owner-known và unknown; [ ] rời phòng bảo vệ nháp; [ ] không sửa code ngoài phạm vi.

**Các bước kiểm thử động dành cho CV sau:** đăng nhập phiên được phép → GET_USER_LIST → lọc theo loại → F09 kiểm tra tên đúng/sai → F13 tạo phòng → F14 JOIN → F15 làm mới thành viên → F16 hủy khi có nháp, sau đó xác nhận OUT → F18 JOIN lại → F17 kiểm tra vai trò chủ. Ghi kết quả thật (tài khoản test được phép, event, kỳ vọng/thực tế, ảnh đã che thông tin nhạy cảm) vào PR tương ứng; không dùng kết quả mô phỏng làm bằng chứng tích hợp.
