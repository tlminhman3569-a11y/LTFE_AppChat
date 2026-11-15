# CV27 — Kiểm tra rich text qua API

## Cách thử

Ngày 15/11/2026, dùng hai tài khoản thử được cấp trên hai kết nối WebSocket riêng. Gửi chat riêng bằng `SEND_CHAT`, với `type: "people"`. Mỗi tin có một `clientMessageId` khác nhau. Nội dung gồm tiền tố `APPCHAT_RICH_V1` và JSON phiên bản 1, với tiếng Việt, emoji 😊 và 🚀, xuống dòng, một đoạn đậm cỡ 18 và một đoạn nghiêng cỡ 14.

So sánh nguyên chuỗi `mes` và JSON đã giải mã ở phiên nhận. Sau đó đóng kết nối phiên nhận, mở kết nối mới, xác thực bằng `RE_LOGIN` và đọc trang 1 qua `GET_PEOPLE_CHAT_MES`. Tìm lại từng tin theo mã và đúng cặp người gửi, người nhận.

## Kết quả

| Ca thử | Byte của `mes` (UTF-8) | Nhận realtime | Đọc trang 1 sau `RE_LOGIN` |
| --- | ---: | --- | --- |
| Escape Unicode, nội dung mẫu | 267 | Chuỗi và JSON khớp | Tìm thấy, chuỗi khớp |
| Escape Unicode, thêm 1.024 ký tự ASCII | 1.291 | Chuỗi và JSON khớp | Tìm thấy, chuỗi khớp |
| Unicode trực tiếp, nội dung mẫu | 237 | Chuỗi và JSON khớp | Không tìm thấy mã tin khớp |

`RE_LOGIN` và lệnh đọc lịch sử đều thành công. Cả ba ca được nhận realtime đúng cặp tài khoản. Không quan sát thấy lỗi gửi hoặc socket đóng trong cửa sổ theo dõi của các ca này.

## Kết luận thử nghiệm CV27

Trong hai ca thử escape Unicode, chuỗi `mes` giữ nguyên ở bản tin realtime và khi đọc lại lịch sử sau `RE_LOGIN`. Kết quả này là căn cứ để CV28 lựa chọn cách mã hóa rich text. Phương án đã thử chuyển từng đơn vị UTF-16 ngoài ASCII thành `\uXXXX` trong JSON bên trong `mes`, giữ đủ hai đơn vị của emoji.

Ca Unicode trực tiếp chưa đạt tiêu chí đọc lại trang 1. Lượt này chưa xác định được nguyên nhân hoặc trạng thái bản lưu. Mức 1.291 byte là kích thước lớn nhất đã thử thành công trong lượt này. Giới hạn máy chủ và luồng phòng chưa được xác minh.
