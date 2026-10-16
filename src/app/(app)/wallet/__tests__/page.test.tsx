import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mileageApi = vi.hoisted(() => ({
  fetchMyMileageBalance: vi.fn(),
  fetchMyMileageTransactions: vi.fn(),
}));
const paymentApi = vi.hoisted(() => ({
  fetchMyPayments: vi.fn(),
  fetchPaymentProducts: vi.fn(),
  readyPayment: vi.fn(),
}));

vi.mock('@/lib/mileage-api', () => mileageApi);
vi.mock('@/lib/payment-api', () => paymentApi);

import WalletPage from '../page';

const products = [5_000, 10_000, 20_000, 50_000].map((price) => ({
  productCode: 'CHARGE_' + price,
  purpose: 'MILEAGE_CHARGE',
  name: '마일리지 ' + price.toLocaleString('ko-KR'),
  price,
  mileage: price,
  durationDays: null,
}));

describe('WalletPage', () => {
  beforeEach(() => {
    mileageApi.fetchMyMileageBalance.mockReset().mockResolvedValue({ currentBalance: 12_500 });
    mileageApi.fetchMyMileageTransactions.mockReset().mockResolvedValue({
      content: [],
      totalPages: 0,
      totalElements: 0,
      number: 0,
      size: 10,
    });
    paymentApi.fetchPaymentProducts.mockReset().mockResolvedValue(products);
    paymentApi.fetchMyPayments.mockReset().mockResolvedValue({ items: [], nextCursor: null, hasNext: false });
    paymentApi.readyPayment.mockReset();
  });

  it('잔액을 금액 선택 위에 표시하고 충전 상품 네 개를 2열 모바일 그리드로 제공한다', async () => {
    render(<WalletPage />);

    expect(await screen.findByText('12,500 M')).toBeInTheDocument();
    const amountButtons = screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-pressed'));
    expect(amountButtons).toHaveLength(4);
    expect(amountButtons[0]).toHaveAttribute('aria-pressed', 'true');
    expect(amountButtons[0].parentElement).toHaveClass('grid-cols-2', 'sm:grid-cols-4');
  });

  it('금액 선택 후 카카오페이 결제 확인창을 연다', async () => {
    const user = userEvent.setup();
    render(<WalletPage />);

    await screen.findByText('12,500 M');
    const amount = screen.getAllByRole('button').find((button) => button.textContent?.includes('20,000원'));
    expect(amount).toBeDefined();
    await user.click(amount!);

    const pay = screen.getByRole('button', { name: '카카오페이로 20,000원 결제' });
    await waitFor(() => expect(amount).toHaveAttribute('aria-pressed', 'true'));
    await user.click(pay);

    expect(screen.getByRole('dialog', { name: '카카오페이로 충전하기' })).toBeInTheDocument();
  });
});
