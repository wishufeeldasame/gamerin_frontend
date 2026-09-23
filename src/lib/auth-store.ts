'use client';

import { getApiBaseUrl } from '@/lib/api-base';
import { isBlockedAccountResponse } from '@/lib/auth-session-policy';

let accessTokenMemory: string | null = null;
let authGeneration = 0;
let refreshRequestId = 0;
let logoutRequestId = 0;
let logoutRequest: Promise<void> | null = null;
let logoutInProgress = false;
let remoteLogoutTimer: number | null = null;
// 로그아웃으로 인증을 지운 뒤의 세대. 새 로그인 전까지 refresh로 인증을 되살리지 않는다.
let loggedOutGeneration: number | null = null;
// 인증 만료로 끝난 세대와 그 직후 세대. 같은 세션의 다른 요청을 사용자 전환과 구분한다.
let expiredSession: { generation: number; clearedGeneration: number } | null = null;
let refreshRequest: {
  generation: number;
  requestId: number;
  promise: Promise<RefreshResult>;
} | null = null;

export type RefreshResult =
  | { status: 'refreshed'; accessToken: string }
  // 서버가 인증을 거절했다. 세션은 이미 종료됐다.
  | { status: 'rejected' }
  // 네트워크 오류·5xx·429·잘못된 응답. 세션은 유지된다. httpStatus 0은 응답 없음.
  | { status: 'failed'; httpStatus: number }
  // 요청 도중 사용자 전환·로그아웃으로 세대가 바뀌었다.
  | { status: 'stale' };

const LEGACY_ACCESS_TOKEN_KEY = 'gamerin_access_token';
export const AUTH_USER_KEY = 'gamerin_user';
export const AUTH_CLEARED_EVENT = 'gamerin_auth_cleared';
export const AUTH_LOGOUT_STATE_EVENT = 'gamerin_auth_logout_state';
export const AUTH_SYNC_KEY = 'gamerin_auth_sync';

const LOGOUT_REQUEST_TIMEOUT_MS = 5_000;
const LOGOUT_SYNC_TTL_MS = 10_000;

type AuthSyncMessage = {
  type: 'auth-cleared' | 'logout-start' | 'logout-complete';
  id: string;
  expiresAt: number;
};

export function setAccessToken(token: string) {
  authGeneration += 1;
  accessTokenMemory = token;
  refreshRequest = null;
  removeLegacyAccessToken();
}

export function getAccessToken() {
  removeLegacyAccessToken();
  return accessTokenMemory;
}

export function getAuthGeneration() {
  return authGeneration;
}

export function isCurrentAuthGeneration(generation: number) {
  return generation === authGeneration;
}

export function assertCurrentAuthGeneration(generation: number) {
  if (isCurrentAuthGeneration(generation)) {
    return;
  }

  throw new DOMException('사용자가 변경되어 요청이 취소되었습니다.', 'AbortError');
}

export function removeAccessToken() {
  authGeneration += 1;
  accessTokenMemory = null;
  refreshRequest = null;
  removeLegacyAccessToken();
}

function setRefreshedAccessToken(token: string, expectedGeneration: number) {
  if (!isCurrentAuthGeneration(expectedGeneration)) {
    return false;
  }

  accessTokenMemory = token;
  removeLegacyAccessToken();
  return true;
}

function removeLegacyAccessToken() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function parseAuthSyncMessage(value: string | null): AuthSyncMessage | null {
  if (!value) return null;

  try {
    const message = JSON.parse(value) as Partial<AuthSyncMessage>;
    if (
      (message.type === 'auth-cleared'
        || message.type === 'logout-start'
        || message.type === 'logout-complete')
      && typeof message.id === 'string'
      && typeof message.expiresAt === 'number'
    ) {
      return message as AuthSyncMessage;
    }
  } catch {
    // Ignore malformed synchronization values.
  }

  return null;
}

