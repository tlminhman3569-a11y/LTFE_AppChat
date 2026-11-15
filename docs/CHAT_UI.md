# CV19 — Luồng tin nhắn và thiết kế giao diện chat

**Phụ trách** Cao Tuấn Kiệt · **Kiểm tra chéo** Trương Hoàng Minh Khôi · **Hạn theo kế hoạch** 04/11/2026.

CV19 đặc tả vùng nội dung của `/chat`, từ tiêu đề hội thoại đến lịch sử, bong bóng tin và ô soạn. Các luồng F11, F12 và F19–F24 là đầu vào cho những CV triển khai tiếp theo.

## Bố cục và loại hội thoại

- **Desktop** hiển thị sidebar bên trái và vùng chat bên phải. Khi chưa chọn hội thoại, vùng chat hướng dẫn chọn hoặc tìm hội thoại. Khi đã chọn, tiêu đề ở trên, danh sách tin cuộn ở giữa và ô soạn ở dưới.
- **Mobile** hiển thị danh sách trước, sau đó mở vùng chat một cột. Nút **Quay lại danh sách** giữ nháp trong phiên và chỉ đổi màn hình. Giữ nút gửi và thanh soạn dễ chạm khi bàn phím mở.
- **Chat riêng** hiện tên người và nhãn **Chat riêng**. Trạng thái online/offline/chưa xác định lấy từ dữ liệu kiểm tra của Khôi. Lịch sử dùng `GET_PEOPLE_CHAT_MES`.
- **Phòng chat** hiện tên phòng, nhãn **Phòng chat**, thông tin thành viên khi đã tải và các nút phòng theo quyền. Bong bóng ghi rõ tác giả. Lịch sử dùng chung kết quả `roomsApi.loadRoom` với metadata và thành viên. Chọn phòng chỉ mở hội thoại.

Khóa hội thoại gồm loại và tên, kể cả khi người dùng và phòng trùng tên. Bong bóng tin của mình và của người khác đặt ở hai phía, hiện giờ máy chủ khi có. Tin tạm dùng mã cục bộ và không gán giờ hoặc ID máy chủ giả.

## Mở hội thoại, lịch sử và tin đến

| Luồng | Hành vi giao diện |
| --- | --- |
| F11 — Mở hoặc chuyển hội thoại | Đổi tiêu đề theo hội thoại đã chọn. Phân biệt đang tải, chờ lượt tải, chưa có tin và tải lỗi có nút **Thử lại**. Kết quả về muộn chỉ cập nhật hội thoại gốc nếu còn xác định được đúng yêu cầu và phiên. Khôi phục nháp theo khóa hội thoại khi quay lại. |
| F12 — Tải tin cũ | Tải trang 1 khi mở. **Xem tin cũ hơn** hoặc cuộn tới đầu để tải trang kế tiếp. Khi tải thêm, giữ tin đang xem và vị trí cuộn. Gộp theo ID máy chủ khi có. Trang rỗng báo hết lịch sử. Lỗi tải thêm có nút thử lại và giữ danh sách hiện tại. |
| F22 — Tin mới | Chỉ đưa tin vào hội thoại khi xác định được đúng loại và đích. Tin riêng xác định người đối thoại từ người gửi/người nhận và tài khoản hiện tại. Tin phòng dùng tên phòng đích. Nếu thiếu dữ liệu thì đối chiếu lại lịch sử. Đang gần cuối thì cuộn xuống. Đang đọc tin cũ thì giữ vị trí và hiện **Có tin mới**. Tin đến hội thoại khác tăng số **chưa xem** cục bộ và xóa số đó khi mở xem. |
| F23 — Hiển thị nội dung | Render nội dung có định dạng hợp lệ theo từng đoạn, giữ xuống dòng. Tin cũ, cấu trúc lỗi hoặc phiên bản lạ hiển thị dạng văn bản an toàn. Không chạy HTML. Tin thiếu ID được đối chiếu với lịch sử, không gộp chỉ vì trùng nội dung. |

## Soạn và gửi

