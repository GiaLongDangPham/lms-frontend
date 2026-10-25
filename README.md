# LMS Frontend · Nhóm 2

React + TypeScript + Vite, routing/layout theo role và UI kit của Cát.
Nhánh F2 hiện có trang lớp học, tài liệu GV/SV và luồng bài tập F3. Cập nhật
25/10/2026: mặc định gọi API thật, hỗ trợ cookie refresh/token RAM và Q08.
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
  components/         # ProtectedRoute, lớp học, UI bài tập
  pages/              # Đăng nhập, đổi mật khẩu, teacher/student/admin
  lib/apiClient.ts    # Bearer RAM + refresh cookie + upload/download
  lib/assignments.ts  # API bài tập và file, chính sách picker Q08
  lib/materials.ts    # API tài liệu
```

Khang bổ sung routing/layout và API client nghiệp vụ theo D2. Long/Nam làm F2/F4 theo
component/UI kit dùng chung. Không tạo role giả hoặc coi việc ẩn menu là phân quyền.
Nam cung cấp mock sinh từ OpenAPI; mock chỉ dùng khi phát triển F0/F1 trước API thật.

`VITE_API_BASE_URL` là cấu hình công khai, được đóng vào bundle lúc build. Sửa URL
staging phải build lại. Không đặt DB URL, password hay token bí mật trong biến `VITE_*`.

DoD F0 tại CP1: build qua CI, staging chạy app shell và gọi được mock D2. Các module FE
nghiệp vụ cần chạy API thật trên staging khi đóng issue. Cần ghi rõ ngoại lệ F0 với Kha.

Branch: `F0-mo-ta-ngan` hoặc mã hoạt động tương ứng; commit `[Mã] ...`; PR `Closes #<issue>`.
Long review PR của Khang; Khang review F2 của Long và F4 của Nam.

Tài liệu điều phối trong repo backend: `docs/superpowers/specs/S1-moi-truong.md`,
`docs/superpowers/plans/S1-moi-truong.md`, `docs/superpowers/plans/S1-cau-hoi.md`.
