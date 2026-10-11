# LMS Frontend · Nhóm 2

React + TypeScript + Vite. Khung S1 có trang kiểm tra kết nối thật tới Express và PostgreSQL.
Khang tiếp tục F0 (routing, layout theo role, API mock) từ 13/10 và áp UI kit của Cát.
Trang kiểm tra môi trường hiện tại là màn hình dành cho phát triển, chưa phải giao diện LMS.

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

Trang hiển thị trạng thái FE, BE, DB; có loading, lỗi và nút thử lại. Khi DB dừng,
backend vẫn có thể hiện kết nối thành công, PostgreSQL hiện chưa kết nối.

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

## Cấu trúc và bàn giao F0

```text
src/
  main.tsx            # React root
  App.tsx             # Trang kiểm tra môi trường S1
  styles.css          # CSS tối thiểu, thay bằng UI kit trong F0/U1
  lib/api.ts          # Lời gọi API hạ tầng + timeout + kiểm tra response
  lib/api.test.ts
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

Tài liệu điều phối trong repo backend: `docs/technical-decisions.md`,
`docs/S1-checklist.md`, `docs/kickoff-questions.md`.
