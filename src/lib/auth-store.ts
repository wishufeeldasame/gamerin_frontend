'use client';

let accessTokenMemory: string | null = null;

const ACCESS_TOKEN_KEY = 'gamerin_access_token';

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
