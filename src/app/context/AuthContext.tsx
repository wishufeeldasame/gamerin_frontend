'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toAbsoluteAssetUrl } from '@/lib/asset-url';
import { useRouter } from 'next/navigation';
import {
  BlockedAccountError,
  restoreAuthUser,
  SessionRestoreUnavailableError,
  type AuthUser,
} from '@/lib/auth-api';
import { isPaymentResultRelay } from '@/lib/payment-device';
import {
  AUTH_CLEARED_EVENT,
  AUTH_LOGOUT_STATE_EVENT,
  AUTH_REAUTH_REQUIRED_EVENT,
  AUTH_USER_KEY,
  getAuthGeneration,
  isLocalReauthenticationRequired,
  isLogoutInProgress,
  isCurrentAuthGeneration,
  logoutAuthSession,
} from '@/lib/auth-store';

export type User = AuthUser;

interface AuthContextType {
  user: User | null;
  isAuthReady: boolean;
  isLoggingOut: boolean;
  /** 저장된 세션을 일시 장애로 확인하지 못했다. user는 null이지만 세션은 유지되므로 로그인 화면으로 보내지 않는다. */
  isSessionUnavailable: boolean;
  /** 저장된 세션 확인을 다시 시도한다. 진행 중인 시도가 있으면 그 시도를 기다린다. */
  retrySessionRestore: () => Promise<void>;
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
  const [isSessionUnavailable, setIsSessionUnavailable] = useState(false);
  const sessionRetryRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const handleAuthCleared = () => {
      setUser(null);
      setIsSessionUnavailable(false);
    };
    const handleLogoutState = (event: Event) => {
      setIsLoggingOut((event as CustomEvent<boolean>).detail);
    };

    setIsLoggingOut(isLogoutInProgress());
    window.addEventListener(AUTH_CLEARED_EVENT, handleAuthCleared);
    window.addEventListener(AUTH_REAUTH_REQUIRED_EVENT, handleAuthCleared);
    window.addEventListener(AUTH_LOGOUT_STATE_EVENT, handleLogoutState);
    return () => {
      window.removeEventListener(AUTH_CLEARED_EVENT, handleAuthCleared);
      window.removeEventListener(AUTH_REAUTH_REQUIRED_EVENT, handleAuthCleared);
      window.removeEventListener(AUTH_LOGOUT_STATE_EVENT, handleLogoutState);
    };
  }, []);

  const login = useCallback((userData: User) => {
    const nextUser = normalizeStoredUser(userData);
    setUser(nextUser);
    setIsSessionUnavailable(false);
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
  }, []);

  // 저장된 사용자를 서버 값으로 확인해 화면 사용자 상태에 반영한다. 앱 시작과 재시도가 함께 쓴다.
  const restoreSession = useCallback(async (storedUser: User) => {
    const generation = getAuthGeneration();

    try {
      const restoredUser = await restoreAuthUser(storedUser, generation);

      // 복원 도중 로그인·로그아웃·사용자 전환이 있었으면 그 결과를 덮어쓰지 않는다.
      if (!isCurrentAuthGeneration(generation)) {
        return;
      }

      if (restoredUser) {
        login(restoredUser);
      } else {
        setUser(null);
        setIsSessionUnavailable(false);
      }
    } catch (error) {
      if (!isCurrentAuthGeneration(generation)) {
        return;
      }

      // 409 재시도 소진·429·5xx·네트워크 오류는 세션을 유지한 채 다시 시도할 수 있게 한다.
      if (error instanceof SessionRestoreUnavailableError) {
        setUser(null);
        setIsSessionUnavailable(true);
        return;
      }

      setIsSessionUnavailable(false);
      // 차단 계정은 세션을 끝낸다. 세대가 바뀌므로 화면 사용자 상태는 여기서 직접 비운다.
      if (error instanceof BlockedAccountError) {
        await logoutAuthSession({ notify: false });
      }
      setUser(null);
    }
  }, [login]);

  useEffect(() => {
    const bootstrapAuth = async () => {
      let savedUser: string | null;

      // 팝업 결제 결과 창은 결과만 부모 창에 넘기고 닫힌다. refresh는 기존 토큰을 폐기하므로
      // 응답 전에 창이 닫히면 부모 창 세션까지 끊긴다. 이 경우에만 refresh를 건너뛴다(08 문서 12-6절).
      if (isPaymentResultRelay()) {
        setUser(null);
        setIsAuthReady(true);
        return;
      }

      if (isLocalReauthenticationRequired()) {
        setUser(null);
        setIsAuthReady(true);
        return;
      }

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
        await restoreSession(storedUser);
      } finally {
        setIsAuthReady(true);
      }
    };

    void bootstrapAuth();
  }, [restoreSession]);

  const retrySessionRestore = useCallback(() => {
    if (sessionRetryRef.current) return sessionRetryRef.current;

    const retry = (async () => {
      let storedUser: User | null = null;
      try {
        const savedUser = window.localStorage.getItem(AUTH_USER_KEY);
        storedUser = savedUser ? normalizeStoredUser(JSON.parse(savedUser) as User) : null;
      } catch {
        storedUser = null;
      }

      // 그사이 다른 탭의 로그아웃 등으로 저장 사용자가 사라졌으면 확인할 세션이 없다.
      if (!storedUser) {
        setUser(null);
        setIsSessionUnavailable(false);
        return;
      }

      await restoreSession(storedUser);
    })();

    sessionRetryRef.current = retry;
    const clear = () => {
      if (sessionRetryRef.current === retry) sessionRetryRef.current = null;
    };
    retry.then(clear, clear);
    return retry;
  }, [restoreSession]);

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
    setIsSessionUnavailable(false);
    await logoutAuthSession({ notify: false });

    const redirectTo = options?.redirectTo ?? '/login';
    if (redirectTo) {
      router.replace(redirectTo);
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthReady,
        isLoggingOut,
        isSessionUnavailable,
        retrySessionRestore,
        login,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
