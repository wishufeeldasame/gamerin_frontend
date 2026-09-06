'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getApiBaseUrl } from '@/lib/api-base';
import { useRouter } from 'next/navigation';
import {
  AUTH_CLEARED_EVENT,
  AUTH_LOGOUT_STATE_EVENT,
  AUTH_USER_KEY,
  getAuthGeneration,
  isLogoutInProgress,
  isCurrentAuthGeneration,
  logoutAuthSession,
  refreshAccessToken,
} from '@/lib/auth-store';
import { isBlockedAccountResponse, isBlockedAccountStatus } from '@/lib/auth-session-policy';

const API_BASE = getApiBaseUrl();

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
  role?: string;
  status?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthReady: boolean;
  isLoggingOut: boolean;
  login: (userData: User) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: (options?: { redirectTo?: string | null }) => Promise<void>;
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

      try {
        const storedUser = normalizeStoredUser(JSON.parse(savedUser) as User);
        const refreshedToken = await refreshAccessToken(bootstrapGeneration);

        if (!isCurrentAuthGeneration(bootstrapGeneration)) {
          return;
        }

        if (!refreshedToken) {
          setUser(null);
          await logoutAuthSession({ notify: false });
          return;
        }

        const meResponse = await fetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${refreshedToken}` },
          credentials: 'include',
        });
        const mePayload = await meResponse.json().catch(() => null);
        const me = mePayload?.data;

        if (!isCurrentAuthGeneration(bootstrapGeneration)) {
          return;
        }

        if (
          isBlockedAccountResponse(meResponse.status, mePayload) ||
          isBlockedAccountStatus(me?.status) ||
          !meResponse.ok ||
          !me ||
          typeof me.userId !== 'string' ||
          typeof me.handle !== 'string' ||
          typeof me.nickname !== 'string'
        ) {
          await logoutAuthSession({ notify: false });
          setUser(null);
          return;
        }

        const verifiedUser = normalizeStoredUser({
          ...storedUser,
          id: me.userId,
          handle: me.handle,
          nickname: me.nickname,
          name: storedUser.name || me.nickname,
          role: typeof me.role === 'string' ? me.role : undefined,
          status: typeof me.status === 'string' ? me.status : undefined,
        });
        setUser(verifiedUser);
        window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(verifiedUser));
      } catch {
        if (!isCurrentAuthGeneration(bootstrapGeneration)) {
          return;
        }

        setUser(null);
        await logoutAuthSession({ notify: false });
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
