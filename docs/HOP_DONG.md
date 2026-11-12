# Hợp đồng ghép code App Chat

Chốt cách phối hợp frontend trước khi tách nhánh. Đây là **hợp đồng nội bộ đề xuất để viết code**, không bổ sung API máy chủ. Mẫn, Kiệt và Khôi hiện thực kiểu TS cụ thể tại CV02/CV20/CV38, dựa trên các quy tắc thống nhất dưới đây.

## 1. Chủ sở hữu và điểm nối

| Thành phần | Chủ chính | Người sử dụng |
|---|---|---|
| socketClient, dispatcher, phiên và kết nối lại | Mẫn | authApi, usersApi, roomsApi, chatApi |
| ConversationKey và hàm tạo khóa dùng chung | Mẫn, file utils/conversationKey.ts | Cả ba |
| usersApi.getRecentConversations/checkExists/checkOnline | Khôi | Sidebar Khôi và header Kiệt |
| roomsApi.loadRoom/create/join/leave và chuẩn hóa response phòng | Khôi | Rooms UI Khôi và lịch sử phòng Kiệt |
| chatApi.loadHistory/send và luồng nhận tin | Kiệt | ChatPage/MessageList/Composer |
| parser/serializer và nháp | Kiệt | Composer, MessageBubble, cảnh báo logout/rời phòng |

**Chỉ một adapter đọc phòng:** chatApi.loadHistory khi kind=room gọi roomsApi.loadRoom, không tự gửi/parse GET_ROOM_CHAT_MES lần nữa. Cùng một kết quả cấp cho lịch sử và metadata phòng. Khôi cung cấp stub chữ ký này ngay CV38, không bắt Kiệt chờ hoàn thành CV45 mới dựng UI.

Quyền sửa file không đồng nghĩa độc quyền đưa yêu cầu. Ai cần đổi hợp đồng gửi PR nhỏ, cả người dùng hợp đồng đó review trước. Không import store trực tiếp vào socketClient: service chuẩn hóa dữ liệu, hook/controller dispatch vào slice.

## 2. Dữ liệu chung

- ConversationRef: kind là people hoặc room, name giữ nguyên giá trị máy chủ. Khóa ổn định tạo bằng JSON.stringify([kind,name]); không nối chuỗi mơ hồ, không tự lowercase đích gọi API.
- RequestContext: sessionGeneration, connectionGeneration, conversationKey và page chụp lúc gửi. Generation chỉ là dữ liệu cục bộ, không thêm requestId vào giao thức server.
- Message: giữ id máy chủ nếu có, tên tác giả, to, kind, raw mes và createAt thật; clientMessageId lấy từ nội dung hợp lệ. Tin tạm dùng localId riêng, không giả id hoặc thời gian máy chủ.
- RoomReadResult: roomName, messages, page, owner/members khi response có, kèm cờ ownerKnown/membersKnown. Trường thiếu khác mảng rỗng. Không làm mất owner/members cũ chỉ vì trang lịch sử sau không có các trường đó.
- Membership: unknown, member, owner, left theo dữ liệu xác nhận; danh sách gần đây không chứng minh membership. CREATE/JOIN success hợp lệ hoặc metadata có thể đối chiếu mới xác nhận quyền. Chưa đủ dữ liệu thì không tự bật gửi phòng.
- API lỗi phân biệt nghiệp vụ, kết nối, hết phiên, parse, timeout/chưa xác định. Không biến lỗi thành mảng rỗng.

## 3. Props và callback giữa giao diện

| Nơi xuất | Dữ liệu/callback | Nơi nhận |
|---|---|---|
| Sidebar Khôi | onSelectConversation({kind,name}) | Mẫn giữ lựa chọn hiện tại và truyền vào ChatPage Kiệt |
| Mẫn | authStatus, connectionStatus, currentUser, sessionGeneration | Cả hai feature khóa thao tác theo trạng thái |
| usersApi/store Khôi | presence theo username: online/offline/unknown, checkedAt | Header chat Kiệt render nhãn, không tự gọi service khác |
| roomsApi/store Khôi | metadata, membership và RoomActions/MemberList | Kiệt gắn vùng nút phòng vào header của mình |
| Nháp Kiệt | hasAnyDraft(), hasDraft(key), clearAllDrafts(), clearDraft(key) hoặc action tương đương | Logout Mẫn và hộp rời phòng Khôi |
| messagesSlice Kiệt | unreadByConversation và markViewed(key) cục bộ | Sidebar Khôi render chỉ báo, mở hội thoại thì xóa |

