'use client';

let accessTokenMemory: string | null = null;
let authGeneration = 0;
let refreshRequestId = 0;
let refreshRequest: {
  generation: number;
  requestId: number;
  promise: Promise<string | null>;
} | null = null;

const LEGACY_ACCESS_TOKEN_KEY = 'gamerin_access_token';
export const AUTH_USER_KEY = 'gamerin_user';
export const AUTH_CLEARED_EVENT = 'gamerin_auth_cleared';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

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

if (typeof window !== 'undefined') {
  removeLegacyAccessToken();
}

type ClearStoredAuthOptions = {
  notify?: boolean;
};

export function clearStoredAuth({ notify = true }: ClearStoredAuthOptions = {}) {
  removeAccessToken();

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_USER_KEY);

    if (notify) {
      window.dispatchEvent(new Event(AUTH_CLEARED_EVENT));
    }
  }
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
      const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
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
