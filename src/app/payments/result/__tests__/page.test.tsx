import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentResultPage from '../page';

const state = vi.hoisted(() => ({
  query: '',
  auth: { user: { id: 'u1' } as unknown, isAuthReady: true },
}));

const paymentApi = vi.hoisted(() => ({
  approvePayment: vi.fn(),
  getPayment: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(state.query),
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => state.auth,
}));

vi.mock('@/lib/payment-api', () => paymentApi);

const approved = {
  orderId: 'o1',
  status: 'APPROVED',
  purpose: 'MILEAGE_CHARGE',
  productCode: 'CHARGE_10000',
  itemName: '마일리지 10,000',
  amount: 10000,
  paymentMethodType: 'MONEY',
  createdAt: '2026-10-15T10:00:00+09:00',
  approvedAt: '2026-10-15T10:01:00+09:00',
  canceledAt: null,
};

describe('PaymentResultPage', () => {
  beforeEach(() => {
    paymentApi.approvePayment.mockReset().mockResolvedValue(approved);
    paymentApi.getPayment.mockReset().mockResolvedValue({ ...approved, status: 'READY' });
    state.auth = { user: { id: 'u1' }, isAuthReady: true };
  });

  it('approval 복귀는 한 번만 승인하고 URL에서 pg_token을 지운다', async () => {
    state.query = 'orderId=o1&result=approval&pg_token=tok';
    render(<StrictMode><PaymentResultPage /></StrictMode>);

    expect(await screen.findByText('10,000 M이 충전되었어요')).toBeInTheDocument();
    expect(paymentApi.approvePayment).toHaveBeenCalledTimes(1);
    expect(paymentApi.approvePayment).toHaveBeenCalledWith('o1', 'tok');
    expect(window.location.search).not.toContain('pg_token');
  });

  it('cancel 복귀는 승인하지 않고 상태만 조회한다', async () => {
    state.query = 'orderId=o1&result=cancel';
    render(<PaymentResultPage />);

    expect(await screen.findByText('결제가 완료되지 않았어요')).toBeInTheDocument();
    expect(paymentApi.approvePayment).not.toHaveBeenCalled();
    expect(paymentApi.getPayment).toHaveBeenCalledWith('o1');
  });

  it('로그인 사용자가 없으면 승인하지 않는다', async () => {
    state.query = 'orderId=o1&result=approval&pg_token=tok';
    state.auth = { user: null, isAuthReady: true };
    render(<PaymentResultPage />);

    expect(await screen.findByText('로그인 후 결제 내역에서 결과를 확인해주세요')).toBeInTheDocument();
    await waitFor(() => expect(paymentApi.approvePayment).not.toHaveBeenCalled());
  });
});
