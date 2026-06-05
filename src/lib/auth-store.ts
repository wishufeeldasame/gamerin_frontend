'use client';

let accessTokenMemory: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

const ACCESS_TOKEN_KEY = 'gamerin_access_token';
export const AUTH_USER_KEY = 'gamerin_user';
export const AUTH_CLEARED_EVENT = 'gamerin_auth_cleared';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export function setAccessToken(token: string) {
  accessTokenMemory = token;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  }
}

export function getAccessToken() {
  if (accessTokenMemory) {
    return accessTokenMemory;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const storedToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  accessTokenMemory = storedToken;
  return storedToken;
}

export function removeAccessToken() {
  accessTokenMemory = null;

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
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

export async function refreshAccessToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      const payload = (await response.json().catch(() => null)) as RefreshPayload | null;
      const nextToken = payload?.data?.accessToken ?? null;

      if (!response.ok || !nextToken) {
        clearStoredAuth();
        return null;
      }

      setAccessToken(nextToken);
      return nextToken;
    } catch {
      clearStoredAuth();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function ensureAccessToken() {
  const token = getAccessToken();
  if (token) {
    return token;
  }

  return refreshAccessToken();
}
