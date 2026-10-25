# Tài khoản demo theo role

Web không có đăng ký công khai: tài khoản do hệ thống cấp sẵn. Dùng các tài khoản
dưới đây để đăng nhập local (form **Mã số / Mật khẩu**).

| Role | Backend thật (seed) | Mock D2 | Dashboard |
| --- | --- | --- | --- |
| Admin | `ADMIN001` | `AD001` | `/admin` |
| Giảng viên | `GV001`, `GV002` | `GV001` | `/teacher` |
| Sinh viên | `SV001`–`SV003` | `SV001` | `/student` |

Mật khẩu: mock dùng `local-demo-password` (example trong OpenAPI). Backend thật dùng
giá trị `SEED_PASSWORD` trong `.env` của `lms-backend` lúc chạy `npm run db:seed`
(nên đặt cùng `local-demo-password` cho thống nhất). Chỉ dùng cho môi trường local,
không phải credential thật.

Mock D2 gốc luôn trả về `SV001`; muốn mock phân vai theo mã số cần sửa
`scripts/mock-api.mjs` ở máy local.

## Tài khoản do Admin tạo

Admin tạo tài khoản ở `/admin/users/new` và tự đặt mật khẩu ban đầu (≥ 12 ký tự);
hệ thống không hiển thị lại mật khẩu này. Lần đăng nhập đầu tiên người dùng bị chuyển
tới trang **Đổi mật khẩu**; đổi xong phải đăng nhập lại. "Đặt lại mật khẩu" cũng buộc
đổi mật khẩu ở lần đăng nhập tiếp theo.

## Cách chạy để đăng nhập được

1. Mock D2 (`http://localhost:4010`) — mặc định `VITE_API_BASE_URL`:

   ```powershell
   cd lms-backend
   node scripts/mock-api.mjs
   ```

   Mock chỉ trả ví dụ tĩnh theo OpenAPI, không lưu thay đổi và không mô phỏng quy tắc
   nghiệp vụ. API thật (B1 tài khoản/lớp, B3 bài tập/nộp bài) chạy local:

   ```powershell
   cd lms-backend
   docker compose up -d --wait
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

   Khi chuyển sang API thật, đặt `VITE_API_BASE_URL=http://localhost:3000/api`.
   Trang Admin và đổi mật khẩu cần API thật (mock không lưu dữ liệu).

2. Frontend:

   ```powershell
   cd lms-frontend
   npm run dev
   ```

Mở `http://localhost:5173/login`, nhập mã số và mật khẩu ở bảng trên.
