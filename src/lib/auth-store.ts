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
// 확정된 사용자와 `/auth/me` 확인 중인 사용자를 세대별로 기억한다.
// refresh 쿠키는 탭 간 공유되므로 응답의 userId가 이 소유자와 다르면 현재 탭만 재인증한다.
let authenticatedUserId: string | null = null;
let confirmationOwner: { generation: number; userId: string } | null = null;
let reauthenticationRequired = false;
let explicitOAuthAttemptId = 0;
let explicitOAuthAttempt: {
  id: number;
  acquisitionGeneration: number;
  confirmationGeneration: number | null;
} | null = null;
let refreshRequest: {
  generation: number;
  requestId: number;
  promise: Promise<RefreshResult>;
} | null = null;

export type RefreshResult =
  | { status: 'refreshed'; accessToken: string; userId: string }
  // 서버가 인증을 거절했다. 세션은 이미 종료됐다. blocked면 차단·비활성 계정이라서 거절한 것이다.
  | { status: 'rejected'; blocked?: boolean }
  // 네트워크 오류·5xx·429·잘못된 응답. 세션은 유지된다. httpStatus 0은 응답 없음.
  | { status: 'failed'; httpStatus: number }
  // 요청 도중 사용자 전환·로그아웃으로 세대가 바뀌었다.
  | { status: 'stale' };

const LEGACY_ACCESS_TOKEN_KEY = 'gamerin_access_token';
export const AUTH_USER_KEY = 'gamerin_user';
export const AUTH_CLEARED_EVENT = 'gamerin_auth_cleared';
export const AUTH_LOGOUT_STATE_EVENT = 'gamerin_auth_logout_state';
export const AUTH_SYNC_KEY = 'gamerin_auth_sync';
export const AUTH_REAUTH_REQUIRED_EVENT = 'gamerin_auth_reauthentication_required';

const AUTH_REAUTH_REQUIRED_KEY = 'gamerin_auth_reauthentication_required';

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
  authenticatedUserId = null;
  confirmationOwner = null;
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
  authenticatedUserId = null;
  confirmationOwner = null;
  refreshRequest = null;
  removeLegacyAccessToken();
}

