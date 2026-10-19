import { ApiError, AUTH_REQUIRED_MESSAGE, type ApiClientConfig, type ApiFailureReason, type ApiRequestOptions, apiRequest } from '@/lib/api-client';
import type { PageResponse } from '@/types/api';
import type { ReportReasonCode, ReportStatus, ReportTargetType } from '@/types/report';

const REPORTS_BASE = '/api/v1/reports';

export interface ReportReason {
  code: ReportReasonCode;
  label: string;
}

export interface CreateReportRequest {
  targetType: ReportTargetType;
  targetId: string;
  reasonCode: ReportReasonCode;
  details?: string | null;
}

export interface CreatedReport {
  id: string;
  reportCode: string;
  reporterId: string;
  reporterNickname: string;
  targetType: ReportTargetType;
  targetId: string;
  targetSnippet: string | null;
  reasonCode: ReportReasonCode;
  reasonLabel: string;
  details: string | null;
  status: ReportStatus;
  assignedAdminId: string | null;
  assignedAdminNickname: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ReportApiError extends ApiError {
  constructor(message: string, status: number, reason: ApiFailureReason = 'http') {
    super(message, status, reason);
    this.name = 'ReportApiError';
  }
}

const REPORT_CLIENT: ApiClientConfig = {
  toError: ({ reason, status, message }) => new ReportApiError(
    message ?? (reason === 'unauthenticated' || reason === 'blocked' || status === 401
      ? AUTH_REQUIRED_MESSAGE
      : reason === 'invalid-response'
        ? '신고 API 응답 형식이 올바르지 않습니다.'
        : '신고 요청 처리에 실패했습니다.'),
    status,
    reason,
  ),
};

function reportRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>(path, REPORT_CLIENT, options);
}

export function fetchReportReasons(signal?: AbortSignal) {
  return reportRequest<ReportReason[]>(`${REPORTS_BASE}/reasons`, { signal });
}

export function fetchMyReports(
  params: { page?: number; size?: number } = {},
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
    sort: 'createdAt,desc',
  });

  return reportRequest<PageResponse<CreatedReport>>(
    `${REPORTS_BASE}/my?${searchParams.toString()}`,
    { signal },
  );
}

export function createReport(request: CreateReportRequest) {
  return reportRequest<CreatedReport>(REPORTS_BASE, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
