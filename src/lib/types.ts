// [F0] Types từ OpenAPI spec D2 · docs/openapi.json
// Nguồn: lms-backend/docs/openapi.json · branch docs/api-specification

export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface User {
  id: string;
  schoolCode: string;
  fullName: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface LoginResult {
  accessToken: string;
  user: User;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface PageInfo {
  nextCursor: string | null;
}
