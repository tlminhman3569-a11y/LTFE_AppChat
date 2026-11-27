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

## CV15 — Hành trình phiên và kết nối

Kiểm tra ngày 23/11/2026 trên nhánh `test/man/cv15`, nền `develop` tại `6a7aec0`

Chạy từ Terminal WebStorm trong `frontend`

```powershell
npm test -- scripts/cv15-journey.test.ts
```

Bốn ca mới dùng adapter auth, storage, Redux và watcher reconnect của dự án, giả lập các hàm socket

| Ca | Kết quả |
| --- | --- |
| LOGIN → lưu phiên → mất kết nối → RE_LOGIN → LOGOUT | Mã được đổi, lịch sử còn sau reconnect; logout xóa storage, messages, rooms và yêu cầu phòng |
| Logout trước timer reconnect 500 ms | Không gửi RE_LOGIN, hết thời gian chờ vẫn chưa đăng nhập |
| Hết ba lượt tự động rồi bấm thử lại hai lần | Chỉ thêm một lượt, nhận mã mới và đăng xuất được |
| Dọn watcher khi RE_LOGIN đang chờ | Phản hồi muộn không ghi mã hoặc tăng reconnectCount, không còn listener/timer của watcher |

Test CV15 đạt 4/4, toàn bộ Vitest 101/101, build và lint đạt

### Đối chiếu giao diện với API thật

- Đăng nhập tài khoản thử rồi mở phòng có sẵn, nhập nháp và bấm Đăng xuất → Hủy: vẫn ở /chat, nháp còn nguyên
- Bấm Đăng xuất → Tiếp tục: về /login, storage đã xóa, messages và rooms trống
- Chủ động ngắt socket cục bộ trong lúc đang chat: app gửi RE_LOGIN, nhận kết quả từ chối và về /login với thông báo hết phiên, dữ liệu phiên cũ được dọn

Lượt ngắt socket trên API thật chưa xác nhận được nhánh RE_LOGIN thành công. Nhánh thành công và hết lượt thử lại hiện được kiểm tra bằng giả lập trong Vitest

Để thử lại trên web, chạy npm run dev, đăng nhập bằng tài khoản thử và làm các bước trên. Khi thử mất mạng thật bằng DevTools Offline, kết quả phụ thuộc mã phiên máy chủ còn hiệu lực hay không. Nếu mã bị từ chối, kết quả đúng là về đăng nhập và khóa gửi

Kết quả phía trên là lượt kiểm tra phần 1 ngày 23/11, trước khi CV46 vào develop. Kết quả sau khi tích hợp nằm ở phần tiếp theo


### Phần 2 — sau khi tích hợp CV46

Kiểm tra ngày 24/11/2026, ghép develop tại `4e4427f` vào `test/man/cv15`, có bản sửa CV46 từ PR #45 (`9b30b90`)

Các ca mới kiểm tra qua watcher reconnect, adapter phòng và Redux thật, giả lập phản hồi socket

- RE_LOGIN thành công vẫn giữ lịch sử, quyền member cũ chuyển thành unknown và loadedAt được xóa để đọc lại thành viên
- Nếu OUT đã bị từ chối thì reconnect và GET_ROOM_CHAT_MES có tên tài khoản vẫn không bỏ cờ leaveRejected, không tự phục hồi quyền member
- JOIN mới thành công mới xác nhận lại member và bỏ cờ lỗi rời phòng

Chạy từ Terminal WebStorm trong frontend

```powershell
npm test -- scripts/cv15-journey.test.ts
```

Đối chiếu giao diện sau khi tích hợp bằng script CV46 có sẵn

```powershell
# Terminal 1, trong frontend
npm run dev

# Terminal 2, trong frontend
python scripts/cv46-chat-integration/run_chat_e2e.py --url http://localhost:5173/chat
```

Script cần Python, Playwright và Chromium như hướng dẫn trong `scripts/cv46-chat-integration/README.md`. Nếu máy chưa có Chromium của Playwright, cài theo hướng dẫn hoặc truyền `--chromium-path` tới Chrome đang có

