// [F0] AuthContext — quản lý trạng thái xác thực toàn app
// user, loading state, login/logout actions
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, getCurrentUser } from '../lib/auth';
import { getStoredToken, clearStoredToken, ApiClientError } from '../lib/apiClient';
import type { User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (schoolCode: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Kiểm tra token đã lưu khi app khởi động
  useEffect(() => {
    const token = getStoredToken();

    async function initAuth() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const fetchedUser = await getCurrentUser();
        setUser(fetchedUser);
      } catch (err: unknown) {
        // Token hết hạn hoặc không hợp lệ
        if (err instanceof ApiClientError && err.status === 401) {
          clearStoredToken();
        }
      } finally {
        setIsLoading(false);
      }
    }

    void initAuth();
  }, []);

  async function login(schoolCode: string, password: string): Promise<void> {
    const result = await apiLogin(schoolCode, password);
    setUser(result.user);
  }

  async function logout(): Promise<void> {
    await apiLogout();
    setUser(null);
  }

  return (
    <AuthContext value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth phải được dùng bên trong AuthProvider');
  }
  return ctx;
}
