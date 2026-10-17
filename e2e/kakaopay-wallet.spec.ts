import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { PaymentProduct, PaymentResponse } from '../src/lib/payment-api';

// 13-7-2절: 실제 결제 대신 page.route로 계약 응답을 대체한다.
const account = {
  userId: 'viewer',
  handle: 'viewer',
  nickname: '테스터',
  role: 'USER',
  status: 'ACTIVE',
  membershipBadge: false,
};

const products: PaymentProduct[] = [
  ...[5_000, 10_000, 30_000, 50_000].map((price) => ({
    productCode: 'CHARGE_' + price,
    purpose: 'MILEAGE_CHARGE' as const,
    name: '마일리지 ' + price.toLocaleString('ko-KR'),
    price,
    mileage: price,
    durationDays: null,
  })),
  {
    productCode: 'MEMBERSHIP_30D',
    purpose: 'MEMBERSHIP_PASS',
    name: '멤버십 30일 이용권',
    price: 4_900,
    mileage: null,
    durationDays: 30,
  },
];

const ORIGIN = 'http://127.0.0.1:3000';
const resultUrl = (query: string) => `${ORIGIN}/payments/result?${query}`;

function payment(status: PaymentResponse['status']): PaymentResponse {
  return {
    orderId: 'o1',
    status,
    purpose: 'MILEAGE_CHARGE',
    productCode: 'CHARGE_10000',
    itemName: '마일리지 10,000',
    amount: 10_000,
    paymentMethodType: 'MONEY',
    createdAt: '2026-10-15T10:00:00+09:00',
    approvedAt: status === 'APPROVED' ? '2026-10-15T10:01:00+09:00' : null,
    canceledAt: null,
  };
}

interface WalletMock {
  readyUrl: { pcUrl: string | null; mobileUrl: string | null };
  paymentStatuses: PaymentResponse['status'][];
  approve: number;
  refreshPages: Page[];
}

async function mockWallet(context: BrowserContext, mock: Partial<WalletMock> = {}) {
  const state: WalletMock = {
    readyUrl: { pcUrl: resultUrl('orderId=o1&result=approval&pg_token=tok'), mobileUrl: resultUrl('orderId=o1&result=approval&pg_token=tok') },
    paymentStatuses: ['APPROVED'],
    approve: 0,
    refreshPages: [],
    ...mock,
  };

  await context.addInitScript((user) => {
    localStorage.setItem('gamerin_user', JSON.stringify({ id: user.userId, ...user, name: user.nickname, gameTier: 'Unranked' }));
  }, account);

  await context.route('**/kakao-test-window', (route) => route.fulfill({ contentType: 'text/html', body: '<p>카카오페이 테스트 창</p>' }));
  await context.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let data: unknown = null;

    if (path.endsWith('/auth/refresh')) {
      state.refreshPages.push(request.frame().page());
      data = { userId: account.userId, accessToken: 'wallet-test-token' };
    } else if (path.endsWith('/auth/me')) data = account;
    else if (path.endsWith('/notifications/unread-count')) data = { unreadCount: 0 };
    else if (path.endsWith('/payments/products')) data = products;
    else if (path.endsWith('/payments/kakao/ready')) data = { orderId: 'o1', status: 'READY', ...state.readyUrl };
    else if (path.endsWith('/payments/kakao/approve')) {
      state.approve += 1;
      data = payment('APPROVED');
    } else if (path === '/api/v1/payments/o1') {
      data = payment(state.paymentStatuses.length > 1 ? state.paymentStatuses.shift()! : state.paymentStatuses[0]);
    } else if (path === '/api/v1/payments') data = { items: [], nextCursor: null, hasNext: false };
    else if (path.endsWith('/memberships/me')) data = { active: false, expiresAt: null, price: 4_900, durationDays: 30, benefits: [] };
    else if (path.endsWith('/mileage/me/balance')) data = { currentBalance: 12_500 };
    else if (path.endsWith('/mileage/me/transactions')) {
      data = { content: [], totalPages: 0, totalElements: 0, number: 0, size: 10, last: true };
    }

    await route.fulfill({ json: { success: true, data } });
  });
  return state;
}

async function choosePackage(page: Page) {
  await page.goto('/wallet');
  await expect(page.getByText('12,500 M')).toBeVisible();
  await page.getByRole('radio', { name: /10,000원/ }).click();
  await page.getByRole('button', { name: '카카오페이로 10,000원 결제' }).click();
}

