# Ứng dụng Chat thời gian thực

> Đồ án cuối kỳ môn **Lập trình Front-end** – xây dựng ứng dụng nhắn tin sử dụng React, TypeScript và công nghệ Socket, có kết nối API do giảng viên cung cấp.

## 1. Thông tin nhóm

| STT | Thành viên |
| --- | --- |
| 1 | Trần Lê Minh Mẫn |
| 2 | Cao Tuấn Kiệt |
| 3 | Trương Hoàng Minh Khôi |

## 2. Giới thiệu đề tài

Ứng dụng hướng đến trải nghiệm trò chuyện theo thời gian thực. Bên cạnh tin nhắn văn bản, nhóm dự kiến hỗ trợ gửi và hiển thị hình ảnh, video, cũng như soạn thảo tin nhắn có định dạng (**rich text**) như in đậm, in nghiêng, gạch chân và chuyển chữ hoa/chữ thường.

**Lưu ý:** Đây là mô tả mục tiêu và định hướng công nghệ của đồ án. Các tính năng chỉ được đánh dấu hoàn thành sau khi nhóm triển khai, kiểm thử và xác nhận tương thích với API thực tế.

## 3. Chức năng dự kiến

- Giao diện danh sách cuộc trò chuyện và khung nhắn tin.
- Gửi, nhận và hiển thị tin nhắn theo thời gian thực thông qua Socket.
- Kết nối API do giảng viên cung cấp bằng **Fetch API** (không sử dụng Axios).
- Soạn tin nhắn văn bản có định dạng: **đậm**, *nghiêng*, <u>gạch chân</u>, chữ hoa/chữ thường.
- Chọn, gửi và hiển thị hình ảnh hoặc video khi API/backend hỗ trợ cách lưu trữ và truyền tệp phù hợp.
- Quản lý trạng thái giao diện, danh sách hội thoại và tin nhắn.
- Xử lý các trường hợp tải dữ liệu, mất kết nối và lỗi gửi tin.

## 4. Công nghệ sử dụng

| Thành phần | Công nghệ | Vai trò |
| --- | --- | --- |
| Frontend | React + TypeScript (`.tsx`, `.ts`) | Xây dựng giao diện, quản lý kiểu dữ liệu |
| Công cụ phát triển | Vite | Chạy môi trường phát triển và đóng gói ứng dụng |
| Quản lý trạng thái | Redux Toolkit | Quản lý trạng thái ứng dụng *(dự kiến)* |
| Kết nối REST API | Fetch API | Gọi API do giảng viên cung cấp |
| Thời gian thực | WebSocket hoặc Socket.IO | Trao đổi sự kiện tin nhắn; lựa chọn theo tài liệu API/Socket thực tế |
| Backend nhóm phát triển | Node.js + Express + TypeScript | Xử lý nghiệp vụ bổ sung nếu phạm vi đồ án cần *(dự kiến)* |
| Giao diện | HTML, CSS | Bố cục và kiểu hiển thị |

**Phân biệt:** API do giảng viên cung cấp và backend do nhóm phát triển là hai phần riêng. Không tự giả định địa chỉ API, endpoint, sự kiện Socket, phương thức xác thực hoặc định dạng upload khi chưa có tài liệu.

## 5. Kiến trúc tổng quan

```text
Người dùng
    |
    v
Frontend (React + TypeScript + Vite)
    |-- Components / Pages
    |-- Redux Toolkit (nếu áp dụng)
    |-- Services: Fetch API ---------> API do giảng viên cung cấp
    |-- Services: Socket -----------> Socket server theo tài liệu kết nối
    |
    `-- Backend do nhóm xây dựng (nếu cần)
          `-- Xử lý nghiệp vụ / tệp đính kèm theo thiết kế thực tế
```

## 6. Cấu trúc thư mục đề xuất

> Cấu trúc bên dưới là **định hướng tổ chức mã nguồn**, có thể điều chỉnh theo repository thực tế. Các tệp `.tsx` chứa JSX; `.ts` dành cho TypeScript không chứa JSX.