Mẫn giữ khung trang; Kiệt giữ component nội dung chat; Khôi giữ sidebar và các panel/phòng. Mỗi người tự làm responsive của feature mình. Các tên hàm là chữ ký nội bộ dự kiến, không phải tên sự kiện API.

## 4. Ánh xạ sự kiện từ tài liệu thầy

| Lệnh gửi | data con | Event phản hồi | Chủ service |
|---|---|---|---|
| REGISTER | user, pass | REGISTER | Mẫn |
| LOGIN | user, pass | LOGIN | Mẫn |
| RE_LOGIN | user, code | RE_LOGIN | Mẫn |
| LOGOUT | Không có data con trong ví dụ | LOGOUT | Mẫn |
| GET_USER_LIST | {} | GET_USER_LIST | Khôi |
| CHAT_CHECK_USER_EXIST | user | CHECK_USER_EXIST | Khôi |
| CHAT_CHECK_USER_ONLINE | user | CHECK_USER_ONLINE | Khôi |
| CREATE_ROOM | name | CREATE_ROOM | Khôi |
| JOIN_ROOM | name | JOIN_ROOM | Khôi |
| OUT_ROOM | name | OUT_ROOM | Khôi |
| GET_ROOM_CHAT_MES | name, page | GET_ROOM_CHAT_MES theo phép thử trước | Khôi |
| CHAT_PEOPLE_GET_MES | name, page | CHAT_PEOPLE_GET_MES | Kiệt |
| SEND_CHAT | type: people/room, to, mes | SEND_CHAT vừa có thể nhận tin vừa có phản hồi | Kiệt |

Envelope theo bảng: {"action":"onchat","data":{"event":"...","data":{...}}}. LOGOUT là ngoại lệ không có data con theo ví dụ. Response status/event/data hoặc mes ngoài phải được kiểm tra theo từng lệnh.