for (const viewport of [
  { name: 'mobile', width: 390, height: 844, columns: 1 },
  { name: 'desktop', width: 1280, height: 900, columns: 2 },
]) {
  test('지갑 충전 패키지 배치: ' + viewport.name, async ({ context, page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockWallet(context);
    await page.goto('/wallet');

    await expect(page.getByRole('heading', { name: '내 지갑' })).toBeVisible();
    const radios = page.getByRole('radio');
    await expect(radios).toHaveCount(4);
    await expect(page.getByRole('button', { name: '충전 금액을 선택해주세요' })).toBeDisabled();

    const first = await radios.nth(0).boundingBox();
    const second = await radios.nth(1).boundingBox();
    expect(first?.y === second?.y).toBe(viewport.columns === 2);
  });
}

test('PC 팝업: 결과를 부모 창이 받아 승인하고, 팝업은 refresh 없이 닫힌다', async ({ context, page }) => {
  const state = await mockWallet(context);
  await choosePackage(page);

  const popupPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: '카카오페이로 결제' }).click();
  const popup = await popupPromise;
  await popup.waitForEvent('close');

  await expect(page).toHaveURL(/\/payments\/result\?orderId=o1$/);
  await expect(page.getByRole('heading', { name: '10,000 M이 충전되었어요' })).toBeVisible();
  expect(state.approve).toBe(1);
  expect(state.refreshPages.filter((owner) => owner === popup)).toHaveLength(0);
});

test('PC 팝업을 그냥 닫으면 모달 안에 취소 안내를 보여주고 다시 결제할 수 있다', async ({ context, page }) => {
  const state = await mockWallet(context, {
    readyUrl: { pcUrl: `${ORIGIN}/kakao-test-window`, mobileUrl: null },
    paymentStatuses: ['READY'],
  });
  await choosePackage(page);

  let popupPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: '카카오페이로 결제' }).click();
  let popup = await popupPromise;
  await expect(page.getByRole('dialog', { name: '결제 진행 중' })).toBeVisible();
  await popup.close();

  const canceled = page.getByRole('dialog', { name: '결제가 취소되었습니다' });
  await expect(canceled).toBeVisible();
  await expect(canceled.getByRole('button', { name: '다시 결제하기' })).toBeFocused();
  expect(state.approve).toBe(0);

  popupPromise = context.waitForEvent('page');
  await canceled.getByRole('button', { name: '다시 결제하기' }).click();
  popup = await popupPromise;
  await expect(page.getByRole('dialog', { name: '결제 진행 중' })).toBeVisible();
  await popup.close();
  await expect(canceled).toBeVisible();

  await canceled.getByRole('button', { name: '닫기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('결제 중 부모 창을 새로고침하면 팝업이 직접 승인한다', async ({ context, page }) => {
  const state = await mockWallet(context, { readyUrl: { pcUrl: `${ORIGIN}/kakao-test-window`, mobileUrl: null } });
  await choosePackage(page);

  const popupPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: '카카오페이로 결제' }).click();
  const popup = await popupPromise;
  await popup.waitForURL('**/kakao-test-window');
  await page.reload();
  await popup.goto(resultUrl('orderId=o1&result=approval&pg_token=tok'));

  await expect(popup.getByRole('heading', { name: '10,000 M이 충전되었어요' })).toBeVisible();
  await expect(popup).not.toHaveURL(/pg_token/);
  expect(state.approve).toBe(1);
});

test.describe('모바일 웹', () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148' });

  test('같은 탭에서 결제창으로 이동했다가 결과 페이지에서 승인한다', async ({ context, page }) => {
    const state = await mockWallet(context);
    await choosePackage(page);
    await page.getByRole('button', { name: '카카오페이로 결제' }).click();

    await expect(page.getByRole('heading', { name: '10,000 M이 충전되었어요' })).toBeVisible();
    await expect(page).not.toHaveURL(/pg_token/);
    expect(state.approve).toBe(1);
  });
});

test('결과 불명은 재조회로 확정한다', async ({ context, page }) => {
  await mockWallet(context, { paymentStatuses: ['APPROVING', 'APPROVED'] });
  await page.goto('/payments/result?orderId=o1');

  await expect(page.getByRole('heading', { name: '결제 결과를 확인하고 있어요' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '10,000 M이 충전되었어요' })).toBeVisible({ timeout: 8_000 });
});

test('지갑에서 멤버십 화면으로 이동한다', async ({ context, page }) => {
  await mockWallet(context);
  await page.goto('/wallet');

  await page.getByRole('link', { name: /멤버십 혜택/ }).click();
  await expect(page).toHaveURL(/\/membership$/);
  await expect(page.getByText('30일 이용권 4,900원')).toBeVisible();
  await expect(page.getByRole('button', { name: '카카오페이로 4,900원 결제' })).toBeEnabled();
});
