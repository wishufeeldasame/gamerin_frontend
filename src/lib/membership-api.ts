import { AUTH_REQUIRED_MESSAGE, ApiError, apiRequest } from '@/lib/api-client';
import type { WeeklyGameReport } from '@/lib/membership-content';

export interface MyMembership {
  active: boolean;
  expiresAt: string | null;
  price: number;
  durationDays: number;
  benefits: string[];
}

export function fetchMyMembership() {
  return apiRequest<MyMembership>('/api/v1/memberships/me', {
    toError: ({ reason, status, message }) =>
      reason === 'unauthenticated' || status === 401
        ? new ApiError(AUTH_REQUIRED_MESSAGE, 401, 'unauthenticated')
        : new ApiError(message?.trim() ? message : '멤버십 정보를 불러오지 못했습니다.', status, reason),
  });
}

export function fetchMyWeeklyReport(signal?: AbortSignal) {
  return apiRequest<WeeklyGameReport>('/api/v1/memberships/weekly-report', {
    toError: ({ reason, status, message }) =>
      reason === 'unauthenticated' || status === 401
        ? new ApiError(AUTH_REQUIRED_MESSAGE, 401, 'unauthenticated')
        : new ApiError(message?.trim() ? message : '주간 리포트를 불러오지 못했습니다.', status, reason),
  }, { signal });
}