```text
ltfe_ck_appchat/
|-- frontend/
|   |-- public/                        # Tài nguyên tĩnh
|   |-- src/
|   |   |-- assets/                    # Ảnh, icon
|   |   |-- components/
|   |   |   `-- MessageBubble.tsx
|   |   |-- features/
|   |   |   |-- auth/                   # LoginPage.tsx (neu can)
|   |   |   |-- chat/                   # ChatPage.tsx, MessageList.tsx
|   |   |   |-- editor/                 # RichTextEditor.tsx
|   |   |   `-- upload/                 # UploadPreview.tsx
|   |   |-- store/                      # Redux Toolkit
|   |   |   |-- index.ts                # configureStore
|   |   |   |-- hooks.ts                # Typed hooks
|   |   |   `-- slices/
|   |   |       |-- authSlice.ts        # Nếu có đăng nhập
|   |   |       |-- conversationsSlice.ts
|   |   |       `-- messagesSlice.ts
|   |   |-- services/
|   |   |   |-- apiClient.ts            # Fetch API wrapper
|   |   |   |-- chatApi.ts
|   |   |   |-- uploadApi.ts            # Nếu có upload
|   |   |   `-- socketClient.ts         # Socket
|   |   |-- types/                      # message.ts, api.ts
|   |   |-- utils/                      # parser.ts, serializer.ts
|   |   |-- routes/                     # Router (neu can)
|   |   |-- styles/
|   |   |-- App.tsx
|   |   `-- main.tsx
|   |-- .env.example
|   |-- tsconfig.json
|   |-- vite.config.ts
|   `-- package.json
|-- backend/                            # Node.js, Express, TS (dự kiến)
|   |-- src/
|   |   |-- routes/
|   |   |-- controllers/
|   |   |-- services/
|   |   |-- socket/
|   |   |-- middleware/
|   |   |-- types/
|   |   `-- server.ts
|   |-- tsconfig.json
|   `-- package.json
|-- docs/
|-- README.md
`-- .gitignore
```


### Redux Toolkit nằm ở đâu?

Thư mục **`src/store/`** chứa cấu hình và logic Redux Toolkit:

- `store/index.ts`: tạo Redux store bằng `configureStore`, kết hợp các reducer.
- `store/hooks.ts`: khai báo typed hooks (`useAppDispatch`, `useAppSelector`).
- `store/slices/authSlice.ts`: thông tin đăng nhập (chỉ cần nếu ứng dụng có chức năng xác thực).
- `store/slices/conversationsSlice.ts`: danh sách hội thoại và hội thoại đang chọn.
- `store/slices/messagesSlice.ts`: danh sách tin nhắn, trạng thái gửi, nhận và lỗi.

**Luồng dữ liệu dự kiến:** `services/chatApi.ts` gọi API bằng `fetch`, `services/socketClient.ts` nhận sự kiện thời gian thực; kết quả được cập nhật vào Redux thông qua `dispatch`. Các component React `.tsx` đọc state bằng `useAppSelector`. Tệp ảnh/video thực tế nên được upload bằng cơ chế riêng, thay vì lưu `File` trực tiếp trong Redux.

Trong `main.tsx`, bọc `<App />` bằng `<Provider store={store}>` từ `react-redux` để các component sử dụng Redux. Đây là kiến trúc đề xuất, chưa khẳng định code hiện tại đã có đủ các file.

Nếu repository hiện tại chỉ có dự án Vite ở thư mục gốc thì **không cần tự tạo `frontend/`**. Có thể giữ `src/`, `public/`, `package.json` và `vite.config.ts` ngay tại thư mục gốc rồi bổ sung thư mục theo nhu cầu.

## 7. Hướng dẫn cài đặt và chạy

### Yêu cầu

- Node.js và npm phiên bản tương thích với Vite đang sử dụng trong dự án.
- Tài liệu và thông tin kết nối API/Socket do giảng viên cung cấp.

### Chạy frontend

Mở terminal tại thư mục chứa `package.json` của frontend (thư mục gốc nếu tạo project bằng Vite, hoặc `frontend/` nếu tổ chức theo mô hình hai thư mục):

```bash
npm install
npm run dev
```

Sau đó mở địa chỉ local do Vite hiển thị trong terminal.

### Cấu hình môi trường (đề xuất)

Tạo file `.env` dựa trên `.env.example` **nếu dự án có sử dụng các biến dưới đây**:

```env
VITE_API_BASE_URL=https://your-api-host.example
VITE_SOCKET_URL=https://your-socket-host.example
```