function applyAuthSyncMessage(message: AuthSyncMessage | null) {
  if (!message || message.expiresAt <= Date.now()) return;

  if (message.type === 'logout-start') {
    setLogoutInProgress(true);
    scheduleRemoteLogoutExpiry(message.expiresAt);
    clearStoredAuth({ notify: true, broadcast: false });
    loggedOutGeneration = authGeneration;
    return;
  }

  if (message.type === 'logout-complete') {
    clearRemoteLogoutTimer();
    setLogoutInProgress(false);
    return;
  }

  clearStoredAuth({ notify: true, broadcast: false });
}

if (typeof window !== 'undefined') {
  removeLegacyAccessToken();
  applyAuthSyncMessage(parseAuthSyncMessage(window.localStorage.getItem(AUTH_SYNC_KEY)));
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_SYNC_KEY) {
      applyAuthSyncMessage(parseAuthSyncMessage(event.newValue));
    }
  });
}

export type ClearStoredAuthOptions = {
  notify?: boolean;
  broadcast?: boolean;
};

function createSyncId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function broadcastAuthSync(message: AuthSyncMessage) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(AUTH_SYNC_KEY, JSON.stringify(message));
  } catch {
    // Cross-tab synchronization is best-effort when storage is unavailable.
  }
}

function dispatchLogoutState() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<boolean>(AUTH_LOGOUT_STATE_EVENT, { detail: logoutInProgress }),
  );
}

function setLogoutInProgress(next: boolean) {
  if (logoutInProgress === next) return;
  logoutInProgress = next;
  dispatchLogoutState();
}

function clearRemoteLogoutTimer() {
  if (remoteLogoutTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(remoteLogoutTimer);
  }
  remoteLogoutTimer = null;
}

function scheduleRemoteLogoutExpiry(expiresAt: number) {
  if (typeof window === 'undefined') return;
  clearRemoteLogoutTimer();
  remoteLogoutTimer = window.setTimeout(() => {
    remoteLogoutTimer = null;
    setLogoutInProgress(false);
  }, Math.max(expiresAt - Date.now(), 0));
}

export function isLogoutInProgress() {
  return logoutInProgress;
}

export function waitForLogoutCompletion() {
  if (logoutRequest) return logoutRequest;
  if (!logoutInProgress || typeof window === 'undefined') return Promise.resolve();

  return new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(finish, LOGOUT_SYNC_TTL_MS);

    function finish() {
      window.clearTimeout(timeoutId);
      window.removeEventListener(AUTH_LOGOUT_STATE_EVENT, handleLogoutState);
      resolve();
    }

    function handleLogoutState(event: Event) {
      if (!(event as CustomEvent<boolean>).detail) finish();
    }

    window.addEventListener(AUTH_LOGOUT_STATE_EVENT, handleLogoutState);
  });
}

export function clearStoredAuth({
  notify = true,
  broadcast = true,
}: ClearStoredAuthOptions = {}) {
  removeAccessToken();

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(AUTH_USER_KEY);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }

    if (notify) {
      window.dispatchEvent(new Event(AUTH_CLEARED_EVENT));
    }

    if (broadcast) {
      broadcastAuthSync({
        type: 'auth-cleared',
        id: createSyncId(),
        expiresAt: Date.now() + LOGOUT_SYNC_TTL_MS,
      });
    }
  }
}

