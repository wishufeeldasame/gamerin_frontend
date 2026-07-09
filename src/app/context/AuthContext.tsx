'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AUTH_CLEARED_EVENT,
  AUTH_USER_KEY,
  clearStoredAuth,
  refreshAccessToken,
} from '@/lib/auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

// 유저 데이터 타입 (필요한 정보를 추가하세요)
interface User {
  id: string;
  name: string;
  nickname: string;
  gameTier: string;
  bio?: string;
  handle?: string;
  location?: string;
  website?: string;
  profileImageUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthReady: boolean;
  login: (userData: User) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: (options?: { redirectTo?: string | null }) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeProfileImageUrl(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const url = value.trim();
  if (!url) {
    return null;
  }

  if (/^(https?:|blob:|data:)/i.test(url)) {
    return url;
  }

  if (url.startsWith('//')) {
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
    return `${protocol}${url}`;
  }

  return `${API_BASE.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

function normalizeStoredUser(userData: User) {
  const safeUser = { ...userData } as User & {
    profileImageUrl?: unknown;
    coverImageUrl?: unknown;
  };

  delete safeUser.coverImageUrl;
  safeUser.profileImageUrl = normalizeProfileImageUrl(safeUser.profileImageUrl);

  return safeUser as User;
}

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
        const parsedUser = normalizeStoredUser(JSON.parse(savedUser) as User);
        const refreshedToken = await refreshAccessToken();

        if (!refreshedToken) {
          setUser(null);
          clearStoredAuth({ notify: false });
          return;
        }

        setUser(parsedUser);
        window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(parsedUser));
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
    const nextUser = normalizeStoredUser(userData);
    setUser(nextUser);
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((currentUser) => {
      if (!currentUser) {
        return currentUser;
      }

      const nextUser = normalizeStoredUser({ ...currentUser, ...updates });
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
      return nextUser;
    });
  }, []);

  const logout = useCallback((options?: { redirectTo?: string | null }) => {
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