Các địa chỉ trên chỉ là **giá trị mẫu**, cần thay bằng địa chỉ thật từ giảng viên hoặc máy chủ do nhóm triển khai. Biến có tiền tố `VITE_` được đưa vào mã phía trình duyệt, vì vậy **không đặt mật khẩu, API key bí mật hoặc khóa riêng** trong các biến này.

### Chạy backend riêng (nếu có)

```bash
cd backend
npm install
npm run dev
```

Lệnh cuối chỉ sử dụng được sau khi nhóm tự cấu hình script `dev` trong `backend/package.json`.

## 8. Xử lý tin nhắn có định dạng khi API chỉ hỗ trợ plain text

Theo yêu cầu hiện tại, API chỉ nhận nội dung tin nhắn dạng văn bản thông thường. Một giải pháp **cần thử nghiệm với API thực tế** là chuyển cấu trúc nội dung có định dạng thành **chuỗi JSON**, sau đó gửi chuỗi đó như một tin nhắn text.

Ví dụ nội dung trước khi chuyển thành chuỗi:

```json
{
  "format": "rich-text-v1",
  "segments": [
    { "text": "Xin chào ", "bold": false },
    { "text": "mọi người", "bold": true }
  ]
}
```

Ví dụ TypeScript:

```ts
type MessageSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

type RichTextPayload = {
  format: 'rich-text-v1';
  segments: MessageSegment[];
};

const payload: RichTextPayload = {
  format: 'rich-text-v1',
  segments: [
    { text: 'Xin chào ' },
    { text: 'mọi người', bold: true },
  ],
};

const messageText = JSON.stringify(payload);
// Truyền messageText vào trường nội dung của API theo tài liệu giảng viên.
```

Khi nhận tin nhắn, phía frontend có thể kiểm tra xem chuỗi có đúng định dạng `rich-text-v1` hay không. Nếu hợp lệ thì hiển thị các đoạn văn bản theo thuộc tính định dạng; nếu không thì hiển thị như tin nhắn plain text thông thường.

**Các điểm cần lưu ý:**

- Cần xác nhận API có giữ nguyên chuỗi JSON và hỗ trợ độ dài tin nhắn phù hợp không.
- Không phải API plain text nào cũng cho phép gửi tệp. Hình ảnh/video thường cần luồng upload riêng hoặc URL đã được lưu trữ; phải đối chiếu tài liệu thực tế.
- Không hiển thị HTML do người dùng nhập bằng `dangerouslySetInnerHTML` khi chưa xử lý an toàn. Ưu tiên render nội dung thông qua component React.
- Cần xử lý lỗi khi giải mã JSON và bảo đảm các tin nhắn văn bản cũ vẫn hiển thị bình thường.

## 9. Phân công công việc

Nhóm thống nhất phân chia theo năng lực và tiến độ. Có thể tham khảo:

| Thành viên | Phần việc đề xuất |
| --- | --- |
| Trần Lê Minh Mẫn | Giao diện React/TSX, thiết kế các trang và component |
| Cao Tuấn Kiệt | Fetch API, tích hợp Socket, quản lý trạng thái |
| Trương Hoàng Minh Khôi | Backend bổ sung, rich text, ảnh/video và kiểm thử |

Đây là **phân công đề xuất**, không phải xác nhận công việc thực tế của từng thành viên.

## 10. Kiểm thử và tiêu chí hoàn thành

- [ ] Khởi chạy frontend bằng `npm run dev`.
- [ ] Kết nối API giảng viên thành công bằng Fetch API.
- [ ] Gửi và nhận tin nhắn giữa các phiên làm việc bằng Socket.
- [ ] Hiển thị đúng tin nhắn plain text và rich text.
- [ ] Gửi và hiển thị ảnh/video theo cơ chế backend được hỗ trợ.
- [ ] Xử lý mất kết nối, phản hồi lỗi và dữ liệu không hợp lệ.
- [ ] Kiểm tra giao diện trên màn hình desktop và thiết bị di động.
- [ ] Hoàn thiện tài liệu API, hướng dẫn chạy và phần trình bày demo.

## 11. Ghi chú

README này được viết dựa trên phạm vi đồ án mà nhóm đang hướng tới, **chưa phải tài liệu xác nhận toàn bộ tính năng đã triển khai**. Khi nhận được tài liệu API và hoàn thiện source code, nhóm nên cập nhật lại cấu trúc thư mục, lệnh chạy, biến môi trường, giao thức Socket và danh sách chức năng đúng với phiên bản cuối cùng.
