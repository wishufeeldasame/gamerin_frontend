import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ push: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
const paymentApi = vi.hoisted(() => ({
  approvePayment: vi.fn(),
  getPayment: vi.fn(),
  readyPayment: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/context/ToastContext', () => ({ useToast: () => toast }));
vi.mock('@/lib/payment-api', () => paymentApi);

import { KakaoPaymentDialog } from '../KakaoPaymentDialog';

const product = {
  productCode: 'CHARGE_10000', purpose: 'MILEAGE_CHARGE' as const, name: '마일리지 10,000',
  price: 10_000, mileage: 10_000, durationDays: null,
};

function fakePopup() {
  return { closed: false, close: vi.fn(), focus: vi.fn(), postMessage: vi.fn(), location: { href: '' } };
}

async function openPopupPayment() {
  const user = userEvent.setup();
  const popup = fakePopup();
  vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
  render(<KakaoPaymentDialog product={product} returnTo="/mentoring?programId=p1" onClose={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: '카카오페이로 결제' }));
  await screen.findByRole('dialog', { name: '결제 진행 중' });
  return { popup, user };
}

function post(data: unknown, source: unknown, origin = window.location.origin) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin, source: source as Window }));
  });
}

describe('KakaoPaymentDialog', () => {
  beforeEach(() => {
    router.push.mockReset();
    toast.info.mockReset();
    paymentApi.readyPayment.mockReset().mockResolvedValue({
      orderId: 'o1', status: 'READY', pcUrl: 'https://kakao.test/pc', mobileUrl: 'https://kakao.test/m',
    });
    paymentApi.approvePayment.mockReset().mockResolvedValue({ orderId: 'o1', status: 'APPROVED' });
    paymentApi.getPayment.mockReset().mockResolvedValue({ orderId: 'o1', status: 'READY' });
    window.sessionStorage.clear();
  });

  it('팝업이 차단되면 ready를 호출하지 않고 안내한다', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'open').mockReturnValue(null);
    render(<KakaoPaymentDialog product={product} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '카카오페이로 결제' }));

    expect(screen.getByRole('alert')).toHaveTextContent('팝업이 차단되었습니다.');
    expect(paymentApi.readyPayment).not.toHaveBeenCalled();
  });

  it('팝업에 결제창을 열고 복귀 경로를 주문별로 저장한다', async () => {
    const { popup } = await openPopupPayment();

    expect(popup.location.href).toBe('https://kakao.test/pc');
    expect(paymentApi.readyPayment).toHaveBeenCalledWith('CHARGE_10000', expect.any(String));
    expect(JSON.parse(window.sessionStorage.getItem('gamerin_payment_return_to') ?? '{}')).toEqual({
      orderId: 'o1', returnTo: '/mentoring?programId=p1',
    });
  });

  it('다른 origin·다른 창·다른 orderId 메시지는 무시하고, 맞는 결과만 한 번 승인한다', async () => {
    const { popup } = await openPopupPayment();
    const approval = { type: 'kakaopay-result', orderId: 'o1', result: 'approval', pgToken: 'tok' };

    post(approval, popup, 'https://evil.test');
    post(approval, window);
    post({ ...approval, orderId: 'other' }, popup);
    expect(paymentApi.approvePayment).not.toHaveBeenCalled();

    post(approval, popup);
    post(approval, popup);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/payments/result?orderId=o1'));
    expect(paymentApi.approvePayment).toHaveBeenCalledTimes(1);
    expect(paymentApi.approvePayment).toHaveBeenCalledWith('o1', 'tok');
    expect(popup.postMessage).toHaveBeenCalledWith({ type: 'kakaopay-result-ack', orderId: 'o1' }, window.location.origin);
  });

  it('ready 재응답이 CREATED면 같은 requestId로 다시 시도하게 하고, FAILED면 새 requestId를 만든다', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'open').mockImplementation(() => fakePopup() as unknown as Window);
    paymentApi.readyPayment
      .mockResolvedValueOnce({ orderId: 'o1', status: 'CREATED', pcUrl: null, mobileUrl: null })
      .mockResolvedValueOnce({ orderId: 'o1', status: 'FAILED', pcUrl: null, mobileUrl: null })
      .mockResolvedValueOnce({ orderId: 'o2', status: 'FAILED', pcUrl: null, mobileUrl: null });
    render(<KakaoPaymentDialog product={product} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '카카오페이로 결제' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('결제를 준비하고 있어요.');
    await user.click(screen.getByRole('button', { name: '카카오페이로 결제' }));
    await screen.findByText('카카오페이 결제창을 열 수 없어요. 다시 시도해주세요.');
    await user.click(screen.getByRole('button', { name: '카카오페이로 결제' }));
    await waitFor(() => expect(paymentApi.readyPayment).toHaveBeenCalledTimes(3));

    const ids = paymentApi.readyPayment.mock.calls.map((call) => call[1]);
    expect(ids[1]).toBe(ids[0]);
    expect(ids[2]).not.toBe(ids[1]);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('결제 중단은 주문을 조회하고 READY면 취소 안내 후 닫는다', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    vi.spyOn(window, 'open').mockReturnValue(fakePopup() as unknown as Window);
    render(<KakaoPaymentDialog product={product} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '카카오페이로 결제' }));
    await user.click(await screen.findByRole('button', { name: '결제 중단' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.info).toHaveBeenCalledWith('결제가 취소되었습니다.');
    expect(paymentApi.approvePayment).not.toHaveBeenCalled();
  });
});
