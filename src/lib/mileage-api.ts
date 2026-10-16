import { ApiError, AUTH_REQUIRED_MESSAGE, type ApiClientConfig, type ApiRequestOptions, apiRequest } from '@/lib/api-client';
import type { PageResponse } from '@/types/api';

const MILEAGE_BASE = '/api/v1/mileage';

export interface MileageBalanceResponse {
  currentBalance: number;
}

export interface MileageTransactionResponse {
  id: string;
  amount: number;
  balanceAfter: number;
  type: string;
  typeDescription: string;
  description: string;
  createdAt: string;
}

const MILEAGE_CLIENT: ApiClientConfig = {
  envelope: 'optional',
  toError: ({ reason, status, message }) => new ApiError(
    (message?.trim() ? message : undefined) ?? (reason === 'unauthenticated' || reason === 'blocked' || status === 401
      ? AUTH_REQUIRED_MESSAGE
      : '마일리지 요청을 처리하지 못했습니다.'),
    status,
    reason,
  ),
};

function mileageRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>(path, MILEAGE_CLIENT, options);
}

export function fetchMyMileageBalance() {
  return mileageRequest<MileageBalanceResponse>(`${MILEAGE_BASE}/me/balance`);
}

export function fetchMyMileageTransactions(page = 0, size = 10) {
  return mileageRequest<PageResponse<MileageTransactionResponse>>(
    `${MILEAGE_BASE}/me/transactions?page=${page}&size=${size}`
  );
}

export function chargeMileage(amount: number) {
  return mileageRequest<MileageBalanceResponse>(`${MILEAGE_BASE}/charge`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}
