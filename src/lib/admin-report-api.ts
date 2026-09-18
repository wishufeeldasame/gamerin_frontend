import { ApiError, type ApiClientConfig, type ApiRequestOptions, apiRequest } from '@/lib/api-client';
import { notifyAdminAuthorizationFailure } from '@/lib/admin-auth';

const ADMIN_REPORTS_BASE = '/api/v1/admin/reports';

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

export class AdminReportApiError extends ApiError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = 'AdminReportApiError';
  }
}

// toError는 요청 세대가 현재일 때만 호출되므로, 이전 사용자의 요청은 관리자 가드에 알리지 않는다.
const ADMIN_CLIENT: ApiClientConfig = {
  toError: ({ reason, status, message }) => {
    if (reason === 'unauthenticated') {
      notifyAdminAuthorizationFailure(401);
      return new AdminReportApiError('관리자 로그인이 필요합니다.', 401);
    }

    if (reason === 'blocked') {
      notifyAdminAuthorizationFailure(401);
      return new AdminReportApiError(message ?? '관리자 요청 처리에 실패했습니다.', status);
    }

    if (reason === 'invalid-response') {
      return new AdminReportApiError('관리자 신고 API 응답 형식이 올바르지 않습니다.', status);
    }

    if (reason === 'http' && (status === 401 || status === 403)) {
      notifyAdminAuthorizationFailure(status);
    }

    const fallbackMessage =
      reason === 'http' && status === 403
        ? '관리자 권한이 필요한 기능입니다.'
        : '관리자 요청 처리에 실패했습니다.';
    return new AdminReportApiError(message ?? fallbackMessage, status);
  },
};

export function adminApiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>(path, ADMIN_CLIENT, options);
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
