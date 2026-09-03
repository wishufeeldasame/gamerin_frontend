import {
  assertCurrentAuthGeneration,
  ensureAccessToken,
  getAuthGeneration,
  refreshAccessToken,
} from '@/lib/auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
const REPORTS_BASE = '/api/v1/reports';

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

export class ReportApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ReportApiError';
  }
}

async function reportRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (accessToken: string) => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);

    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE}${path}`, {
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
    throw new ReportApiError('로그인이 필요하거나 인증이 만료되었습니다.', 401);
  }

  let result = await send(accessToken);
  assertCurrentAuthGeneration(requestGeneration);

  if (result.response.status === 401) {
    accessToken = await refreshAccessToken(requestGeneration);
    assertCurrentAuthGeneration(requestGeneration);

    if (!accessToken) {
      throw new ReportApiError('로그인이 필요하거나 인증이 만료되었습니다.', 401);
    }

    result = await send(accessToken);
    assertCurrentAuthGeneration(requestGeneration);
  }

  if (!result.response.ok) {
    throw new ReportApiError(
      result.payload?.message ?? '신고 요청 처리에 실패했습니다.',
      result.response.status,
    );
  }

  if (!result.payload || !('data' in result.payload)) {
    throw new ReportApiError('신고 API 응답 형식이 올바르지 않습니다.', result.response.status);
  }

  return result.payload.data;
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
