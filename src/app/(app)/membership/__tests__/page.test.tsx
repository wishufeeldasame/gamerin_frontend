import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const paymentApi = vi.hoisted(() => ({
  fetchPaymentProducts: vi.fn(),
  readyPayment: vi.fn(),
}));
const membershipApi = vi.hoisted(() => ({ fetchMyMembership: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/app/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock('@/lib/payment-api', () => paymentApi);
vi.mock('@/lib/membership-api', () => membershipApi);

import MembershipPage from '../page';

const membership = (active: boolean, expiresAt: string | null) => ({
  active, expiresAt, price: 4_900, durationDays: 30, benefits: [],
});

describe('MembershipPage', () => {
  beforeEach(() => {
    paymentApi.fetchPaymentProducts.mockReset().mockResolvedValue([
      { productCode: 'CHARGE_5000', purpose: 'MILEAGE_CHARGE', name: '마일리지 5,000', price: 5_000, mileage: 5_000, durationDays: null },
      { productCode: 'MEMBERSHIP_30D', purpose: 'MEMBERSHIP_PASS', name: '멤버십 30일 이용권', price: 4_900, mileage: null, durationDays: 30 },
    ]);
    paymentApi.readyPayment.mockReset();
    membershipApi.fetchMyMembership.mockReset().mockResolvedValue(membership(false, null));
  });

  it('비가입자에게 서버 가격·자동 갱신 없음·정책 혜택을 보여주고 결제 확인창을 연다', async () => {
    const user = userEvent.setup();
    render(<MembershipPage />);

    expect(await screen.findByText('30일 이용권 4,900원')).toBeInTheDocument();
    expect(screen.getByText('자동 갱신 없음 · 직접 재구매')).toBeInTheDocument();
    expect(screen.getByText('멘토 정산 수수료 10% → 5%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '카카오페이로 4,900원 결제' }));
    expect(screen.getByRole('dialog', { name: '멤버십 결제하기' })).toBeInTheDocument();
  });

  it('이용 중이면 만료일과 연장 버튼을, 만료됐으면 만료 안내를 보여준다', async () => {
    membershipApi.fetchMyMembership.mockResolvedValueOnce(membership(true, '2099-11-09T23:10:00+09:00'));
    const { unmount } = render(<MembershipPage />);
    expect(await screen.findByText('이용 중')).toBeInTheDocument();
    expect(screen.getByText('만료일 2099-11-09')).toBeInTheDocument();
    expect(screen.getByText('지금 재구매하면 → 2099-12-09')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30일 연장하기 4,900원' })).toBeEnabled();
    unmount();

    membershipApi.fetchMyMembership.mockResolvedValueOnce(membership(false, '2026-01-09T23:10:00+09:00'));
    render(<MembershipPage />);
    expect(await screen.findByText('2026-01-09에 만료되었어요')).toBeInTheDocument();
  });

  it('이용권 취소 진행 중 409는 문서 문구로 보여준다', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'open').mockReturnValue({ close: vi.fn(), location: { href: '' } } as unknown as Window);
    paymentApi.readyPayment.mockRejectedValueOnce(Object.assign(new Error('취소 중인 이용권 결제가 있어 새로 결제할 수 없습니다.'), { status: 409 }));
    render(<MembershipPage />);

    await user.click(await screen.findByRole('button', { name: '카카오페이로 4,900원 결제' }));
    await user.click(screen.getByRole('button', { name: '카카오페이로 결제' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이전 결제 취소를 처리하고 있습니다. 잠시 후 다시 시도해주세요.');
  });
});
