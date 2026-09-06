'use client';

import { getApiBaseUrl } from '@/lib/api-base';

let accessTokenMemory: string | null = null;
let authGeneration = 0;
let refreshRequestId = 0;
let logoutRequestId = 0;
let logoutRequest: Promise<void> | null = null;
let logoutInProgress = false;
let remoteLogoutTimer: number | null = null;
let refreshRequest: {
  generation: number;
  requestId: number;
  promise: Promise<string | null>;
} | null = null;

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

export function logoutAuthSession(options: ClearStoredAuthOptions = {}) {
  if (logoutRequest) return logoutRequest;

  const accessToken = getAccessToken();
  const headers = new Headers();
  const syncId = createSyncId();
  const requestId = ++logoutRequestId;
  const controller = new AbortController();

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

  const timeoutId = typeof window !== 'undefined'
    ? window.setTimeout(() => controller.abort(), LOGOUT_REQUEST_TIMEOUT_MS)
    : null;

  const request = (async () => {
    try {
      await fetch(`${getApiBaseUrl()}/api/v1/auth/logout`, {
        method: 'POST',
        headers,
        credentials: 'include',
        signal: controller.signal,
      });
    } catch {
      // Local authentication is already cleared even if the server is unavailable.
    } finally {
      if (timeoutId !== null && typeof window !== 'undefined') {
        window.clearTimeout(timeoutId);
      }
      if (logoutRequestId === requestId) logoutRequest = null;
      setLogoutInProgress(false);
      broadcastAuthSync({
        type: 'logout-complete',
        id: syncId,
        expiresAt: Date.now() + LOGOUT_SYNC_TTL_MS,
      });
    }
  })();

  logoutRequest = request;
  return request;
}

type RefreshPayload = {
  success?: boolean;
  data?: {
    accessToken?: string;
  };
  message?: string;
};

export async function refreshAccessToken(expectedGeneration = authGeneration) {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!isCurrentAuthGeneration(expectedGeneration)) {
    return null;
  }

  if (refreshRequest?.generation === expectedGeneration) {
    return refreshRequest.promise;
  }

  const requestId = ++refreshRequestId;
  const promise = (async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      const payload = (await response.json().catch(() => null)) as RefreshPayload | null;
      const nextToken = payload?.data?.accessToken ?? null;

      if (!response.ok || !nextToken) {
        if (isCurrentAuthGeneration(expectedGeneration)) {
          clearStoredAuth();
        }
        return null;
      }

      return setRefreshedAccessToken(nextToken, expectedGeneration)
        ? nextToken
        : null;
    } catch {
      if (isCurrentAuthGeneration(expectedGeneration)) {
        clearStoredAuth();
      }
      return null;
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

export async function ensureAccessToken(expectedGeneration = authGeneration) {
  if (!isCurrentAuthGeneration(expectedGeneration)) {
    return null;
  }

  const token = getAccessToken();
  if (token) {
    return token;
  }

  return refreshAccessToken(expectedGeneration);
}
