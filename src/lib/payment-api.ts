import { AUTH_REQUIRED_MESSAGE, ApiError, type ApiClientConfig, type ApiRequestOptions, apiRequest } from '@/lib/api-client';
import { BLOCKED_ACCOUNT_MESSAGE } from '@/lib/auth-session-policy';

const PAYMENT_BASE = '/api/v1/payments';

export type PaymentStatus =
  | 'CREATED' | 'READY' | 'APPROVING' | 'APPROVED'
  | 'CANCELING' | 'CANCELED' | 'FAILED' | 'EXPIRED' | 'NEEDS_REVIEW';
export type PaymentPurpose = 'MILEAGE_CHARGE' | 'MEMBERSHIP_PASS';

export interface PaymentProduct {
  productCode: string;
  purpose: PaymentPurpose;
  name: string;
  price: number;
  mileage: number | null;
  durationDays: number | null;
}

export interface PaymentReadyResponse {
  orderId: string;
  status: PaymentStatus;
  pcUrl: string | null;
  mobileUrl: string | null;
}

export interface PaymentResponse {
  orderId: string;
  status: PaymentStatus;
  purpose: PaymentPurpose;
  productCode: string;
  itemName: string;
  amount: number | null;
  paymentMethodType: 'CARD' | 'MONEY' | null;
  createdAt: string;
  approvedAt: string | null;
  canceledAt: string | null;
}

export interface PaymentPage {
  items: PaymentResponse[];
  nextCursor: string | null;
  hasNext: boolean;
}

export const PAYMENT_UNAVAILABLE_MESSAGE = '결제 서비스를 잠시 사용할 수 없어요. 잠시 후 다시 시도해주세요.';

// 08 문서 12-8절 오류 표시. 401·차단은 api-client가 세션을 정리한다.
const PAYMENT_CLIENT: ApiClientConfig = {
  toError: ({ reason, status, message }) => {
    if (reason === 'blocked') return new ApiError(message || BLOCKED_ACCOUNT_MESSAGE, status, reason);
    if (reason === 'unauthenticated' || status === 401) return new ApiError(AUTH_REQUIRED_MESSAGE, 401, 'unauthenticated');
    if (status === 403) return new ApiError('권한이 없는 주문입니다.', status, reason);
    if (status === 404) return new ApiError('주문을 찾을 수 없습니다.', status, reason);
    if (reason === 'unavailable' || status === 0 || status >= 500) {
      return new ApiError(PAYMENT_UNAVAILABLE_MESSAGE, status, reason);
    }
    return new ApiError(message?.trim() ? message : PAYMENT_UNAVAILABLE_MESSAGE, status, reason);
  },
};

/** 결과 불명: 서버가 확정할 때까지 재조회한다(04 문서 6-6절). */
export function isPaymentPending(status: PaymentStatus) {
  return status === 'APPROVING' || status === 'CANCELING' || status === 'NEEDS_REVIEW';
}

function paymentRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>(path, PAYMENT_CLIENT, options);
}

export function fetchPaymentProducts() {
  return paymentRequest<PaymentProduct[]>(`${PAYMENT_BASE}/products`);
}

export function readyPayment(productCode: string, requestId: string) {
  return paymentRequest<PaymentReadyResponse>(`${PAYMENT_BASE}/kakao/ready`, {
    method: 'POST',
    body: JSON.stringify({ productCode, requestId }),
  });
}

export function approvePayment(orderId: string, pgToken: string) {
  return paymentRequest<PaymentResponse>(`${PAYMENT_BASE}/kakao/approve`, {
    method: 'POST',
    body: JSON.stringify({ orderId, pgToken }),
  });
}

export function getPayment(orderId: string) {
  return paymentRequest<PaymentResponse>(`${PAYMENT_BASE}/${encodeURIComponent(orderId)}`);
}

export function fetchMyPayments(cursor?: string | null) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return paymentRequest<PaymentPage>(`${PAYMENT_BASE}${query}`);
}

export function cancelPayment(orderId: string) {
  return paymentRequest<PaymentResponse>(`${PAYMENT_BASE}/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
  });
}
