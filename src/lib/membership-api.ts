import { AUTH_REQUIRED_MESSAGE, ApiError, apiRequest } from '@/lib/api-client';

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
        : new ApiError(message?.trim() ? message : '멤버십 정보를 불러오지 못했어요.', status, reason),
  });
}