Lượt chạy lại trên /chat đạt 23/23: OUT lỗi giữ nháp, hiện cảnh báo và khóa Gửi; mở form không tự JOIN; xác nhận chỉ thêm một JOIN; pending chặn trùng; JOIN success mới bỏ cảnh báo và mở Gửi, nháp vẫn còn và không tự SEND_CHAT. Component, service và Redux là của ứng dụng, phản hồi máy chủ do socket giả lập cung cấp

#### RE_LOGIN với API thật

Lượt thử giao diện ngày 24/11 đã đăng nhập bằng tài khoản thử được phép, tải lại cùng tab rồi ngắt socket cục bộ

| Thao tác | Kết quả quan sát |
| --- | --- |
| Tải lại /chat trong cùng tab | RE_LOGIN thành công, vẫn authenticated và connected, storage còn mã phiên hợp lệ |
| Ngắt socket sau khi khôi phục | Tự RE_LOGIN thành công, vẫn ở /chat, reconnectCount tăng lên 1 |

Bằng chứng: `CV15-reload-API-that.png` và `CV15-reconnect-API-that.png`, đính kèm khi tạo PR

Đây là kết quả của lượt thử này, không khẳng định mọi mã phiên đều còn hiệu lực. Nếu server từ chối mã thì ứng dụng vẫn phải về đăng nhập và khóa gửi như phần 1. Ngắt socket cục bộ chưa thay thế ca mất mạng hệ điều hành kéo dài

Test API thật chạy lại qua Vitest, không dùng socket giả. Chỉ giả lập sessionStorage trong môi trường Node để service lưu mã như trên trình duyệt. Test đăng nhập, ngắt socket, RE_LOGIN, cập nhật mã trong storage, đọc GET_USER_LIST rồi LOGOUT để dọn phiên

```powershell
$account = Get-Credential -Message 'Nhập tài khoản thử API App Chat'
if ($account) {
    $env:APPCHAT_PROBE_USER = $account.UserName
    $env:APPCHAT_PROBE_PASS = $account.GetNetworkCredential().Password
    try {
        npm test -- scripts/cv15-live.test.ts
    } finally {
        Remove-Item Env:APPCHAT_PROBE_USER, Env:APPCHAT_PROBE_PASS
    }
}
```

Kỳ vọng 1 test đạt. Test tự bỏ qua nếu không có đủ hai biến môi trường, lượt bỏ qua không tính là đã kiểm tra API thật. Chỉ dùng tài khoản thử không có phiên khác đang sử dụng vì bài test kết thúc bằng LOGOUT

Để đối chiếu trên web: đăng nhập tài khoản thử → mở /chat → tải lại cùng tab, chờ thanh trên báo kết nối và tài khoản vẫn đăng nhập. Muốn thử mất kết nối, mở DevTools Network, bật Offline cho tới khi app báo gián đoạn rồi trả về No throttling, chờ reconnect. Kiểm tra ở /chat nếu server nhận mã; nếu hết lượt thì bấm Thử kết nối lại. Không chụp hoặc sao chép mã phiên vào bằng chứng

Kết quả phần 2: CV15 journey 5/5, test API thật 1/1, luồng phòng trên /chat 23/23, toàn bộ Vitest 102 đạt và 1 bỏ qua khi không nhập tài khoản, build và lint đạt

Chưa xác nhận lỗi nền tảng mới cần sửa trong lượt kiểm tra phần 2


## Kiểm tra lại CV09 sau CV50 — 27/11/2026

Nền develop tại cbed122, sau khi PR #52 được merge. Lượt này kiểm tra phần kết nối của Mẫn, không thay kết quả đối chiếu pending/history của Kiệt trong CV50-08

### Kết quả trên giao diện

Đăng nhập bằng tài khoản thử, mở chat riêng test001 đã có 5 tin lịch sử và nhập nháp chưa gửi. Chủ động đóng socket và chặn ba lượt mở kết nối tiếp theo trong trang, sau đó bỏ chặn rồi bấm Thử kết nối lại. Không F5 hoặc tải lại trang

Đây là ngắt kết nối có điều khiển để thử đủ số lượt, không phải tắt mạng hệ điều hành hoặc thử lỗi DNS. RE_LOGIN và GET_USER_LIST khi mở lại kết nối dùng API thật

