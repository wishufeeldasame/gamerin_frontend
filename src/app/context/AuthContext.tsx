'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AUTH_CLEARED_EVENT,
  AUTH_USER_KEY,
  clearStoredAuth,
  refreshAccessToken,
} from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/api-base';

const API_BASE = getApiBaseUrl();

// 유저 데이터 타입 (필요한 정보를 추가하세요)
interface User {
  id: string;
  name: string;
  nickname: string;
  gameTier: string;
  bio?: string;
  handle?: string; 
}

interface AuthContextType {
  user: User | null;
  isAuthReady: boolean;
  login: (userData: User) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: (options?: { redirectTo?: string | null }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const handleAuthCleared = () => {
      setUser(null);
    };

    window.addEventListener(AUTH_CLEARED_EVENT, handleAuthCleared);
    return () => window.removeEventListener(AUTH_CLEARED_EVENT, handleAuthCleared);
  }, []);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const savedUser = window.localStorage.getItem(AUTH_USER_KEY);

      if (!savedUser) {
        setIsAuthReady(true);
        return;
      }

      try {
        const parsedUser = JSON.parse(savedUser);
        const refreshedToken = await refreshAccessToken();

        if (!refreshedToken) {
          setUser(null);
          clearStoredAuth({ notify: false });
          return;
        }

        setUser(parsedUser);
      } catch {
        setUser(null);
        clearStoredAuth({ notify: false });
      } finally {
        setIsAuthReady(true);
      }
    };

    void bootstrapAuth();
  }, []);

  const login = useCallback((userData: User) => {
    setUser(userData);
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((currentUser) => {
      if (!currentUser) {
        return currentUser;
      }

      const nextUser = { ...currentUser, ...updates };
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
      return nextUser;
    });
  }, []);

  const logout = useCallback(async (options?: { redirectTo?: string | null }) => {
    await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    }).catch(() => null);

    setUser(null);
    clearStoredAuth({ notify: false });

    const redirectTo = options?.redirectTo ?? '/login';
    if (redirectTo) {
      router.replace(redirectTo);
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isAuthReady, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
