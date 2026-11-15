# CV27 — Kiểm tra rich text qua API

## Cách tái lập

Dùng Node.js có WebSocket tích hợp (đã chạy API thật trên Node.js 24.21.0, Node.js 22 chưa được xác minh bằng API thật) và hai tài khoản thử được phép gửi tin cho nhau. Trong `frontend`, đặt biến môi trường `APPCHAT_PROBE_USER`, `APPCHAT_PROBE_PASS`, `APPCHAT_PROBE_PEOPLE` và `APPCHAT_PROBE_PEER_PASS` trong phiên Terminal, rồi chạy:

```powershell
node scripts/check-rich-text.mjs
node scripts/check-rich-text.mjs --sizes
node scripts/check-rich-text.mjs --boundary
```

Lệnh đầu chạy ba vòng, mỗi mẫu dùng hai kết nối mới. Hai lệnh sau thử các mức kích thước và hai mốc sát nhau. Chế độ `--boundary` nghỉ 2 giây sau khi đóng kết nối. Nhật ký ghi kích thước UTF-8 của `mes` (`bytes`) và toàn bộ JSON gửi qua WebSocket (`frameBytes`). Script gửi tin mẫu thật. Với rich text, `clientMessageId` là trường cấp gốc của JSON ngay sau tiền tố `APPCHAT_RICH_V1` trong `mes`. Với văn bản thuần, mã mẫu nằm đầu chuỗi. Mỗi lần gửi tạo mã riêng, với cỡ chữ 18 đậm và 14 nghiêng cho các mẫu rich text.

Script so chuỗi `mes` phía nhận realtime và đối chiếu lịch sử theo ID máy chủ nếu có hoặc mã mẫu, đồng thời kiểm tra đúng cặp tài khoản. Đóng socket nhận rồi mở lại bằng `RE_LOGIN`. Script ghi rõ nếu phải dùng `LOGIN` thay thế. Đọc trang 1 và 2 ngay sau mở lại, rồi đọc cả hai lần nữa sau 3 giây. Nếu tìm thấy tin mẫu đã đổi nội dung, script in phần đầu của chính `mes` đó để đối chiếu.

Script thoát với mã 1 khi thiếu cấu hình, lượt thử gặp lỗi, nội dung realtime bị lệch hoặc lịch sử sau 3 giây thiếu tin hay có nội dung khác. Quy tắc này áp dụng cả khi khảo sát mẫu dự kiến lỗi.

## Kết quả thử Unicode trực tiếp

Lượt cô lập từng mẫu bắt đầu lúc **21:56:30 ngày 15/11/2026 (UTC+7)**, Node.js `v24.21.0`. Tài liệu nhóm ghi 50 tin/trang. Trong các ca hoàn chỉnh, trang 1 thực tế có 18–29 tin và trang 2 rỗng.

| Mẫu | Realtime khớp | Lịch sử khớp sau `RE_LOGIN` | Socket gửi đóng mã 1002 |
| --- | ---: | ---: | ---: |
| Rich text ASCII | 3/3 | 3/3 | 0/3 |
| Rich text tiếng Việt có dấu, không emoji | 3/3 | 3/3 | 0/3 |
| Rich text ASCII có xuống dòng | 3/3 | 3/3 | 0/3 |
| Văn bản thuần tiếng Việt có dấu, không emoji | 3/3 | 3/3 | 0/3 |
| Rich text chỉ có emoji trong đoạn đang thử | 3/3 | 0/3 | 2/3 |
| Rich text trộn tiếng Việt, emoji và xuống dòng | 3/3 | 0/3 | 3/3 |

Cả sáu tin rich text chứa emoji trực tiếp đều có ID ở phía nhận realtime. Hai trang lịch sử không có bản ghi khớp ID hoặc mã mẫu, kể cả sau 3 giây. Số tin trong lịch sử không tăng ở các ca này. Lượt thử chưa tìm thấy bản ghi của mẫu để in `mes` thô và chưa xác minh được nguyên nhân bên trong máy chủ.

## Kết quả thử kích thước

Lượt đo bắt đầu lúc **21:59:09 ngày 15/11/2026 (UTC+7)**. Số byte tính trên toàn bộ chuỗi `mes` sau escape, gồm tiền tố và JSON, trước khi đóng gói WebSocket.

| Byte của `mes` | Realtime | Lịch sử |
| ---: | --- | --- |
| 1.291, 1.536, 1.792, 1.920, 2.000 | Khớp | Khớp sau `RE_LOGIN` |
| 2.048 | Phía gửi nhận lỗi, phía nhận không có tin mẫu | Không tìm thấy ở trang 1 hoặc 2 |

Hai lượt đo sát ngưỡng 2.000/2.001 byte bắt đầu lúc 22:00:19 và 22:00:38 (UTC+7) dừng ở bước mở socket hoặc đăng nhập trước khi gửi. Chưa xác định được mức tối đa chính xác trong khoảng trên 2.000 và dưới 2.048 byte.

## Kết luận thử nghiệm CV27

Kết quả là căn cứ để CV28 escape Unicode thành `\uXXXX` bên trong JSON của `mes`, giữ đủ hai đơn vị UTF-16 của emoji. Đề xuất cho CV28 dùng **1.900 byte của `mes` sau escape** làm giới hạn tạm thời cho chat riêng. Mức này chừa 100 byte so với mẫu 2.000 byte đã gửi và đọc lại thành công. Tên người nhận dài hơn làm tăng kích thước JSON gửi đi. Chưa xác minh máy chủ giới hạn theo `mes` hay toàn bộ JSON, nên cần đo cả hai khi thử lại với tên dài. Khi vượt mức, báo người dùng rút ngắn để tránh làm mất nội dung hoặc cắt hỏng JSON.

Văn bản thuần tiếng Việt có dấu của CV26 đã đọc lại nguyên vẹn trong cả ba ca không emoji. Lượt này chưa thử emoji ở chế độ văn bản thuần. Giới hạn và hành vi chat phòng chưa được xác minh.
