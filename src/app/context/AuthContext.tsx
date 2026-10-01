'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toAbsoluteAssetUrl } from '@/lib/asset-url';
import { useRouter } from 'next/navigation';
import { restoreAuthUser, type AuthUser } from '@/lib/auth-api';
import {
  AUTH_CLEARED_EVENT,
  AUTH_LOGOUT_STATE_EVENT,
  AUTH_USER_KEY,
  getAuthGeneration,
  isLogoutInProgress,
  isCurrentAuthGeneration,
  logoutAuthSession,
} from '@/lib/auth-store';

export type User = AuthUser;

interface AuthContextType {
  user: User | null;
  isAuthReady: boolean;
  isLoggingOut: boolean;
  login: (userData: User) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: (options?: { redirectTo?: string | null }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeStoredUser(userData: User) {
  const safeUser = { ...userData } as User & {
    profileImageUrl?: unknown;
    coverImageUrl?: unknown;
  };

  delete safeUser.coverImageUrl;
  safeUser.profileImageUrl = toAbsoluteAssetUrl(safeUser.profileImageUrl);

  return safeUser as User;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const handleAuthCleared = () => {
      setUser(null);
    };
    const handleLogoutState = (event: Event) => {
      setIsLoggingOut((event as CustomEvent<boolean>).detail);
    };

    setIsLoggingOut(isLogoutInProgress());
    window.addEventListener(AUTH_CLEARED_EVENT, handleAuthCleared);
    window.addEventListener(AUTH_LOGOUT_STATE_EVENT, handleLogoutState);
    return () => {
      window.removeEventListener(AUTH_CLEARED_EVENT, handleAuthCleared);
      window.removeEventListener(AUTH_LOGOUT_STATE_EVENT, handleLogoutState);
    };
  }, []);

  const login = useCallback((userData: User) => {
    const nextUser = normalizeStoredUser(userData);
    setUser(nextUser);
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
  }, []);

  useEffect(() => {
    const bootstrapAuth = async () => {
      let savedUser: string | null;

      try {
        savedUser = window.localStorage.getItem(AUTH_USER_KEY);

        if (!savedUser) {
          setIsAuthReady(true);
          return;
        }
      } catch {
        setUser(null);
        await logoutAuthSession({ notify: false });
        setIsAuthReady(true);
        return;
      }

      const bootstrapGeneration = getAuthGeneration();
      let storedUser: User;

      try {
        storedUser = normalizeStoredUser(JSON.parse(savedUser) as User);
      } catch {
        setUser(null);
        await logoutAuthSession({ notify: false });
        setIsAuthReady(true);
        return;
      }

      try {
        const restoredUser = await restoreAuthUser(storedUser, bootstrapGeneration);

        // 복원 도중 로그인·로그아웃·사용자 전환이 있었으면 그 결과를 덮어쓰지 않는다.
        if (!isCurrentAuthGeneration(bootstrapGeneration)) {
          return;
        }

        if (restoredUser) {
          login(restoredUser);
        } else {
          setUser(null);
        }
      } catch {
        if (!isCurrentAuthGeneration(bootstrapGeneration)) {
          return;
        }

        setUser(null);
      } finally {
        setIsAuthReady(true);
      }
    };

    void bootstrapAuth();
  }, [login]);

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

  const logout = useCallback(async (options?: { redirectTo?: string | null }) => {
    setUser(null);
    await logoutAuthSession({ notify: false });

    const redirectTo = options?.redirectTo ?? '/login';
    if (redirectTo) {
      router.replace(redirectTo);
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isAuthReady, isLoggingOut, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
