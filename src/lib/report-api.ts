import { ApiError, type ApiClientConfig, type ApiRequestOptions, apiRequest } from '@/lib/api-client';

const REPORTS_BASE = '/api/v1/reports';

export type ReportTargetType = 'POST' | 'COMMENT' | 'USER' | 'MENTORING' | 'MESSAGE';

export type ReportReasonCode =
  | 'PROFANITY'
  | 'SPAM'
  | 'INAPPROPRIATE'
  | 'IMPERSONATION'
  | 'OTHER';

export type ReportStatus = 'RECEIVED' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';

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
  constructor(message: string, status: number) {
    super(message, status);
    this.name = 'ReportApiError';
  }
}

const REPORT_CLIENT: ApiClientConfig = {
  toError: ({ reason, status, message }) => new ReportApiError(
    reason === 'unauthenticated'
      ? '로그인이 필요하거나 인증이 만료되었습니다.'
      : reason === 'invalid-response'
        ? '신고 API 응답 형식이 올바르지 않습니다.'
        : message ?? '신고 요청 처리에 실패했습니다.',
    status,
  ),
};

function reportRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>(path, REPORT_CLIENT, options);
}

export function fetchReportReasons(signal?: AbortSignal) {
  return reportRequest<ReportReason[]>(`${REPORTS_BASE}/reasons`, { signal });
}

export function createReport(request: CreateReportRequest) {
  return reportRequest<CreatedReport>(REPORTS_BASE, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