Nguồn: [bảng API thầy](https://docs.google.com/spreadsheets/d/1-EFA-OXUCUIPP6CnAk4z0_ONS-3G9SVU/edit?gid=1040781536#gid=1040781536), bản nội dung đã lưu ngày 07/11/2026. Bảng hàng 11 dùng lẫn tên sự kiện; phép thử trước nhận GET_ROOM_CHAT_MES thành công với userList/chatData. Khi code phải lưu response thật để phát hiện nếu hợp đồng đã đổi. Lần rà tài liệu 08/11 không tái chạy chức năng máy chủ.

## 5. Hàng đợi, response trễ và gửi tin

Mẫn quản lý một socket mỗi phiên. Request đọc cùng event mà response không có khóa đủ được xếp hàng chung cho cả người gọi. Sau timeout, không gán response cũ cho request mới cùng event; đóng kết nối cũ, tạo generation mới, xác thực và tải lại khi cần. Vô hiệu hóa tác vụ cũ khi logout/đổi tài khoản.

SEND_CHAT là luồng đặc biệt: không dùng generic request() để resolve tin gửi khi nhận bất kỳ event SEND_CHAT. Một event có thể là tin người khác gửi. Thao tác socket.send không chứng minh máy chủ đã lưu. Kiệt giữ tin chưa xác nhận cho đến khi đối chiếu được bằng clientMessageId/id và đúng tác giả/hội thoại. Error thiếu khóa chỉ báo lỗi chung và giữ trạng thái không chắc, không gắn bừa vào một tin khi có nhiều tác vụ.

Chỉ gộp theo id hoặc mã đối chiếu đủ tin cậy. Hai tin giống chữ không phải bằng chứng trùng. Tin realtime thiếu id/thời gian cần hòa giải với lịch sử; không tạo timestamp máy chủ hoặc tự sửa tác giả. Không tự gửi lại sau reconnect.

## 6. Quy ước nội dung bắt buộc cần thử

Chuỗi mes mới dự kiến gồm tiền tố chính xác APPCHAT_RICH_V1 nối trực tiếp JSON, không thêm dấu phân cách khác. JSON có version:1, clientMessageId khác rỗng và runs là mảng {text,bold,italic,size}; size chỉ 12/14/16/18/24. Parser chỉ nhận đúng schema; text cũ/JSON lỗi/phiên bản lạ được render an toàn dưới dạng text, không chạy HTML.

Phương án đang đánh giá: trước khi nối tiền tố, thay mọi ký tự ngoài ASCII của chuỗi JSON bằng escape Unicode, giữ đúng các cặp surrogate của emoji. Đây là xử lý bên trong mes, không chỉ escape JSON request bên ngoài. Không khẳng định đã đạt trước khi CV27 thử hai tài khoản được phép, có mã tin duy nhất, đúng tác giả/đích và lịch sử sau RE_LOGIN.

Kiệt chốt các giới hạn frontend về độ dài, số runs và byte gói ở CV27–CV28 dựa trên phép thử, ghi đó là giới hạn nội bộ, không bịa giới hạn server. Không cắt âm thầm nội dung; quá giới hạn phải báo trước gửi.

## 7. Các hành vi dễ sai

- Enter gửi, Shift+Enter xuống dòng; isComposing/compositionstart/compositionend phải ngăn gửi nhầm khi bộ gõ tiếng Việt đang ghép ký tự. Enter chọn emoji/menu không lan sang Gửi.
- Nháp chỉ ở bộ nhớ; đổi chat/mất mạng giữ, reload/logout mất theo đặc tả. Đừng hứa phục hồi nháp sau refresh.
- sessionStorage chỉ giữ username/code để RE_LOGIN; không lưu mật khẩu. Đừng coi socket OPEN là đã xác thực. Xóa dữ liệu phiên cũ trước khi render tài khoản mới.
- GET_USER_LIST là gần đây. Tìm một phần tên chỉ lọc tập đó; kiểm tra username đầy đủ không phải tìm toàn hệ thống theo một phần tên. JOIN là thao tác ghi, không chạy chỉ vì gõ tìm.
- Khi kết thúc đăng xuất, Mẫn dispatch `sessionCleared` kể cả khi máy chủ chưa xác nhận. Kiệt và Khôi dùng action này trong `extraReducers` để đặt lại state chat, nháp và phòng nếu lưu trong Redux. ChatLayout được tháo khi về đăng nhập. Khi tích hợp nháp, nối `hasAnyDraft()` vào nút đăng xuất để xác nhận trước khi gửi LOGOUT
- Presence là kết quả kiểm tra có thời điểm, lỗi là unknown. Chưa xem là dữ liệu cục bộ, không phải đã đọc/đã giao server.
- UI thu hẹp là cùng website React, không phải làm app Android/iOS. Back trong UI khác rời phòng/logout.

## 8. Fetch và media

CV10 chỉ chuẩn bị wrapper Fetch có kiểm tra response.ok/lỗi/hủy, có thể thử bằng response giả. Chỉ nối HTTP thật nếu nguồn hợp lệ phục vụ nhu cầu thật. Không thêm request tải cấu hình chỉ để có Fetch và không gọi đó là API thầy. Thiếu endpoint HTTP nghiệp vụ không chặn WebSocket.

F25–F27 vẫn có điều kiện. Chưa có upload/storage được phép thì ẩn nút hoặc ghi dự kiến, không giả đã upload bằng preview cục bộ, không gửi đường dẫn file máy hay base64 lớn. Nếu muốn triển khai media đầy đủ phải thêm việc và chia lại phạm vi.

## 9. Điều kiện trước khi merge main

F01–F24 được kiểm thử trên commit ứng viên; build/typecheck và lint nếu có script đạt. Kiệt/Khôi nghiệm thu ứng viên trước CV18; CV36/CV54 kiểm tra nhanh sau merge main, không tạo vòng phụ thuộc bắt main phải có trước khi được phát hành. Có lỗi chặn thì sửa lại từ nhánh việc vào develop.

Không có API/read receipt/upload chưa xác minh nào được dựng thành thành công giả. Các điểm kỹ thuật còn thiếu là điều kiện nghiệm thu cần làm trong kế hoạch, không phải yêu cầu người dùng phải đoán thêm API.


## 10. Chữ ký giao tiếp dùng chung

### Chọn hội thoại

Sidebar của Khôi gọi callback:

```ts
onSelectConversation(conversation: ConversationRef): void
```

Ví dụ dữ liệu:

```ts
{ kind: 'people', name: 'minh_an' }
{ kind: 'room', name: 'nhom_hoc' }
```

Mẫn giữ hội thoại đang chọn tại lớp ghép ứng dụng và truyền
cho ChatPage của Kiệt. Không tự phát JOIN_ROOM khi chỉ chọn
một mục trong danh sách.

### Dữ liệu và giao diện chat (CV20)

- [types/message.ts](../frontend/src/types/message.ts) dùng lại `ConversationRef`, `ConversationKey` và `ApiResult` của CV02. Dùng `createConversationKey` cho lịch sử và nháp để phân biệt người và phòng cùng tên.
- `Message` giữ `name` của tác giả, `to`, loại, `mes` thô và ID/giờ máy chủ nếu có. `PendingMessage` giữ mã cục bộ riêng cùng trạng thái chờ, chưa xác nhận hoặc thất bại.
- `ChatPageProps` nhận hội thoại được chọn và trạng thái phiên/kết nối từ khung. `ComposerProps` nhận nháp và quyền gửi, trả `onDraftChange(conversation, draft)` hoặc `onSend(conversation, draft)`. Phần xử lý gửi chụp hội thoại và nháp lúc nhận callback, kiểm tra quyền rồi tạo mã đối chiếu. Việc chọn hội thoại tiếp tục dùng callback của sidebar ở trên.
- Mock và service thật dùng chung `ChatService`. `loadHistory(conversation, page)` trả hội thoại, số trang và danh sách tin. Trang bắt đầu từ 1, trang rỗng kết thúc lịch sử, còn lỗi trả qua `ApiResult`. Lịch sử phòng lấy từ kết quả chuẩn hóa của `roomsApi.loadRoom`; fixture dùng chung mock đọc phòng.
- `send({ conversation, content })` trả kết quả tác vụ gửi. Chỉ chuyển sang đã lưu khi đối chiếu được đúng tin. Mock minh họa nhánh chưa xác nhận, không gọi WebSocket.
- [Fixture chat](../frontend/src/fixtures/chat.ts) có text cũ, emoji, định dạng hợp lệ, JSON lỗi, text trông giống HTML, lịch sử nhiều trang và cặp người/phòng trùng tên. Đây là dữ liệu mẫu để dựng UI và kiểm tra tình huống trong các CV sau.

### Kiểm tra người dùng

Khôi triển khai:

```ts
checkExists(user: string): Promise<ApiResult<boolean>>
```

Service giả và service thật phải có cùng chữ ký.

- success + true: tài khoản tồn tại.
- success + false: tài khoản không tồn tại.
- error: có lỗi rõ ràng, không được coi thành không tồn tại.
- unknown: chưa xác định được kết quả, UI cho kiểm tra lại.

Lệnh gửi CHAT_CHECK_USER_EXIST nhận phản hồi CHECK_USER_EXIST.
socketClient phải ánh xạ đúng hai tên này.

### Đọc phòng dùng chung

Khôi giữ duy nhất:

```ts
loadRoom(
  name: string,
  page: number,
): Promise<ApiResult<RoomReadResult>>
```

Kiệt dùng lại hàm này cho lịch sử phòng, không tạo adapter
GET_ROOM_CHAT_MES thứ hai trong chatApi.

RoomReadResult cần được Khôi và Kiệt thống nhất trong CV38/CV20:
- Tên phòng và trang đang đọc.
- Danh sách tin chuẩn hóa.
- Chủ phòng/thành viên nếu response có.
- Phân biệt trường chưa có dữ liệu với danh sách rỗng.

Trước khi có API thật, Khôi cung cấp stub cùng chữ ký.
Không tạo kiểu Message/Room khác nhau ở từng service.

### Trạng thái và lỗi

Các feature dùng chung kiểu trong frontend/src/types/api.ts.

ApiResult là kết quả đã được service chuẩn hóa, không phải
response JSON thô của máy chủ.

Timeout của tác vụ ghi hoặc mất kết nối sau khi gửi phải giữ
kết quả unknown khi chưa đủ bằng chứng. Không tự gửi lại.

SEND_CHAT vừa dùng nhận tin vừa có thể có phản hồi:
không coi mọi event SEND_CHAT là xác nhận tin vừa gửi.

### Quyền giữ file

- Mẫn: types/api.ts, utils/conversationKey.ts và transport.
- Kiệt: types/message.ts, chat/editor và parser/serializer.
- Khôi: types/user.ts, types/room.ts, users/rooms service.

Đổi hợp đồng phải trao đổi với người đang sử dụng và cập nhật
cả tài liệu lẫn kiểu TypeScript.
