# Bộ ảnh thử CV51 cho CV57

Các ảnh `valid-jpeg.jpg`, `valid-png.png`, `valid-webp.webp` là ảnh nhỏ, hợp lệ, do CV51 tạo ra, không chứa dữ liệu riêng tư. Dùng để kiểm thử chọn/xem trước và tải qua Cloudinary sau khi UI được ghép.

| File | Mục đích / kết quả mong đợi |
| --- | --- |
| `valid-jpeg.jpg` | Ảnh JPEG thật, nhận đúng MIME JPEG |
| `valid-png.png` | Ảnh PNG thật, nhận đúng MIME PNG |
| `valid-webp.webp` | Ảnh WebP thật, nhận đúng MIME WebP |
| `empty.jpg` | 0 byte: phía client phải chặn, không POST |
| `not-image.txt` | Không phải ảnh: phía client phải chặn, không POST |
| `fake-jpeg.jpg` | File **text** giả đuôi .jpg: bước MIME của client có thể chấp nhận, Cloudinary preset phải từ chối nội dung thật; không SEND_CHAT |
| `room-rights-cases.json` | Dữ liệu ma trận dự kiến 12 trạng thái quyền phòng cho CV57; **không phải kết quả đã chạy** |

Tạo file dung lượng biên tại `frontend/`:

```powershell
node scripts/cv51-generate-size-fixtures.mjs
```

Sau khi chạy sẽ có `generated/valid-exactly-5MiB.png` (5.242.880 byte) và `generated/invalid-over-5MiB.png` (5.242.881 byte). Cả hai đều là PNG hợp lệ; generator thêm một ancillary chunk vào ảnh gốc để tạo chính xác số byte. File 5 MiB kiểm tra riêng điều kiện không chặn theo **dung lượng client**, không bảo đảm Cloudinary sẽ giữ nguyên metadata hoặc chấp nhận mọi điều kiện tài khoản. File lớn không đưa vào Git.

Chạy kiểm tra nhanh không đụng mạng và không cần `.env.local`:

```powershell
node --experimental-strip-types --test scripts/check-cv51.mjs
```

File này không thay ảnh chứng minh UI/API. Sau khi có CV56/CV60/CV62, thực hiện các ca trong `docs/CV051_CHECKLIST_CV57.md` bằng hai tài khoản được phép và ghi kết quả thật.
