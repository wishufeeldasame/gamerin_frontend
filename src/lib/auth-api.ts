import { getApiBaseUrl } from '@/lib/api-base';
import { ApiError, apiRequest } from '@/lib/api-client';
import {
  BLOCKED_ACCOUNT_MESSAGE,
  isBlockedAccountResponse,
  isBlockedAccountStatus,
} from '@/lib/auth-session-policy';
import {
  assertCurrentAuthGeneration,
  getAuthGeneration,
  isCurrentAuthGeneration,
  isExpiredAuthGeneration,
  logoutAuthSession,
  refreshAccessTokenResult,
  setAccessToken,
  waitForLogoutCompletion,
} from '@/lib/auth-store';

// 로그인 직후 사용자 객체를 만드는 곳. 일반 로그인·관리자 로그인·OAuth 완료·앱 시작 복원이 모두 이 모듈을 쓴다.
// 서버 계약: 로그인 응답(AuthTokenResponse)에는 role/status가 없고, `/auth/me`(MeResponse)에는 gameTier·bio가 없다.
export interface AuthUser {
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

export const DEFAULT_GAME_TIER = 'Unranked';

export class BlockedAccountError extends Error {
  constructor() {
    super(BLOCKED_ACCOUNT_MESSAGE);
    this.name = 'BlockedAccountError';
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * `/auth/me` 응답을 사용자 객체로 바꾼다. 형식이 맞지 않으면 null.
 * base(저장된 사용자)가 있으면 서버가 주지 않는 값(gameTier·bio·프로필 등)을 보존한다.
 */
export function toAuthUser(me: unknown, base?: Partial<AuthUser>): AuthUser | null {
  if (!me || typeof me !== 'object') return null;

  const { userId, handle, nickname, role, status } = me as Record<string, unknown>;
  if (typeof userId !== 'string' || typeof handle !== 'string' || typeof nickname !== 'string') {
    return null;
  }

  return {
    gameTier: DEFAULT_GAME_TIER,
    bio: '',
    ...base,
    id: userId,
    handle,
    nickname,
    name: base?.name || nickname,
    role: typeof role === 'string' ? role : undefined,
    status: typeof status === 'string' ? status : undefined,
  };
}

/**
 * 현재 토큰으로 `/auth/me`를 조회해 사용자 객체를 만든다. 첫 401은 refresh 후 한 번 다시 보내고(apiRequest),
 * 사용자 전환·로그아웃 뒤 도착한 응답은 AbortError로 버린다. 차단 계정이면 BlockedAccountError.
 */
export async function fetchAuthUser(base?: Partial<AuthUser>): Promise<AuthUser> {
  const me = await apiRequest<unknown>('/api/v1/auth/me', {
    toError: ({ reason, status, message }) =>
      reason === 'blocked'
        ? new BlockedAccountError()
        : new ApiError(message ?? '사용자 정보를 가져올 수 없습니다.', status),
  });

  if (isBlockedAccountStatus((me as { status?: unknown } | null)?.status)) {
    throw new BlockedAccountError();
  }

  const user = toAuthUser(me, base);
  if (!user) {
    throw new ApiError('사용자 정보를 확인할 수 없습니다.', 200);
  }

  return user;
}

// 새로 만든 세션(generation)이 끝까지 확정되지 못하면 세션을 정리한다.
// 사용자 전환·로그아웃(AbortError)과 refresh·api-client가 이미 종료한 세션은 다시 로그아웃하지 않는다.
async function clearSessionOnFailure<T>(generation: number, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isAbortError(error) && !isExpiredAuthGeneration(generation)) {
      await logoutAuthSession();
    }
    throw error;
  }
}

/**
 * 로그인·가입 응답으로 받은 access token으로 세션을 만들고 `/auth/me`로 사용자를 확정한다.
 * 확정하지 못하면 세션을 정리한다. 서버 응답의 사용자 정보는 쓰지 않는다.
 */
export function confirmAuthSession(accessToken: string): Promise<AuthUser> {
  setAccessToken(accessToken);
  return clearSessionOnFailure(getAuthGeneration(), () => fetchAuthUser());
}

/** 아이디·비밀번호로 로그인하고 `/auth/me`로 확정한 사용자를 반환한다. 로그인 응답의 사용자 정보는 쓰지 않는다. */
export async function loginWithPassword(handle: string, password: string): Promise<AuthUser> {
  await waitForLogoutCompletion();
  const generation = getAuthGeneration();

  const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ handle, password }),
  });
  const body = await response.json().catch(() => null);
  assertCurrentAuthGeneration(generation);

  if (isBlockedAccountResponse(response.status, body)) {
    await logoutAuthSession();
    throw new BlockedAccountError();
  }

  // 비밀번호 오류 같은 거절은 세션을 만들기 전이라 로그아웃하지 않는다(다른 탭의 세션을 지우지 않기 위해).
  if (!response.ok) {
    throw new Error(body?.message || '아이디 또는 비밀번호가 올바르지 않습니다.');
  }

  const accessToken = body?.data?.accessToken;
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new Error('로그인 응답에 인증 토큰이 없습니다.');
  }

  return confirmAuthSession(accessToken);
}

