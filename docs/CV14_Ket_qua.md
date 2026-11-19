# CV14 — Kiểm thử chéo phòng và thành viên

## Bản đã thử

- Người kiểm tra Trần Lê Minh Mẫn, ngày 19/11/2026
- Nhánh test/man/cv14, base develop tại 5d0cb1d
- Giao diện chạy trên Chrome, dùng API thật của thầy
- Tài khoản A và B là hai tài khoản test được cấp trong cuộc trò chuyện
- Phòng thử doan_test_cv14_20261119 được tạo trong lượt kiểm tra này và còn trên máy chủ
- Nhánh CV49 đang trỏ cùng 5d0cb1d, chưa có phần bàn giao kiểm thử riêng để đối chiếu

## Kết quả API thật

| Ca | Thao tác | Kết quả quan sát |
| --- | --- | --- |
| Tạo phòng | A tạo phòng thử | Máy chủ xác nhận, phòng mở được |
| Chủ phòng | A mở Thành viên | Đúng tên chủ, nút Rời phòng bị khóa |
| Trùng tên | B tạo đúng tên phòng của A | Hiện Room Exist or Error, giữ form |
| Tham gia | B tham gia phòng thử | Mở đúng phòng, bảng có hai thành viên và đúng chủ |
| Hủy rời | B nhập nháp, mở Rời phòng rồi Hủy | Nháp còn nguyên, vẫn ở phòng |
| Rời thành công | B xác nhận rời | Bỏ chọn phòng, phòng chuyển sang Phòng đã rời |
| Tham gia lại | B bấm mục đã rời rồi xác nhận | membership là member, chỉ có một mục phòng trong Tất cả hội thoại |
| Nháp sau rời | B mở lại sau JOIN | Nháp phòng đã rời được xóa |
| Phòng không tồn tại | B nhập tên thử chưa tạo rồi JOIN | Hiện Room not found, giữ form |

Các ca trên dựa trên thao tác giao diện và phản hồi quan sát được, phần đếm frame được bổ sung ở lượt kiểm tra bên dưới

## Lỗi cần gửi Khôi

### GET_USER_LIST có phòng tên rỗng làm không tải được danh sách

Bản tái hiện 5d0cb1d, tài khoản test B

1. Đăng nhập tài khoản B và mở /chat
2. Chọn nguồn API thật
3. Danh sách báo Tên hoặc loại hội thoại thứ 34 không hợp lệ
4. Đọc lại GET_USER_LIST thấy status success, 44 bản ghi, mục 34 có name là chuỗi rỗng sau trim và type bằng 1

Ở lượt đầu trước khi tạo phòng thử, lỗi nằm ở mục 33 nên số thứ tự phụ thuộc dữ liệu mới

Không ghi tên các hội thoại khác vào tài liệu

Cần Khôi đối chiếu dữ liệu thật và thống nhất cách xử lý bản ghi hỏng để vẫn truy cập các hội thoại hợp lệ, đồng thời báo phần dữ liệu bị bỏ qua thay vì nhận toàn bộ danh sách thành công sạch

Thao tác CREATE/JOIN phòng thử vẫn chạy khi danh sách lỗi và mục đã xác nhận cục bộ vẫn xuất hiện

## Kiểm tra tự động

Chạy trong frontend

~~~powershell
node scripts/check-cv44.mjs
node scripts/check-cv45.mjs
node scripts/check-cv46.mjs
node scripts/check-cv47.mjs
npm test
npm run build
npm run lint
~~~

Kết quả lần chạy 19/11

- CV44 42/42
- CV45 25/25
- CV46 35/35
- CV47 8/8
- Vitest 81/81
- Build và lint đạt

Bộ script phòng dùng giả lập, kết quả này chưa chứng minh timeout API thật

## Bằng chứng

Ảnh kiểm thử được đính kèm trong PR

- CV14-chu-phong-API-that.jpg
- CV14-tham-gia-lai-API-that.jpg
- CV14-loi-danh-sach-API-that.jpg
- CV14-giu-nhap-phong-khac.jpg

## Bổ sung thử timeout trên giao diện

