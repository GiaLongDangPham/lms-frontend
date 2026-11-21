# LMS Frontend · Nhóm 2

React + TypeScript + Vite, routing/layout theo role và UI kit của Cát. Ứng dụng LMS có
đăng nhập theo role, quản trị lớp/tài khoản, tài liệu môn học và các luồng bài tập,
nộp bài, chấm/công bố điểm, thông báo và thảo luận bài tập.
Thiết kế F2 và phụ thuộc backend nằm trong [spec chung tuần 02](https://github.com/GiaLongDangPham/lms-backend/blob/5e9137e6861d79eeea8c0a55b67c8f7d6b54f879/docs/superpowers/specs/D1-B1-B2-F2-tuan-02.md);
[implementation plan](https://github.com/GiaLongDangPham/lms-backend/blob/5e9137e6861d79eeea8c0a55b67c8f7d6b54f879/docs/superpowers/plans/D1-B1-B2-F2-tuan-02.md)
chứa task F2, evidence và checklist nghiệm thu. Liên kết cố định theo commit để
reviewer mở được trên GitHub; tài liệu thuộc repo `lms-backend`, thư mục `docs/superpowers/`.

## Chạy local

Yêu cầu Node.js 22 >=22.13, npm, Git. Khởi động backend theo README của repo backend trước.

Từ thư mục `lms-frontend`, chạy trong PowerShell:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Chỉ copy `.env` lần đầu; sửa file hiện có nếu đã cấu hình riêng.
Mở `http://localhost:5173`. Cổng cố định; nếu bị chiếm, giải phóng cổng hoặc đổi đồng thời
Vite/CORS backend. API gọi trực tiếp `http://localhost:3000/api`, nên phép thử xác minh
cả CORS giữa hai origin, không dùng proxy để che lỗi cấu hình.

Trang gốc chuyển tới đăng nhập hoặc dashboard theo vai trò. Các trang nghiệp vụ
có trạng thái đang tải/lỗi/rỗng; backend kiểm tra phân quyền cho từng request.

## Luồng nghiệp vụ hiện có

- Sinh viên: lớp học, tài liệu, bài tập, nộp bài và lịch sử phiên bản, kết quả đã công bố,
  thông báo và thảo luận cấp bài tập.
- Giảng viên: tài liệu, quản lý bài tập, bảng điểm, chấm/sửa điểm, công bố điểm toàn bài,
  điều chỉnh kết quả 0 tự động và thảo luận cấp bài tập.
- Quản trị: lớp học, ghi danh/phân công và tài khoản.
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
  main.tsx            # React root
  App.tsx             # Routing SPA và redirect theo role
  styles.css          # UI kit và layout responsive
  contexts/           # Phiên người dùng
  components/         # ProtectedRoute, lớp học, UI bài tập, thông báo, bình luận
  pages/              # Đăng nhập, đổi mật khẩu, teacher/student/admin
  lib/apiClient.ts    # Bearer RAM + refresh cookie + upload/download
  lib/assignments.ts  # API bài tập và file, chính sách picker Q08
  lib/materials.ts    # API tài liệu
  lib/grades.ts       # API chấm, công bố và lịch sử điểm
  lib/notifications.ts, lib/comments.ts  # API thông báo và thảo luận
```

Giữ route được bảo vệ theo role; việc ẩn menu không thay thế phân quyền phía API.
Các màn hình nghiệp vụ dùng API contract backend và component/UI kit hiện có.

`VITE_API_BASE_URL` là cấu hình công khai, được đóng vào bundle lúc build. Sửa URL
staging phải build lại. Không đặt DB URL, password hay token bí mật trong biến `VITE_*`.

DoD F0 tại CP1: build qua CI, staging chạy app shell và gọi được mock D2. Các module FE
nghiệp vụ cần chạy API thật trên staging khi đóng issue. Cần ghi rõ ngoại lệ F0 với Kha.

Branch theo mã hoạt động (ví dụ `F0-mo-ta-ngan`); commit `[Mã] ...`; PR ghi
`Closes #<issue>` khi đã có issue.
Long review PR của Khang; Khang review F2 của Long và F4 của Nam.

Tài liệu điều phối trong repo backend: `docs/superpowers/specs/S1-moi-truong.md`,
`docs/superpowers/plans/S1-moi-truong.md`, `docs/superpowers/plans/S1-cau-hoi.md`.

## I2a acceptance

`node scripts/integration-acceptance.mjs I2a` runs the real Vite UI and compiled backend
against a uniquely created local PostgreSQL database, then drops only that database.
Build the sibling backend first. Set ACCEPTANCE_DATABASE_URL to a local admin DB,
PLAYWRIGHT_MODULE_PATH to an installed Playwright module if not locally resolvable,
and optionally ACCEPTANCE_CHROMIUM_PATH. Credentials are random per run and not logged.
Artifacts go to ignored `.acceptance/`. No request interception or mock backend is used.
Spec/plan: sibling backend `docs/superpowers/{specs,plans}/I2a-thong-bao.md`.
