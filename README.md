# LMS Frontend · Nhóm 2

React + TypeScript + Vite. Ứng dụng LMS có đăng nhập theo role và các luồng bài tập,
nộp bài, chấm/công bố điểm, thông báo và thảo luận bài tập.

## Chạy local

Yêu cầu Node.js 22 >=22.13, npm, Git. Khởi động backend theo README của repo backend trước.

Từ thư mục `lms-frontend`, chạy trong PowerShell:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Chỉ copy `.env` lần đầu; sửa file hiện có nếu đã cấu hình riêng.
Mở `http://localhost:5173`. Mặc định `.env.example` gọi mock OpenAPI tại
`http://localhost:4010/api`; mock chỉ trả dữ liệu ví dụ và không lưu thay đổi.
Để chạy với backend thật local, đặt `VITE_API_BASE_URL=http://localhost:3000/api`
và cấu hình CORS cho `http://localhost:5173`.

## Luồng nghiệp vụ hiện có

- Sinh viên: bài tập, nộp bài và lịch sử phiên bản, kết quả đã công bố, thông báo và
  thảo luận cấp bài tập.
- Giảng viên: quản lý bài tập, bảng điểm, chấm/sửa điểm, công bố điểm toàn bài, điều
  chỉnh kết quả 0 tự động và thảo luận cấp bài tập.
- Thông báo và bình luận dùng các endpoint `/notifications` và
  `/assignments/{assignmentId}/comments` trong API contract. Mock OpenAPI chỉ trả
  example tĩnh, không lưu trạng thái đã đọc, bình luận, điểm hoặc thao tác công bố.

Các luồng cần API thật để kiểm tra ghi dữ liệu end-to-end. Frontend staging cần
`VITE_API_BASE_URL` trỏ tới API staging và backend phải cho phép origin staging trong
CORS; biến này được đóng vào bundle lúc build.

## Kiểm tra và build

```powershell
npm run check
npm run preview
```

`check` chạy ESLint, test API client và build có kiểm tra TypeScript.
`preview` phục vụ thư mục `dist` tại `http://localhost:4173` sau build. Để preview gọi BE,
thêm `http://localhost:4173` vào `CORS_ORIGINS` và khởi động lại backend.

GitHub Actions thực hiện `npm ci` + `npm run check` khi mở PR hoặc push `main`.
Workflow hiện được chuẩn bị local; kết quả trên GitHub chỉ có sau khi push/PR.

## Cấu trúc

```text
src/
  App.tsx
  components/assignment/
  contexts/
  layouts/
  lib/                # API clients and feature types
  pages/
  styles.css
```

Giữ route được bảo vệ theo role; việc ẩn menu không thay thế phân quyền phía API.
Các màn hình nghiệp vụ dùng API contract backend và component/UI kit hiện có.

`VITE_API_BASE_URL` là cấu hình công khai, được đóng vào bundle lúc build. Sửa URL
staging phải build lại. Không đặt DB URL, password hay token bí mật trong biến `VITE_*`.

Branch theo mã hoạt động, commit `[Mã] ...`; PR ghi `Closes #<issue>` khi đã có issue.