- **F19 — Editor.** Có nhập văn bản, emoji, đậm, nghiêng và cỡ chữ 12/14/16/18/24 px. Xem định dạng ngay trong ô soạn và giữ vùng chọn khi dùng thanh công cụ. Theo quy ước thiết kế, Enter gửi và Shift+Enter xuống dòng. Enter trong bộ gõ tiếng Việt hoặc khi thao tác menu không kích hoạt gửi. Vô hiệu hóa **Gửi** khi nội dung rỗng hoặc toàn khoảng trắng, chưa có quyền gửi, phiên chưa sẵn sàng hoặc mất kết nối. Giữ nháp riêng từng hội thoại trong bộ nhớ của phiên.
- **F20 — Gửi.** Kiểm tra phiên, kết nối, quyền gửi và đích. Chụp nội dung và đích tại lúc gửi để đổi hội thoại hoặc gõ tiếp không ảnh hưởng thao tác đang chờ. Mỗi lần gửi hợp lệ tạo một tác vụ `SEND_CHAT` đúng loại `people` hoặc `room`, với `clientMessageId` trong nội dung `APPCHAT_RICH_V1`.
- **F21 — Trạng thái gửi.** Hiện **Đang chờ xác nhận** khi đã gửi yêu cầu. Nếu hết thời gian hoặc thiếu phản hồi đối chiếu được, hiện **Chưa xác nhận**. Chỉ hiện **Gửi thất bại** cho tin có lỗi khớp tác vụ. Lỗi thiếu khóa báo chung và giữ nội dung để sửa hoặc thử lại. Chỉ hiện **Đã lưu** khi đối chiếu được bản lưu của đúng tin, tác giả và hội thoại. `SEND_CHAT` cũng mang tin đến, nên một sự kiện bất kỳ không đủ làm xác nhận. Không có nhãn **Đã giao** hay **Đã đọc**.
- **F24 — Mất kết nối.** Báo offline, khóa gửi mới, giữ nháp và giữ tin chưa xác nhận. Khi kết nối và xác thực lại, tải lịch sử để đối chiếu. Cho người dùng chủ động thử lại nếu cần, kèm cảnh báo có thể trùng tin. Không tự gửi lại.

## Điểm ghép với các phần khác

- **Kiệt** phụ trách nội dung chat, lịch sử, hiển thị tin, editor, nháp, gửi/nhận và số chưa xem cục bộ. Sidebar nhận số chưa xem từ phần chat.
- **Khôi** phụ trách sidebar, tìm người/phòng, kiểm tra trạng thái người dùng, quyền/thành viên và hành động tạo, tham gia, rời phòng. Kiệt hiển thị dữ liệu đã cấp và đặt các nút phòng của Khôi vào header.
- **Mẫn** phụ trách khung trang, phiên và kết nối. Sidebar báo hội thoại được chọn qua `onSelectConversation`. Khung truyền lựa chọn vào vùng chat. Luồng đăng xuất của Mẫn và luồng rời phòng của Khôi dùng trạng thái nháp do Kiệt cung cấp.

## Đối chiếu thiết kế

- **Desktop** `04_F11-F19_Chat_rieng_lich_su_va_ban_nhap.png` thể hiện tiêu đề, nút tải tin cũ, bong bóng và thanh soạn bên cạnh sidebar.
- **Mobile** `04_F11-F19_Chat_rieng.png` và `05_F14-F19_Phong_chat.png` thể hiện điều hướng một cột và nút **Thành viên** riêng cho phòng.
- **TrangThai** nhóm `36–43` mô tả lịch sử và cuộn. Nhóm `68–75` mô tả chờ xác nhận, chưa xác nhận, lỗi, bản lưu, editor, thử lại và nội dung không hỗ trợ. Mẫu `77_F05-F24_Chat_rieng_mat_ket_noi_giu_nhap.png` thể hiện nháp còn trong ô soạn khi nút gửi bị khóa.

Nguồn nghiệp vụ gồm dòng CV19 trong `AppChat_PhanCong_NgayChuan.xlsx`, mục CV19 trong `PHAN_CONG_CHI_TIET_CV01_CV54.md`, `README.md` và `LUONG_GIAO_DIEN.md` trong bộ AppChat_TaiLieu, [hợp đồng ghép code](HOP_DONG.md) và bộ mẫu `FE_TachManHinh`.
