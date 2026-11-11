export const LOGIN_PROMPT_EVENT = 'gamerin_login_prompt';
const RETURN_TO_KEY = 'gamerin_login_return_to';

export interface LoginPromptRequest {
  message?: string;
  initialHandle?: string;
  returnTo?: string;
  /** 보호 URL 직접 진입을 취소할 때만 공개 메인으로 돌아간다. */
  dismissTo?: '/';
}

export function safeLoginReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return '/';
  try {
    const url = new URL(value, 'https://gamerin.invalid');
    if (url.origin !== 'https://gamerin.invalid' || /%2f|%5c/i.test(url.pathname)) return '/';
    if (/^\/payments(?:\/|$)/.test(url.pathname)) return '/wallet?tab=payments';
    if (/^\/(?:auth|login|signup|find-id|find-id-result|find-Password|admin)(?:\/|$)/i.test(url.pathname)) return '/';
    if (/^\/home\/?$/.test(url.pathname)) url.pathname = '/';
    url.searchParams.delete('login');
    if (url.pathname === '/' && ['email_not_verified', 'account_withdrawn'].includes(url.searchParams.get('error') ?? '')) url.searchParams.delete('error');
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}

export function currentPageReturnTo() {
  return typeof window === 'undefined' ? '/' : safeLoginReturnTo(window.location.pathname + window.location.search + window.location.hash);
}

export function requestLogin(request: LoginPromptRequest = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<LoginPromptRequest>(LOGIN_PROMPT_EVENT, { detail: request }));
  }
}

export function rememberLoginReturnTo(value: string) {
  try { sessionStorage.setItem(RETURN_TO_KEY, safeLoginReturnTo(value)); } catch {}
}

export function readLoginReturnTo() {
  try { return safeLoginReturnTo(sessionStorage.getItem(RETURN_TO_KEY)); } catch { return '/'; }
}

export function clearLoginReturnTo() {
  try { sessionStorage.removeItem(RETURN_TO_KEY); } catch {}
}

export function isPublicAppPath(pathname: string) {
  try { pathname = decodeURIComponent(pathname); } catch { return false; }
  return pathname === '/' || pathname === '/demo' || pathname === '/mentoring' || pathname === '/membership/content' || pathname === '/membership/content-preview' || /^\/posts\/\d+\/?$/.test(pathname)
    || (/^\/profile\/[^/]+\/?$/.test(pathname) && !/^\/profile\/me\/?$/i.test(pathname));
}

export function isAccountPage(pathname: string) {
  return /^\/(?:auth|signup|find-id|find-id-result|find-Password|terms|privacy)(?:\/|$)/i.test(pathname);
}
