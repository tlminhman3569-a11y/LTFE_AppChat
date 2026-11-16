# CV12 — Kiểm tra đăng nhập và phiên

Bản kiểm tra lấy từ `develop` tại `ed45caa`, đã có CV11. Hai ca lỗi đăng nhập và đăng ký nằm trong commit `9463837`. Ca vòng đời listener và phản hồi đến muộn nằm trong phần 2 của CV12

## Chạy test trong WebStorm

Mở Terminal tại `frontend` rồi chạy

```powershell
npm test -- scripts/cv12-auth-errors.test.ts scripts/cv12-auth-lifecycle.test.ts
npm test
npm run build
npm run lint
```

Hai file CV12 đạt **4/4**. Toàn bộ Vitest đạt **60/60**, build và lint đều đạt. Test dùng socket giả nên không cần tài khoản API

## Kiểm tra trên web

Chạy `npm run dev` trong `frontend`, mở địa chỉ Vite hiển thị và dùng tài khoản thử. Các ca dưới đây đã chạy qua Chrome với WebSocket giả trên nhánh CV12

| Ca | Cách thử | Mong đợi và kết quả đã thấy |
| --- | --- | --- |
| Sai mật khẩu | Nhập đúng username, sai mật khẩu, sau đó nhập lại mật khẩu đúng | Báo lỗi ở trang đăng nhập, lần thử đúng vào được `/chat` |
| Trùng tên đăng ký | Đăng ký với username thử đã tồn tại | Báo **Tên đăng nhập đã được sử dụng** dưới ô tên |
| Tải lại trang chat | Đăng nhập rồi nhấn F5 trên cùng tab | Gửi một `RE_LOGIN`, lưu mã mới và vẫn ở `/chat` |
| Mã phiên bị từ chối | Sửa riêng `reLoginCode` trong `appchat.session` ở DevTools rồi nhấn F5 | Về `/login`, hiện thông báo hết phiên và xóa phiên đã lưu |
| Đăng xuất khi còn nháp | Gõ nháp, bấm **Đăng xuất → Hủy**, mở lại hộp rồi chọn **Tiếp tục** | Hủy giữ nháp. Tiếp tục gửi một `LOGOUT` rồi về `/login`, đăng nhập lại thấy ô soạn trống |
| Đăng xuất khi mất kết nối | Ngắt kết nối lúc đang ở `/chat`, sau đó xác nhận đăng xuất | Về `/login`, xóa phiên và báo chưa có xác nhận từ máy chủ |

Ca mã phiên sai cũng đã được đối chiếu riêng trên `localhost:5173` với API thật. App về `/login` và hiện **Phiên đã hết hạn, vui lòng đăng nhập lại**. Khi chụp bằng chứng, tránh để lộ mã phiên trong DevTools

## StrictMode và phản hồi đến muộn

- Vitest mô phỏng thứ tự chạy effect, dọn effect rồi chạy lại. Lượt thử cũ bị hủy, lần mất kết nối tiếp theo chỉ gửi một `RE_LOGIN`
- Chrome chạy App thật ở chế độ phát triển và đếm `subscribeStatus`. StrictMode đăng ký 2 lần và dọn 1 lần trong lần mount đầu, còn đúng 1 listener. Gỡ App xong còn 0 listener
- Vitest giữ phản hồi `RE_LOGIN` ở trạng thái chờ, đăng xuất rồi mới trả thành công. Phiên vẫn ở trạng thái chưa đăng nhập, storage trống và bộ đếm kết nối lại giữ nguyên

## Dòng ghi vào Ket_qua

| Mã | Bản kiểm tra | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| CV12 | `feat/man/cv12`, nền `ed45caa`, phần 1 `9463837` | Auth 4/4, Vitest 60/60, build và lint đạt. StrictMode còn 1 listener khi App chạy và 0 sau khi gỡ. Phản hồi đến muộn không mở lại phiên | `CV12-phien-het-han.png`, `CV12-dang-xuat-mat-mang.png` |