| Kiểm tra | Kết quả |
| --- | --- |
| Hết ba lượt tự động | Có đúng 3 lượt bị chặn, header báo Mất kết nối và có nút Thử kết nối lại |
| Bấm thử lại sau khi bỏ chặn | RE_LOGIN trả success rồi mới báo Đã kết nối |
| Phiên và số lần nối lại | sessionGeneration giữ 1, reconnectCount tăng từ 0 lên 1 |
| Hội thoại và nháp | Vẫn chat riêng test001, nháp giữ nguyên và nút Gửi được mở lại |
| Tự gửi nháp | Không phát SEND_CHAT trong lượt kiểm tra |
| Danh sách hội thoại | GET_USER_LIST trả success sau RE_LOGIN |
| Lịch sử chat đã có cache, không có pending | Vẫn 5 tin cũ, không phát GET_PEOPLE_CHAT_MES sau reconnect trong lượt này |

Bằng chứng cục bộ: CV09-retest-het-luot.jpg, CV09-retest-ket-noi-lai.jpg và CV09-retest-result.json. Ảnh và log chỉ ghi trạng thái, không chứa mật khẩu hoặc mã phiên

### Bàn giao phần lịch sử cho Kiệt

CV25 phụ trách tải lịch sử, phối hợp CV30/CV32 về đối chiếu và kiểm thử. Ở hooks/useChat.ts, shouldLoadFirstPage không yêu cầu tải trang 1 khi chat đã có cache. ChatHistory có dựng lại theo reconnectCount nhưng messages vẫn giữ cache; nếu không có pending thì useOutgoingMessages cũng không gọi đối chiếu

Đã quan sát trên giao diện: RE_LOGIN và GET_USER_LIST thành công nhưng không có GET_PEOPLE_CHAT_MES cho chat đang mở. Chưa thử gửi tin từ tài khoản thứ hai trong lúc mất kết nối, nên chưa kết luận có tin nào thực tế bị bỏ sót

Ca cần Kiệt thử: mở chat đã có lịch sử, không có pending → mất kết nối → tài khoản bên kia gửi một tin được phép dùng để thử → bấm Thử kết nối lại sau khi mạng phục hồi, không F5 → kiểm tra đọc lại lịch sử và tin mới xuất hiện, giữ nháp và các trang cũ đã tải. Không tự gửi lại tin chưa xác nhận

Phần reconnect thủ công của CV09 đạt trong phạm vi lượt thử nêu trên, chưa xác minh toàn bộ CV50-08. Không coi pending mất sau F5 là lỗi đã xác nhận khi chưa đối chiếu yêu cầu lưu trạng thái qua reload

### Chạy lại trong WebStorm

Mở Terminal trong frontend

```powershell
npm test -- scripts/cv09-reconnect.test.ts scripts/cv09-socket-timeout.test.ts
```

Kỳ vọng 12 test đạt, dùng socket và phản hồi auth giả. Hai ca bổ sung kiểm tra thử lại khi mạng vẫn lỗi chỉ chạy thêm ba lượt, và mất mã phiên trước khi bấm thử lại thì về đăng nhập

Thử trên web với mạng thật

1. Chạy npm run dev, mở /chat và đăng nhập tài khoản thử
2. Chọn chat riêng đã có lịch sử, nhập một nháp dễ nhận biết, không gửi
3. Ngắt mạng tới khi hết ba lượt và màn hình hiện Mất kết nối. Thời gian chờ gồm cả timeout mở socket, không chỉ các khoảng nghỉ 500/1000/2000 ms
4. Bật lại mạng rồi bấm Thử kết nối lại, giữ nguyên trang, không F5
5. Kỳ vọng RE_LOGIN success, header Đã kết nối, vẫn đúng hội thoại và nháp, không tự SEND_CHAT. Nếu máy chủ từ chối mã phiên thì về đăng nhập là nhánh hợp lệ, không đánh dấu lượt đó đạt nhánh khôi phục thành công
6. Chụp ảnh hết lượt và sau kết nối lại, che mã phiên nếu chụp DevTools. Việc đọc lại lịch sử theo dõi riêng ở phần bàn giao Kiệt bên trên
