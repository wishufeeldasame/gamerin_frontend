import { act, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentResultPage from '../page';

const state = vi.hoisted(() => ({
  query: '',
  auth: { user: { id: 'u1' } as unknown, isAuthReady: true, updateUser: vi.fn() },
}));

const paymentApi = vi.hoisted(() => ({
  approvePayment: vi.fn(),
  getPayment: vi.fn(),
  isPaymentPending: (status: string) => ['APPROVING', 'CANCELING', 'NEEDS_REVIEW'].includes(status),
}));
const membershipApi = vi.hoisted(() => ({ fetchMyMembership: vi.fn() }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(state.query),
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => state.auth,
}));
vi.mock('@/lib/payment-api', () => paymentApi);
vi.mock('@/lib/membership-api', () => membershipApi);

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

function setOpener(value: unknown) {
  Object.defineProperty(window, 'opener', { configurable: true, value });
}

describe('PaymentResultPage', () => {
  beforeEach(() => {
    paymentApi.approvePayment.mockReset().mockResolvedValue(approved);
    paymentApi.getPayment.mockReset().mockResolvedValue({ ...approved, status: 'READY' });
    membershipApi.fetchMyMembership.mockReset().mockResolvedValue({
      active: true, expiresAt: '2026-12-09T23:10:00+09:00', price: 4900, durationDays: 30, benefits: [],
    });
    state.auth = { user: { id: 'u1' }, isAuthReady: true, updateUser: vi.fn() };
    window.sessionStorage.clear();
  });

  afterEach(() => {
    setOpener(null);
    vi.useRealTimers();
  });

  it('approval 복귀는 한 번만 승인하고 URL에서 pg_token을 지운다', async () => {
    state.query = 'orderId=o1&result=approval&pg_token=tok';
    render(<StrictMode><PaymentResultPage /></StrictMode>);

    expect(await screen.findByText('10,000 M이 충전되었어요')).toBeInTheDocument();
    expect(paymentApi.approvePayment).toHaveBeenCalledTimes(1);
    expect(paymentApi.approvePayment).toHaveBeenCalledWith('o1', 'tok');
    expect(window.location.search).not.toContain('pg_token');
    expect(screen.getByRole('link', { name: '지갑으로' })).toHaveAttribute('href', '/wallet');
  });

  it('충전 전 멘토링 복귀 경로가 있으면 돌아가기 버튼을 보여준다', async () => {
    window.sessionStorage.setItem('gamerin_payment_return_to', JSON.stringify({ orderId: 'o1', returnTo: '/mentoring?programId=p1' }));
    state.query = 'orderId=o1&result=approval&pg_token=tok';
    render(<PaymentResultPage />);

    expect(await screen.findByRole('link', { name: '멘토링으로 돌아가기' })).toHaveAttribute('href', '/mentoring?programId=p1');
  });

  it('멤버십 결제 완료 후 만료일을 보여주고 배지를 갱신한다', async () => {
    state.query = 'orderId=o2&result=approval&pg_token=tok';
    paymentApi.approvePayment.mockResolvedValueOnce({
      ...approved, orderId: 'o2', purpose: 'MEMBERSHIP_PASS', productCode: 'MEMBERSHIP_30D', amount: 4900,
    });
    render(<PaymentResultPage />);

    expect(await screen.findByText('멤버십이 2026-12-09까지 이용 가능해요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '멤버십 보기' })).toHaveAttribute('href', '/membership');
    expect(state.auth.updateUser).toHaveBeenCalledWith({ membershipBadge: true });
  });

  it('cancel 복귀는 승인하지 않고 READY면 결제 안 됨으로 표시한다', async () => {
    state.query = 'orderId=o1&result=cancel';
    render(<PaymentResultPage />);

    expect(await screen.findByText('결제가 완료되지 않았어요')).toBeInTheDocument();
    expect(paymentApi.approvePayment).not.toHaveBeenCalled();
    expect(paymentApi.getPayment).toHaveBeenCalledWith('o1');
    expect(screen.getByRole('link', { name: '다시 결제하기' })).toHaveAttribute('href', '/wallet');
  });

  it('로그인 사용자가 없으면 승인하지 않는다', async () => {
    state.query = 'orderId=o1&result=approval&pg_token=tok';
    state.auth = { user: null, isAuthReady: true, updateUser: vi.fn() };
    render(<PaymentResultPage />);

    expect(await screen.findByText('로그인 후 결제 내역에서 결과를 확인해주세요')).toBeInTheDocument();
    await waitFor(() => expect(paymentApi.approvePayment).not.toHaveBeenCalled());
  });

  it('orderId가 없거나 남의 주문이면 결제 정보를 찾을 수 없다고 안내한다', async () => {
    state.query = '';
    const { unmount } = render(<PaymentResultPage />);
    expect(screen.getByText('결제 정보를 찾을 수 없어요')).toBeInTheDocument();
    unmount();

    state.query = 'orderId=o9';
    paymentApi.getPayment.mockRejectedValueOnce(Object.assign(new Error('권한이 없는 주문입니다.'), { status: 403 }));
    render(<PaymentResultPage />);
    expect(await screen.findByText('결제 정보를 찾을 수 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/home');
  });

  it('팝업 모드는 부모 창에 결과만 넘기고 닫으며 승인하지 않는다', () => {
    const postMessage = vi.fn();
    setOpener({ location: { origin: window.location.origin }, postMessage });
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    state.query = 'orderId=o1&result=approval&pg_token=tok';
    render(<PaymentResultPage />);

    expect(screen.getByText('결제 결과를 전달하고 있어요')).toBeInTheDocument();
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'kakaopay-result', orderId: 'o1', result: 'approval', pgToken: 'tok' },
      window.location.origin,
    );
    expect(close).toHaveBeenCalled();
    expect(paymentApi.approvePayment).not.toHaveBeenCalled();
    expect(paymentApi.getPayment).not.toHaveBeenCalled();
  });

  it('결과 불명은 재조회로 확정하고, 2분이 지나면 결제 내역 안내로 바꾼다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    state.query = 'orderId=o1&result=approval&pg_token=tok';
    paymentApi.approvePayment.mockRejectedValueOnce(Object.assign(new Error('unavailable'), { status: 0 }));
    paymentApi.getPayment.mockResolvedValue({ ...approved, status: 'APPROVING' });
    render(<PaymentResultPage />);

    expect(await screen.findByText('결제 결과를 확인하고 있어요')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '다시 결제하기' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '결제 내역 보기' })).toHaveAttribute('href', '/wallet?tab=payments');

    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(paymentApi.getPayment).toHaveBeenCalledTimes(2);

    // 재조회마다 effect가 다음 예약을 하므로 act를 나눠 시간을 보낸다.
    for (let i = 0; i < 10; i += 1) {
      await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    }
    expect(await screen.findByText('결제 내역에서 결과를 확인할 수 있어요')).toBeInTheDocument();
    const calls = paymentApi.getPayment.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(paymentApi.getPayment).toHaveBeenCalledTimes(calls);
  });
});
