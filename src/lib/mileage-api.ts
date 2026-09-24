import { type ApiClientConfig, type ApiRequestOptions, apiRequest } from '@/lib/api-client';

const MILEAGE_BASE = '/api/v1/mileage';

export interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
  numberOfElements?: number;
}

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

function createAuthRequiredError() {
  return new Error('Authentication is required. Please sign in again.');
}

const MILEAGE_CLIENT: ApiClientConfig = {
  envelope: 'optional',
  toError: ({ reason, status, message }) =>
    reason === 'unauthenticated' || (reason === 'http' && status === 401)
      ? createAuthRequiredError()
      : new Error(message || 'Failed to process mileage request.'),
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
