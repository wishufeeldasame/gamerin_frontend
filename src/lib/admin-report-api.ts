import {
  assertCurrentAuthGeneration,
  ensureAccessToken,
  getAuthGeneration,
  refreshAccessToken,
  logoutAuthSession,
} from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/api-base';
import { notifyAdminAuthorizationFailure } from '@/lib/admin-auth';

const ADMIN_REPORTS_BASE = '/api/v1/admin/reports';
import { BLOCKED_ACCOUNT_MESSAGE, isBlockedAccountResponse } from '@/lib/auth-session-policy';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface ErrorEnvelope {
  success?: boolean;
  message?: string;
}

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

export type AdminReportStatusCode = 'RECEIVED' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
export type AdminReportTargetTypeCode = 'POST' | 'COMMENT' | 'USER' | 'MENTORING' | 'MESSAGE';
export type AdminReportReasonCode =
  | 'PROFANITY'
  | 'SPAM'
  | 'INAPPROPRIATE'
  | 'IMPERSONATION'
  | 'OTHER';
export type AdminPenaltyType =
  | 'WARNING'
  | 'SUSPENSION_3D'
  | 'SUSPENSION_7D'
  | 'SUSPENSION_30D'
  | 'PERMANENT_BAN';

export interface AdminReportApiItem {
  id: string;
  reportCode: string;
  reporterId: string;
  reporterNickname: string;
  reporterHandle?: string | null;
  targetType: AdminReportTargetTypeCode;
  targetId: string;
  targetSnippet: string | null;
  reasonCode: AdminReportReasonCode;
  reasonLabel: string;
  details: string | null;
  status: AdminReportStatusCode;
  assignedAdminId: string | null;
  assignedAdminNickname: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminReportApiUser {
  id: string;
  nickname: string;
  handle: string;
  joinedAt: string;
  reportsReceived: number;
  activeSanction: string | null;
}

export interface AdminReportDetailResponse {
  report: AdminReportApiItem;
  reporter: AdminReportApiUser;
  targetUser: AdminReportApiUser | null;
  contentHidden: boolean;
}

export interface AdminReportPageResponse {
  content: AdminReportApiItem[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
}

export interface AdminReportSearchParams {
  status?: AdminReportStatusCode;
  targetType?: AdminReportTargetTypeCode;
  reasonCode?: AdminReportReasonCode;
  keyword?: string;
  page?: number;
  size?: number;
  sort?: 'createdAt,desc' | 'createdAt,asc';
}

export interface AdminReportResolutionRequest {
  decision: 'RESOLVED' | 'REJECTED';
  hideTargetContent: boolean;
  penaltyType: AdminPenaltyType | null;
  reason: string;
  internalMemo: string | null;
  includeRelatedReports: boolean;
}

export class AdminReportApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AdminReportApiError';
  }
}

export async function adminApiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const apiBase = getApiBaseUrl();
  const send = async (accessToken: string) => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);

    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
    const payload = (await response.json().catch(() => null)) as
      | ApiEnvelope<T>
      | ErrorEnvelope
      | null;

    return { response, payload };
  };

  const requestGeneration = getAuthGeneration();
  let accessToken = await ensureAccessToken(requestGeneration);
  assertCurrentAuthGeneration(requestGeneration);

  if (!accessToken) {
    notifyAdminAuthorizationFailure(401);
    throw new AdminReportApiError('관리자 로그인이 필요합니다.', 401);
  }

  let result = await send(accessToken);
  assertCurrentAuthGeneration(requestGeneration);

  if (result.response.status === 401) {
    accessToken = await refreshAccessToken(requestGeneration);
    assertCurrentAuthGeneration(requestGeneration);

    if (!accessToken) {
      notifyAdminAuthorizationFailure(401);
      throw new AdminReportApiError('관리자 로그인이 필요합니다.', 401);
    }

    result = await send(accessToken);
    assertCurrentAuthGeneration(requestGeneration);
  }
  if (isBlockedAccountResponse(result.response.status, result.payload as never)) {
    void logoutAuthSession();
    notifyAdminAuthorizationFailure(401);
    throw new AdminReportApiError(BLOCKED_ACCOUNT_MESSAGE, result.response.status);
  }

  if (!result.response.ok) {
    if (result.response.status === 401 || result.response.status === 403) {
      notifyAdminAuthorizationFailure(result.response.status);
    }

    const fallbackMessage =
      result.response.status === 403
        ? '관리자 권한이 필요한 기능입니다.'
        : '관리자 요청 처리에 실패했습니다.';
    throw new AdminReportApiError(result.payload?.message ?? fallbackMessage, result.response.status);
  }

  if (!result.payload || !('data' in result.payload)) {
    throw new AdminReportApiError('관리자 신고 API 응답 형식이 올바르지 않습니다.', result.response.status);
  }

  return result.payload.data;
}

export function fetchAdminReports(params: AdminReportSearchParams, signal?: AbortSignal) {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.targetType) searchParams.set('targetType', params.targetType);
  if (params.reasonCode) searchParams.set('reasonCode', params.reasonCode);
  if (params.keyword?.trim()) searchParams.set('keyword', params.keyword.trim());
  searchParams.set('page', String(params.page ?? 0));
  searchParams.set('size', String(params.size ?? 20));
  searchParams.set('sort', params.sort ?? 'createdAt,desc');

  return adminApiRequest<AdminReportPageResponse>(
    `${ADMIN_REPORTS_BASE}?${searchParams.toString()}`,
    { signal },
  );
}

export function updateAdminReportStatus(
  reportId: string,
  status: AdminReportStatusCode,
) {
  return adminApiRequest<AdminReportApiItem>(
    `${ADMIN_REPORTS_BASE}/${encodeURIComponent(reportId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
}

const unsupportedDetailMessage =
  '현재 백엔드는 관리자 신고 상세 및 제재 처리 API를 제공하지 않습니다.';

function unsupportedAdminReportDetailError() {
  return new AdminReportApiError(unsupportedDetailMessage, 501);
}

export function fetchAdminReportDetail(
  reportCode: string,
  signal?: AbortSignal,
): Promise<AdminReportDetailResponse> {
  void reportCode;
  void signal;
  return Promise.reject(unsupportedAdminReportDetailError());
}

export function startAdminReportReview(
  reportCode: string,
): Promise<AdminReportDetailResponse> {
  void reportCode;
  return Promise.reject(unsupportedAdminReportDetailError());
}

export function resolveAdminReport(
  reportCode: string,
  request: AdminReportResolutionRequest,
): Promise<AdminReportDetailResponse> {
  void reportCode;
  void request;
  return Promise.reject(unsupportedAdminReportDetailError());
}
