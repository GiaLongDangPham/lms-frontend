# Tài khoản mock theo role

Web không có đăng ký công khai: tài khoản do hệ thống cấp sẵn. Dùng các tài khoản
dưới đây để đăng nhập local (form **Mã số / Mật khẩu**).

| Role | Mã số (`schoolCode`) | Mật khẩu | Dashboard |
| --- | --- | --- | --- |
| Admin | `AD001` | `local-demo-password` | `/admin` |
| Giảng viên | `GV001` | `local-demo-password` | `/teacher` |
| Sinh viên | `SV001` | `local-demo-password` | `/student` |

Mật khẩu giống example trong OpenAPI (`local-demo-password`). Chỉ dùng cho môi trường
local/mock, không phải credential thật.

## Cách chạy để đăng nhập được

1. Mock D2 (`http://localhost:4010`) — mặc định `VITE_API_BASE_URL`:

   ```powershell
   cd lms-backend
   node scripts/mock-api.mjs
   ```

   Mock chỉ trả ví dụ tĩnh theo OpenAPI, không lưu thay đổi và không mô phỏng quy tắc
   nghiệp vụ. Dùng API thật sau khi B3 lên staging:

   ```powershell
   cd lms-backend
   npm run dev
   ```

   Khi chuyển sang API thật, đặt `VITE_API_BASE_URL=http://localhost:3000/api`.

2. Frontend:

   ```powershell
   cd lms-frontend
   npm run dev
   ```

Mở `http://localhost:5173/login`, nhập mã số và mật khẩu ở bảng trên.
