import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mileageApi = vi.hoisted(() => ({
  fetchMyMileageBalance: vi.fn(),
  fetchMyMileageTransactions: vi.fn(),
}));
const search = vi.hoisted(() => ({ query: '' }));
const paymentApi = vi.hoisted(() => ({
  fetchMyPayments: vi.fn(),
  fetchPaymentProducts: vi.fn(),
  readyPayment: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search.query),
}));
vi.mock('@/app/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock('@/lib/mileage-api', () => mileageApi);
vi.mock('@/lib/payment-api', () => paymentApi);

import WalletPage from '../page';

const products = [5_000, 10_000, 30_000, 50_000].map((price) => ({
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

  it('잔액과 서버 충전 상품 네 개를 radiogroup으로 보여주고, 선택 전에는 결제 버튼을 막는다', async () => {
    render(<WalletPage />);

    expect(await screen.findByText('12,500 M')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '얼마를 충전할까요?' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(radios.every((radio) => radio.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(screen.getByRole('button', { name: '충전 금액을 선택해주세요' })).toBeDisabled();
  });

  it('화살표 키로 패키지를 고르고 카카오페이 결제 확인창을 연다', async () => {
    const user = userEvent.setup();
    render(<WalletPage />);

    await screen.findByText('12,500 M');
    const radios = screen.getAllByRole('radio');
    await user.click(radios[0]);
    await user.keyboard('{ArrowRight}');
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveFocus();

    await user.click(screen.getByRole('button', { name: '카카오페이로 10,000원 결제' }));
    expect(screen.getByRole('dialog', { name: '카카오페이로 충전하기' })).toBeInTheDocument();
  });

  it('returnTo 안내를 보여주고 외부 경로는 무시한다', async () => {
    search.query = 'returnTo=%2Fmentoring%3FprogramId%3Dp1';
    const { unmount } = render(<WalletPage />);
    expect(await screen.findByText('충전 후 멘토링 신청으로 돌아갑니다.')).toBeInTheDocument();
    unmount();

    search.query = 'returnTo=https%3A%2F%2Fevil.test';
    render(<WalletPage />);
    await screen.findByText('12,500 M');
    expect(screen.queryByText('충전 후 멘토링 신청으로 돌아갑니다.')).not.toBeInTheDocument();
    search.query = '';
  });

  it('결제 내역은 확인된 결제만 상태 배지·결제 수단과 함께 보여주고 커서로 더 불러온다', async () => {
    const user = userEvent.setup();
    const payment = {
      orderId: 'o1', status: 'APPROVED', purpose: 'MILEAGE_CHARGE', productCode: 'CHARGE_10000',
      itemName: '마일리지 10,000', amount: 10_000, paymentMethodType: 'MONEY',
      createdAt: '2026-10-15T10:00:00+09:00', approvedAt: '2026-10-15T10:01:00+09:00', canceledAt: null,
    };
    paymentApi.fetchMyPayments
      .mockResolvedValueOnce({ items: [payment, { ...payment, orderId: 'o2', status: 'READY' }], nextCursor: 'c1', hasNext: true })
      .mockResolvedValueOnce({ items: [{ ...payment, orderId: 'o3', status: 'NEEDS_REVIEW', itemName: '멤버십 30일 이용권' }], nextCursor: null, hasNext: false });
    search.query = 'tab=payments';
    render(<WalletPage />);

    expect(await screen.findByText('완료')).toBeInTheDocument();
    expect(screen.getByText(/카카오페이머니/)).toBeInTheDocument();
    expect(screen.getAllByText('마일리지 10,000')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '더 보기' }));
    expect(await screen.findByText('확인 중')).toBeInTheDocument();
    expect(paymentApi.fetchMyPayments).toHaveBeenLastCalledWith('c1');
    expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument();
    search.query = '';
  });
});