/** 소셜 가입을 완료하고(가입 직후 로그인 상태가 된다) `/auth/me`로 확정한 사용자를 반환한다. */
export async function completeSocialSignup(params: {
  signupToken: string;
  handle: string;
  nickname: string;
}): Promise<AuthUser> {
  await waitForLogoutCompletion();
  const generation = getAuthGeneration();

  const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/social-signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ...params, agreedToTerms: true, agreedToPrivacy: true }),
  });
  const body = await response.json().catch(() => null);
  assertCurrentAuthGeneration(generation);

  if (!response.ok || !body?.success) {
    throw new Error(body?.message || '소셜 회원가입에 실패했습니다.');
  }

  const accessToken = body.data?.accessToken;
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new Error('로그인 정보가 올바르지 않습니다. 다시 시도해 주세요.');
  }

  return confirmAuthSession(accessToken);
}

/** OAuth 로그인 뒤 HttpOnly refresh 쿠키로 토큰을 받고 `/auth/me`로 확정한 사용자를 반환한다. */
export async function completeOAuthSession(): Promise<AuthUser> {
  await waitForLogoutCompletion();
  const generation = getAuthGeneration();

  return clearSessionOnFailure(generation, async () => {
    const result = await refreshAccessTokenResult(generation);

    if (result.status === 'stale') {
      throw new DOMException('사용자가 변경되어 요청이 취소되었습니다.', 'AbortError');
    }

    if (result.status === 'rejected' && result.blocked) {
      throw new BlockedAccountError();
    }

    if (result.status !== 'refreshed') {
      throw new Error('인증 세션 생성에 실패했습니다.');
    }

    return fetchAuthUser();
  });
}

/**
 * 앱 시작 때 저장된 사용자를 서버 값으로 검증해 복원한다. 복원할 수 없으면 null.
 * 인증 거절·최종 401은 api-client·refresh가 세션을 종료하고, 차단 계정은 여기서 종료한다.
 * 네트워크 오류·5xx·429·형식 오류는 세션(저장 사용자·refresh 쿠키)을 유지한 채 null만 반환한다.
 * 호출한 쪽이 isCurrentAuthGeneration(generation)으로 오래된 결과를 버려야 한다.
 */
export async function restoreAuthUser(
  storedUser: AuthUser,
  generation: number,
): Promise<AuthUser | null> {
  const refreshResult = await refreshAccessTokenResult(generation);

  if (!isCurrentAuthGeneration(generation) || refreshResult.status !== 'refreshed') {
    return null;
  }

  try {
    return await fetchAuthUser(storedUser);
  } catch (error) {
    if (isCurrentAuthGeneration(generation) && error instanceof BlockedAccountError) {
      await logoutAuthSession({ notify: false });
    }
    return null;
  }
}
