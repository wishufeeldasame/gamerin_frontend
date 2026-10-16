import { ApiError, type ApiClientConfig, type ApiRequestOptions, apiRequest } from '@/lib/api-client';

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

const PAYMENT_CLIENT: ApiClientConfig = {
  toError: ({ reason, status, message }) =>
    reason === 'unauthenticated' || status === 401
      ? new ApiError('로그인 후 이용해주세요.', 401)
      : new ApiError(message || '결제 서비스를 잠시 사용할 수 없어요. 잠시 후 다시 시도해주세요.', status),
};

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