export function logoutAuthSession(options: ClearStoredAuthOptions = {}): Promise<void> {
  if (logoutRequest && authGeneration === loggedOutGeneration) return logoutRequest;

  // 이전 로그아웃 요청이 끝나기 전에 새로 로그인한 세션이면, 로컬 인증은 즉시 지우고 서버 로그아웃은
  // 이전 요청이 끝난 뒤 이어서 보낸다. 새 요청이 logoutRequest가 되므로 waitForLogoutCompletion()은
  // 연쇄 전체를 기다리고, 로그아웃 진행 상태와 완료 알림은 마지막 요청만 해제한다.
  const previousRequest = logoutRequest;
  const accessToken = getAccessToken();
  const headers = new Headers();
  const syncId = createSyncId();
  const requestId = ++logoutRequestId;

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  setLogoutInProgress(true);
  broadcastAuthSync({
    type: 'logout-start',
    id: syncId,
    expiresAt: Date.now() + LOGOUT_SYNC_TTL_MS,
  });
  clearStoredAuth({ ...options, broadcast: false });
  const clearedGeneration = authGeneration;
  loggedOutGeneration = clearedGeneration;

  const request = (async () => {
    if (previousRequest) await previousRequest;

    const controller = new AbortController();
    const timeoutId = typeof window !== 'undefined'
      ? window.setTimeout(() => controller.abort(), LOGOUT_REQUEST_TIMEOUT_MS)
      : null;

    try {
      // 이전 요청을 기다리는 동안 다시 로그인했다면 새 세션의 refresh cookie를 지우지 않도록 보내지 않는다.
      if (authGeneration === clearedGeneration) {
        await fetch(`${getApiBaseUrl()}/api/v1/auth/logout`, {
          method: 'POST',
          headers,
          credentials: 'include',
          signal: controller.signal,
        });
      }
    } catch {
      // Local authentication is already cleared even if the server is unavailable.
    } finally {
      if (timeoutId !== null && typeof window !== 'undefined') {
        window.clearTimeout(timeoutId);
      }
      if (logoutRequestId === requestId) {
        logoutRequest = null;
        setLogoutInProgress(false);
        broadcastAuthSync({
          type: 'logout-complete',
          id: syncId,
          expiresAt: Date.now() + LOGOUT_SYNC_TTL_MS,
        });
      }
    }
  })();

  logoutRequest = request;
  return request;
}

type RefreshPayload = {
  success?: boolean;
  data?: {
    accessToken?: string;
    status?: unknown;
  };
  message?: string;
};

export function isExpiredAuthGeneration(generation: number) {
  return expiredSession?.generation === generation
    && expiredSession.clearedGeneration === authGeneration;
}

/**
 * 인증 거절·최종 401·차단 계정으로 generation의 세션을 끝낸다.
 * 같은 세션의 요청이 여러 번 호출해도 로그아웃은 한 번만 한다.
 * 이미 다른 세대(사용자 전환·로그아웃)라면 아무것도 하지 않고 false를 반환한다.
 */
export function expireAuthSession(generation: number) {
  if (isExpiredAuthGeneration(generation)) {
    return true;
  }

  if (!isCurrentAuthGeneration(generation)) {
    return false;
  }

  // 이미 로그아웃으로 지운 세대(로그아웃 진행 중 포함)면 다시 로그아웃하지 않는다.
  if (generation !== loggedOutGeneration) {
    void logoutAuthSession();
  }

  expiredSession = { generation, clearedGeneration: authGeneration };
  return true;
}

export async function refreshAccessTokenResult(
  expectedGeneration = authGeneration,
): Promise<RefreshResult> {
  if (typeof window === 'undefined') {
    return { status: 'failed', httpStatus: 0 };
  }

  if (!isCurrentAuthGeneration(expectedGeneration)) {
    return { status: 'stale' };
  }

  if (expectedGeneration === loggedOutGeneration) {
    return { status: 'rejected' };
  }

  if (refreshRequest?.generation === expectedGeneration) {
    return refreshRequest.promise;
  }

  const requestId = ++refreshRequestId;
  const promise = (async (): Promise<RefreshResult> => {
    try {
      let response: Response;
      try {
        response = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        return { status: 'failed', httpStatus: 0 };
      }

      const payload = (await response.json().catch(() => null)) as RefreshPayload | null;

      if (!isCurrentAuthGeneration(expectedGeneration)) {
        return { status: 'stale' };
      }

      if (response.status === 401 || isBlockedAccountResponse(response.status, payload)) {
        expireAuthSession(expectedGeneration);
        return { status: 'rejected' };
      }

      const nextToken = payload?.data?.accessToken;
      if (!response.ok || !nextToken) {
        return { status: 'failed', httpStatus: response.ok ? 0 : response.status };
      }

      return setRefreshedAccessToken(nextToken, expectedGeneration)
        ? { status: 'refreshed', accessToken: nextToken }
        : { status: 'stale' };
    } finally {
      if (refreshRequest?.requestId === requestId) {
        refreshRequest = null;
      }
    }
  })();

  refreshRequest = {
    generation: expectedGeneration,
    requestId,
    promise,
  };

  return promise;
}
