import { ensureAccessToken, refreshAccessToken } from '@/lib/auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
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

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

function createAuthRequiredError() {
  return new Error('Authentication is required. Please sign in again.');
}

async function mileageRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (accessToken?: string | null) => {
    const headers = new Headers(options.headers);

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | T | null;
    return { response, payload };
  };

  let accessToken = await ensureAccessToken();

  if (!accessToken) {
    throw createAuthRequiredError();
  }

  let result = await send(accessToken);

  if (result.response.status === 401) {
    const refreshedToken = await refreshAccessToken();

    if (!refreshedToken) {
      throw createAuthRequiredError();
    }

    accessToken = refreshedToken;
    result = await send(accessToken);
  }

  if (!result.response.ok) {
    if (result.response.status === 401) {
      throw createAuthRequiredError();
    }

    const message =
      result.payload && typeof result.payload === 'object' && 'message' in result.payload
        ? result.payload.message
        : null;

    throw new Error(message || 'Failed to process mileage request.');
  }

  if (result.payload && typeof result.payload === 'object' && 'data' in result.payload) {
    return (result.payload as ApiEnvelope<T>).data as T;
  }

  return result.payload as T;
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
