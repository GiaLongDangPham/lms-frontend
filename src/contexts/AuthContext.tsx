// [F0] AuthContext — quản lý trạng thái xác thực toàn app
// user, loading state, login/logout actions
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, getCurrentUser } from '../lib/auth';
import { clearStoredToken, ApiClientError } from '../lib/apiClient';
import type { User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (schoolCode: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  endSession: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionAction = useRef(0);

  // Khôi phục phiên qua HttpOnly cookie khi app khởi động (access token chỉ ở RAM).
  useEffect(() => {
    let cancelled = false;
    const action = sessionAction.current;
    const isCurrent = () => !cancelled && sessionAction.current === action;
    async function initAuth() {
      try {
        const fetchedUser = await getCurrentUser();
        if (isCurrent()) setUser(fetchedUser);
      } catch (err: unknown) {
        // Token hết hạn hoặc không hợp lệ
        if (isCurrent() && err instanceof ApiClientError && err.status === 401) {
          clearStoredToken();
        }
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    }

    void initAuth();
    return () => { cancelled = true; };
  }, []);

  async function login(schoolCode: string, password: string): Promise<void> {
    const action = ++sessionAction.current;
    try {
      const result = await apiLogin(schoolCode, password);
      if (sessionAction.current === action) setUser(result.user);
    } finally {
      if (sessionAction.current === action) setIsLoading(false);
    }
  }

  async function logout(): Promise<void> {
    const action = ++sessionAction.current;
    try {
      await apiLogout();
    } finally {
      if (sessionAction.current === action) { setUser(null); setIsLoading(false); }
    }
  }

  // The backend revokes every session after a password change, so only local state needs clearing.
  function endSession(): void {
    sessionAction.current++;
    clearStoredToken();
    setUser(null);
    setIsLoading(false);
  }

  return (
    <AuthContext value={{ user, isLoading, login, logout, endSession }}>
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
