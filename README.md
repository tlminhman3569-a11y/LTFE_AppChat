# App Chat

Đồ án xây dựng website chat bằng **React + TypeScript**, kết nối API WebSocket của thầy. Giao diện nền sáng, đơn giản, sử dụng trên máy tính và trình duyệt điện thoại.

> Dự án đang triển khai. Các chức năng dưới đây là phạm vi dự kiến, chưa phải danh sách đã hoàn thành.

## Chức năng

- Đăng ký, đăng nhập, khôi phục phiên và đăng xuất.
- Chat riêng, chat phòng, xem lịch sử và nhận tin mới.
- Gợi ý người/phòng từ hội thoại gần đây; kiểm tra người dùng theo tên chính xác.
- Tạo, tham gia, rời phòng và xem thành viên.
- Soạn văn bản, emoji, **đậm**, *nghiêng* và thay đổi cỡ chữ.
- Xử lý mất kết nối, lỗi gửi và bản nháp trong phiên.

Ảnh/video là phần mở rộng nếu đủ thời gian và có dịch vụ lưu trữ phù hợp. Không triển khai file đính kèm trong phạm vi hiện tại.

## Công nghệ

- React, TypeScript/TSX, Vite.
- Redux Toolkit, React Router.
- WebSocket trình duyệt để kết nối API thầy.
- Fetch API cho tác vụ HTTP hợp lệ khi phát sinh; không thay WebSocket bằng Fetch.

## Cấu trúc dự kiến

```text
ltfe_ck_appchat/
|-- frontend/
|   |-- public/
|   `-- src/
|       |-- assets/
|       |-- components/
|       |-- features/
|       |   |-- auth/
|       |   |-- chat/
|       |   |-- users/
|       |   |-- rooms/
|       |   |-- editor/
|       |   `-- upload/       # Mở rộng có điều kiện
|       |-- hooks/
|       |-- store/
|       |   `-- slices/
|       |-- services/
|       |-- types/
|       |-- utils/
|       |-- routes/
|       |-- styles/
|       |-- App.tsx
|       `-- main.tsx
|-- backend/                 # Dự kiến, chưa triển khai
|-- docs/                    # Đặc tả, thiết kế và phân công
|-- README.md
`-- .gitignore
```

## Thành viên và kế hoạch

| Thành viên | Phụ trách chính |
|---|---|
| Trần Lê Minh Mẫn | Nền tảng, tài khoản, phiên và kết nối API |
| Cao Tuấn Kiệt | Hội thoại, lịch sử, gửi nhận tin và editor |
| Trương Hoàng Minh Khôi | Tìm người/phòng, quản lý phòng và thành viên |

Thời gian: **04–25/11/2026**. Mốc kết nối API: **11/11/2026**. Mỗi người thực hiện cả giao diện, logic và kiểm thử trong phần mình.

## Quy trình làm việc

Tạo nhánh công việc từ `develop` → mở pull request vào `develop` → kiểm tra chéo → merge. Sau nghiệm thu, mở pull request từ `develop` sang `main`.

Chi tiết CV01–CV54, luồng F01–F27 và điểm nối giữa các phần được quản lý trong bộ tài liệu dự án, lưu tại `docs/` khi đưa lên repo.

## API và lưu ý

- WebSocket: `wss://chat.longapp.io.vn/chat/chat`.
- [Tài liệu API của thầy](https://docs.google.com/spreadsheets/d/1-EFA-OXUCUIPP6CnAk4z0_ONS-3G9SVU/edit?gid=1040781536#gid=1040781536).
- [Trang đăng nhập tham chiếu](https://chat.longapp.io.vn/login) và [trang chat tham chiếu](https://chat.longapp.io.vn/chat) là URL giao diện, không phải endpoint REST.

Rich text cần kiểm chứng khả năng lưu/nhận qua trường `mes`; không giả định client mẫu hiểu định dạng riêng của nhóm. Backend riêng chưa thuộc phần triển khai chính và không thay thế API thầy. Không commit mật khẩu, mã phiên hoặc dữ liệu chat riêng lên GitHub.

## Chạy dự án

Sau khi frontend được khởi tạo bằng Vite và có các script tương ứng:

```bash
cd frontend
npm install
npm run dev
```

Kiểm tra bản build bằng `npm run build`. Cấu hình thực tế và yêu cầu môi trường được cập nhật khi khởi tạo source code.