function clearReauthenticationRequired() {
  reauthenticationRequired = false;
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(AUTH_REAUTH_REQUIRED_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function isLocalReauthenticationRequired() {
  if (reauthenticationRequired) return true;
  if (typeof window === 'undefined') return false;

  try {
    reauthenticationRequired = window.sessionStorage.getItem(AUTH_REAUTH_REQUIRED_KEY) === '1';
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
  return reauthenticationRequired;
}

export function setAuthConfirmationOwner(generation: number, userId: string) {
  if (!isCurrentAuthGeneration(generation) || !userId) return false;
  confirmationOwner = { generation, userId };
  return true;
}

export function commitAuthenticatedUser(userId: string, generation = authGeneration) {
  if (!isCurrentAuthGeneration(generation) || !userId) return false;
  authenticatedUserId = userId;
  confirmationOwner = null;
  clearReauthenticationRequired();
  return true;
}

function expectedUserIdForGeneration(generation: number) {
  if (confirmationOwner?.generation === generation) return confirmationOwner.userId;
  return isCurrentAuthGeneration(generation) ? authenticatedUserId : null;
}

export function requireLocalReauthentication() {
  if (isLocalReauthenticationRequired() && authGeneration === loggedOutGeneration) return;

  removeAccessToken();
  explicitOAuthAttempt = null;
  expiredSession = null;
  loggedOutGeneration = authGeneration;
  reauthenticationRequired = true;

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(AUTH_REAUTH_REQUIRED_KEY, '1');
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
    window.dispatchEvent(new Event(AUTH_REAUTH_REQUIRED_EVENT));
  }
}

export function beginExplicitOAuthAuthentication() {
  removeAccessToken();
  expiredSession = null;
  const attempt = {
    id: ++explicitOAuthAttemptId,
    acquisitionGeneration: authGeneration,
    confirmationGeneration: null,
  };
  explicitOAuthAttempt = attempt;
  return { id: attempt.id, generation: attempt.acquisitionGeneration };
}

export function markExplicitOAuthConfirmation(id: number, generation: number) {
  if (explicitOAuthAttempt?.id !== id || !isCurrentAuthGeneration(generation)) return false;
  explicitOAuthAttempt.confirmationGeneration = generation;
  return true;
}

export function isExplicitOAuthAttemptCurrent(id: number) {
  if (explicitOAuthAttempt?.id !== id) return false;
  return authGeneration === explicitOAuthAttempt.acquisitionGeneration
    || authGeneration === explicitOAuthAttempt.confirmationGeneration;
}

export function finishExplicitOAuthAuthentication(id: number) {
  if (explicitOAuthAttempt?.id === id) explicitOAuthAttempt = null;
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
  // auth-cleared는 보낸 탭이 이미 저장 사용자를 지웠으므로 로드 시 다시 적용하지 않는다.
  // 다시 적용하면 10초 안에 로그인한 세션이 새로고침 때 지워져 로그인 화면으로 튕긴다.
  const initialSync = parseAuthSyncMessage(window.localStorage.getItem(AUTH_SYNC_KEY));
  if (initialSync?.type !== 'auth-cleared') {
    applyAuthSyncMessage(initialSync);
  }
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_SYNC_KEY) {
      applyAuthSyncMessage(parseAuthSyncMessage(event.newValue));
      return;
    }

    if (event.key === AUTH_USER_KEY && event.newValue) {
      const expectedUserId = expectedUserIdForGeneration(authGeneration);
      if (!expectedUserId) return;

      try {
        const nextUser = JSON.parse(event.newValue) as { id?: unknown };
        if (nextUser.id === expectedUserId) return;
      } catch {
        // A malformed replacement cannot be trusted as the current account.
      }
      requireLocalReauthentication();
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
  explicitOAuthAttempt = null;
  clearReauthenticationRequired();

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
    userId?: string;
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
  options: { expectedUserId?: string | null; oauthAttemptId?: number } = {},
): Promise<RefreshResult> {
  if (typeof window === 'undefined') {
    return { status: 'failed', httpStatus: 0 };
  }

  if (!isCurrentAuthGeneration(expectedGeneration)) {
    return { status: 'stale' };
  }

  if (options.oauthAttemptId !== undefined) {
    if (
      explicitOAuthAttempt?.id !== options.oauthAttemptId
      || explicitOAuthAttempt.acquisitionGeneration !== expectedGeneration
    ) {
      return { status: 'stale' };
    }
  } else if (explicitOAuthAttempt?.acquisitionGeneration === expectedGeneration) {
    // 명시적 OAuth 토큰 획득은 같은 세대의 일반 API refresh와도 공유하지 않는다.
    return { status: 'stale' };
  }

  if (expectedGeneration === loggedOutGeneration) {
    return { status: 'rejected' };
  }

  if (refreshRequest?.generation === expectedGeneration) {
    return refreshRequest.promise;
  }

  const requestExpectedUserId = Object.prototype.hasOwnProperty.call(options, 'expectedUserId')
    ? options.expectedUserId
    : expectedUserIdForGeneration(expectedGeneration);
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

      const blocked = isBlockedAccountResponse(response.status, payload);
      if (response.status === 401 || blocked) {
        expireAuthSession(expectedGeneration);
        return blocked ? { status: 'rejected', blocked: true } : { status: 'rejected' };
      }

      const nextToken = payload?.data?.accessToken;
      const nextUserId = payload?.data?.userId;
      if (!response.ok || typeof nextToken !== 'string' || !nextToken
        || typeof nextUserId !== 'string' || !nextUserId) {
        return { status: 'failed', httpStatus: response.ok ? 0 : response.status };
      }

      if (requestExpectedUserId && nextUserId !== requestExpectedUserId) {
        requireLocalReauthentication();
        return { status: 'stale' };
      }

      return setRefreshedAccessToken(nextToken, expectedGeneration)
        ? { status: 'refreshed', accessToken: nextToken, userId: nextUserId }
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
