import { getApiBaseUrl } from '@/lib/api-base';
import {
  assertCurrentAuthGeneration,
  expireAuthSession,
  getAccessToken,
  getAuthGeneration,
  isCurrentAuthGeneration,
  isExpiredAuthGeneration,
  refreshAccessTokenResult,
} from '@/lib/auth-store';
import { BLOCKED_ACCOUNT_MESSAGE, isBlockedAccountResponse } from '@/lib/auth-session-policy';

export type ApiFailureReason =
  // 사용할 토큰이 없어 세션이 종료됨
  | 'unauthenticated'
  // 차단 계정으로 세션이 종료됨
  | 'blocked'
  // 네트워크·5xx·429·응답 형식 문제로 refresh 실패
  | 'unavailable'
  // 그 밖의 HTTP 오류. 최종 401은 세션 종료
  | 'http'
  // 성공 응답에 필요한 API envelope가 없음
  | 'invalid-response';

export const AUTH_REQUIRED_MESSAGE = '로그인이 필요하거나 인증이 만료되었습니다. 다시 로그인해주세요.';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly reason: ApiFailureReason = 'http',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const MODERATION_REJECTED_MESSAGE = '운영 정책에 맞지 않는 내용이 있어 올릴 수 없습니다. 내용을 수정해 주세요.';

// 서버 검열 거부(422)는 영문 사유를 그대로 보여주지 않고 정책 위반 문구로 바꾼다.
export function toUploadErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.status === 422) return MODERATION_REJECTED_MESSAGE;
  return error instanceof Error && error.message ? error.message : fallback;
}

export interface ApiFailure {
  reason: ApiFailureReason;
  status: number;
  message: string | null;
}

export function isAuthError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    (error.status === 401 || error.reason === 'unauthenticated' || error.reason === 'blocked')
  );
}

export type ApiRequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: HeadersInit;
};

export interface ApiClientConfig {
  /** 도메인 오류 타입과 기존 문구를 만든다. 세대가 현재일 때만 호출된다. */
  toError: (failure: ApiFailure) => Error;
  /** false면 미리 refresh하지 않고 메모리의 토큰만 쓴다(없으면 토큰 없이 보낸다). 401 처리는 같다. */
  authRequired?: boolean;
  /** 'optional'이면 envelope가 없는 원문 응답을 그대로 반환한다. */
  envelope?: 'required' | 'optional';
}

function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function messageOf(body: unknown) {
  return body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
    ? body.message
    : null;
}

function createAuthSession({ toError }: ApiClientConfig, signal?: AbortSignal | null) {
  const generation = getAuthGeneration();
  const fail = (reason: ApiFailureReason, status: number, message: string | null = null) =>
    toError({ reason, status, message });

  // 사용자 전환·로그아웃이면 AbortError, 인증 만료로 끝난 같은 세션이면 인증 오류로 끝낸다.
  const ensureCurrent = () => {
    if (isCurrentAuthGeneration(generation)) {
      signal?.throwIfAborted();
      return;
    }

    if (isExpiredAuthGeneration(generation)) {
      throw fail('unauthenticated', 401);
    }

    assertCurrentAuthGeneration(generation);
  };

  const endSession = (createError: () => Error): never => {
    if (!expireAuthSession(generation)) {
      ensureCurrent();
    }
    throw createError();
  };

  const refresh = async () => {
    const result = await refreshAccessTokenResult(generation);
    // refresh가 같은 세션을 이미 종료했어도 차단 사유를 일반 인증 만료로 덮어쓰지 않는다.
    if (result.status === 'rejected' && result.blocked) {
      if (!isExpiredAuthGeneration(generation)) {
        ensureCurrent();
      }
      return endSession(() => fail('blocked', result.httpStatus ?? 403, BLOCKED_ACCOUNT_MESSAGE));
    }
    ensureCurrent();

    switch (result.status) {
      case 'refreshed':
        return result.accessToken;
      case 'failed':
        throw fail('unavailable', result.httpStatus);
      case 'rejected':
        return endSession(() => fail('unauthenticated', 401));
      default:
        // 'stale'은 세대가 바뀐 경우라 위의 ensureCurrent가 먼저 던진다.
        throw new DOMException('사용자가 변경되어 요청이 취소되었습니다.', 'AbortError');
    }
  };

  return { fail, ensureCurrent, endSession, refresh };
}

async function sendAuthorized(
  url: string,
  options: ApiRequestOptions,
  config: ApiClientConfig,
  readBody: (response: Response) => Promise<unknown>,
) {
  const session = createAuthSession(config, options.signal);

  const send = async (accessToken: string | null) => {
    const headers = new Headers(options.headers);

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    }).catch((error: unknown) => {
      session.ensureCurrent();
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      throw session.fail('unavailable', 0);
    });
    const body = await readBody(response);
    session.ensureCurrent();

    if (!response.ok && isBlockedAccountResponse(response.status, body as never)) {
      session.endSession(() => session.fail('blocked', response.status, BLOCKED_ACCOUNT_MESSAGE));
    }

    return { response, body };
  };

  let accessToken = getAccessToken();
  if (!accessToken && config.authRequired !== false) {
    accessToken = await session.refresh();
  }

  let result = await send(accessToken);

  if (result.response.status === 401) {
    // 같은 세대의 다른 요청이 그사이 토큰을 갱신했으면 refresh를 다시 하지 않고 그 토큰으로 재시도한다.
    const currentToken = getAccessToken();
    result = await send(
      currentToken && currentToken !== accessToken ? currentToken : await session.refresh(),
    );
  }

  if (result.response.status === 401) {
    session.endSession(() => session.fail('http', 401, messageOf(result.body)));
  }

  if (!result.response.ok) {
    throw session.fail('http', result.response.status, messageOf(result.body));
  }

  return result;
}

/**
 * 인증이 필요한 JSON API를 호출한다.
 * 첫 401이면 refresh 후 한 번만 다시 보내고, refresh 거절·최종 401·차단 계정이면 세션을 종료한다.
 * 사용자 전환·로그아웃 뒤에 도착한 응답은 AbortError로 버린다.
 */
export async function apiRequest<T>(
  path: string,
  config: ApiClientConfig,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { response, body } = await sendAuthorized(
    `${getApiBaseUrl()}${path}`,
    options,
    config,
    readJson,
  );

  if (body && typeof body === 'object' && 'data' in body) {
    return body.data as T;
  }

  if (config.envelope === 'optional') {
    return body as T;
  }

  throw config.toError({ reason: 'invalid-response', status: response.status, message: null });
}

/** 인증이 필요한 파일을 받는다. url은 base URL을 붙이지 않고 그대로 쓴다. */
export async function apiRequestBlob(
  url: string,
  config: ApiClientConfig,
  options: ApiRequestOptions = {},
): Promise<Blob> {
  const { body } = await sendAuthorized(url, options, config, (response) =>
    response.ok ? response.blob() : readJson(response),
  );
  return body as Blob;
}

/** 메모리의 토큰과 관계없이 refresh한다. 실패 처리는 apiRequest와 같다. */
export function forceRefreshAccessToken(config: ApiClientConfig) {
  return createAuthSession(config).refresh();
}
