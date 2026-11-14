# CV43 — Kết quả chạy kiểm tra sau sửa (14/11/2026)

**Môi trường:** Node.js v22.16.0, chạy từ thư mục `frontend/` trong bộ mã ZIP bàn giao.

| Kiểm tra | Lệnh | Kết quả |
|---|---|---|
| Hồi quy CV43 | `node scripts/check-cv43.mjs` | **69/69 PASS**, mã thoát 0, không cần Node flag |
| Kiểm tra TypeScript | `node node_modules/typescript/bin/tsc -b` | **PASS**, mã thoát 0 |
| ESLint | `node node_modules/eslint/bin/eslint.js .` | **PASS**, mã thoát 0 |
| Điểm nối chat riêng CV43–CV24 | `node scripts/check-cv43-cv24-bridge.mjs` | **18/18 PASS**, mã thoát 0 |
| Hợp đồng CV43–CV09 | `node scripts/check-cv43-cv09-contract.mjs` | **13/13 PASS**, mã thoát 0 |
| Mô phỏng reconnect CV09 | `node --experimental-strip-types scripts/check-cv43-cv09-flow.mjs` | **15/15 PASS**, mã thoát 0; là script KHÁC, vẫn dùng cờ Node |
| Bundle Vite | `node node_modules/vite/bin/vite.js build` | **CHƯA CHẠY ĐƯỢC**: `node_modules` ZIP thiếu native binding `rolldown`; không kết luận mã nguồn build thất bại |

**Lỗi đã sửa:** `checkExists` tách lỗi WebSocket ra khỏi parser/log, dùng `import.meta.env?.DEV` và đảm bảo lỗi console không đổi kết quả API. Harness `check-cv43.mjs` chuyển các module TypeScript sang `.mjs` tạm, tránh `ERR_UNKNOWN_FILE_EXTENSION` khi gọi `node` trực tiếp.

**Chưa phải bằng chứng máy chủ thật:** 69 ca CV43 dùng mock response và kiểm tra source code. Môi trường này không có tài khoản thử/phiên WebSocket đã đăng nhập, nên không thể chứng thực API thật trả `CHECK_USER_EXIST.data.status=true/false` hoặc thao tác UI lịch sử. Xem `CV43_API_LOG.md` và chạy `cv43-live-check.js`, `cv43-cv24-live-snippet.txt` trong trình duyệt đăng nhập được phép trước khi đánh dấu PASS API thật.
