'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, refreshAccessToken, removeAccessToken } from '@/lib/auth-store';

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
  logout: (options?: { redirectTo?: string | null }) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const savedUser = window.localStorage.getItem('gamerin_user');

      if (!savedUser) {
        setIsAuthReady(true);
        return;
      }

      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);

        if (!getAccessToken()) {
          const refreshedToken = await refreshAccessToken();
          if (!refreshedToken) {
            setUser(null);
            window.localStorage.removeItem('gamerin_user');
          }
        }
      } catch {
        setUser(null);
        window.localStorage.removeItem('gamerin_user');
        removeAccessToken();
      } finally {
        setIsAuthReady(true);
      }
    };

    void bootstrapAuth();
  }, []);

  const login = useCallback((userData: User) => {
    setUser(userData);
    window.localStorage.setItem('gamerin_user', JSON.stringify(userData));
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((currentUser) => {
      if (!currentUser) {
        return currentUser;
      }

      const nextUser = { ...currentUser, ...updates };
      window.localStorage.setItem('gamerin_user', JSON.stringify(nextUser));
      return nextUser;
    });
  }, []);

  const logout = useCallback((options?: { redirectTo?: string | null }) => {
    setUser(null);
    window.localStorage.removeItem('gamerin_user');
    removeAccessToken();

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