Tạm thay request JOIN_ROOM của tên cv14_timeout_gia_lap bằng SocketRequestError timeout sau gửi, không gửi lệnh này lên máy chủ

Form hiện chưa rõ máy chủ đã xử lý hay chưa, khóa nút Tham gia phòng và ghi nhận một lần gọi service. Đã khôi phục request thật sau ca này

Đây là thử giao diện với lỗi giả lập, chưa chứng minh máy chủ thật bị timeout

## Lượt kiểm tra bổ sung

Theo dõi WebSocket.send trên tab kiểm tra, chỉ đếm CREATE_ROOM, JOIN_ROOM và OUT_ROOM, không lưu mật khẩu hoặc mã phiên

| Ca | Kết quả |
| --- | --- |
| Mở CREATE rồi Hủy | 0 CREATE_ROOM |
| Xác nhận CREATE trùng tên hai lần liên tiếp | 1 CREATE_ROOM, máy chủ từ chối trùng |
| Mở JOIN phòng đã rời rồi Hủy | Số JOIN_ROOM không tăng |
| Xác nhận JOIN hai lần liên tiếp | 1 JOIN_ROOM |
| Hủy OUT sau khi nhập nháp | Số OUT_ROOM không tăng |
| Xác nhận OUT hai lần liên tiếp | 1 OUT_ROOM, khóa Gửi khi pending |
| OUT success, đóng hộp lúc pending | Kết quả vẫn cập nhật thành left |
| Rời phòng hiện tại | Nháp ở doan_test_20261107 còn nguyên |
| JOIN success, đóng hộp lúc pending | Membership cập nhật member, vẫn ở phòng khác đang xem |

Để thử đóng hộp lúc pending, giữ lại phản hồi API thật tại lớp service trong tab, đóng hộp rồi mới chuyển phản hồi về component. Đây là trì hoãn cục bộ, không phải độ trễ tự nhiên của máy chủ

Một lượt OUT đầu tiên trả lỗi nghiệp vụ dù trạng thái cục bộ còn member, nháp vẫn được giữ. Sau khi gửi JOIN thật để xác nhận lại tư cách thành viên, lượt OUT tiếp theo thành công. Chưa đủ dữ liệu kết luận nguyên nhân lệch trạng thái, cần Khôi đối chiếu thêm nếu tái hiện

Sau kiểm tra đã khôi phục request và WebSocket.send của tab

## Cách kiểm tra lại trên giao diện

1. Chạy npm run dev trong frontend, mở /chat và chọn API thật
2. Dùng A tạo phòng thử riêng và B tham gia đúng tên
3. Ở B nhập nháp phòng khác, chuyển sang phòng thử và nhập nháp mới
4. Mở Thành viên rồi Rời phòng, thử Hủy trước và xác nhận sau
5. Mở phòng khác kiểm tra nháp còn, sau đó tham gia lại phòng thử và kiểm tra nháp cũ của phòng vừa rời đã xóa
6. Dùng DevTools Network lọc socket chat, đối chiếu CREATE_ROOM, JOIN_ROOM, OUT_ROOM, chỉ đếm lượt gửi
7. Dùng A kiểm tra nút Rời phòng bị khóa

Ca timeout dùng giả lập như phần trên để nhóm có thể kiểm tra lặp lại mà không phụ thuộc thời điểm mạng bị ngắt

## Kết luận bàn giao kiểm thử

Đã hoàn thành lượt kiểm thử chéo trên 5d0cb1d, có kết quả đạt và lỗi cần Khôi xử lý

Lỗi danh sách tên rỗng cần Khôi sửa và gửi lại commit để kiểm tra hồi quy. Lượt OUT lệch trạng thái được ghi để theo dõi, chưa gán nguyên nhân

CV49 đang trỏ cùng bản đã thử tại thời điểm kiểm tra. Nếu Khôi bổ sung code hoặc bàn giao CV49 sau đó, cần chạy lại các ca chịu ảnh hưởng

Chưa có kết quả timeout tự nhiên từ máy chủ thật. Ca timeout hiện là lỗi giả lập trên giao diện, có kiểm tra trạng thái chưa xác định và khóa gửi lại
