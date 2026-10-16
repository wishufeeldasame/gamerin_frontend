import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const paymentApi = vi.hoisted(() => ({
  fetchPaymentProducts: vi.fn(),
  readyPayment: vi.fn(),
}));

vi.mock('@/lib/payment-api', () => paymentApi);

import MembershipPage from '../page';

describe('MembershipPage', () => {
  beforeEach(() => {
    paymentApi.fetchPaymentProducts.mockReset().mockResolvedValue([
      {
        productCode: 'MEMBERSHIP_30D',
        purpose: 'MEMBERSHIP_PASS',
        name: 'GamerIN 멤버십 30일',
        price: 9_900,
        mileage: null,
        durationDays: 30,
      },
    ]);
    paymentApi.readyPayment.mockReset();
  });

  it('멤버십 가격과 혜택을 표시하고 카카오페이 결제 확인창을 연다', async () => {
    const user = userEvent.setup();
    render(<MembershipPage />);

    expect(await screen.findByText('월 9,900원')).toBeInTheDocument();
    expect(screen.getByText('전용 프로필 배지')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '카카오페이로 멤버십 시작' }));
    expect(screen.getByRole('dialog', { name: '멤버십 결제하기' })).toBeInTheDocument();
  });
});
