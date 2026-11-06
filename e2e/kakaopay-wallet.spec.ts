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

for (const theme of ['dark', 'light'] as const) for (const width of [1440, 375, 320]) {
  test(`지갑 v2 배치 및 결제창: ${theme} ${width}px`, async ({ context, page }, info) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1024 : 844 });
    await mockWallet(context);
    await context.addInitScript((mode) => localStorage.setItem('gamerin_user_settings', JSON.stringify({ theme: mode })), theme);
    await context.route('**/api/v1/mileage/me/transactions?**', route => route.fulfill({
      json: { success: true, data: { last: true, content: [
        { id: 'out', amount: -15000, typeDescription: '멘토링 신청', description: '랭크 게임 코칭', createdAt: '2026-11-04T20:40:00+09:00' },
        { id: 'in', amount: 10000, typeDescription: '카카오페이 충전', description: '마일리지 충전', createdAt: '2026-11-03T21:12:00+09:00' },
      ] } },
    }));
    await page.goto('/wallet');

    await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
    await expect(page.getByRole('heading', { name: '내 지갑' })).toBeVisible();
    await expect(page.getByRole('button', { name: '뒤로', exact: true })).toHaveCount(width === 1440 ? 0 : 1);
    await expect(page.getByRole('button', { name: '검색 열기' })).toHaveCount(0);
    const radios = page.getByRole('radio');
    await expect(radios).toHaveCount(4);
    await expect(page.getByRole('button', { name: '충전 금액을 선택해 주세요' })).toBeDisabled();

    const group = page.getByRole('radiogroup');
    const first = (await radios.nth(0).boundingBox())!;
    const second = (await radios.nth(1).boundingBox())!;
    const history = page.getByRole('tablist', { name: '지갑 내역' });
    const historyBox = (await history.boundingBox())!;
    expect(first.y).toBe(second.y);
    expect(historyBox.x > (await group.boundingBox())!.x).toBe(width === 1440);

    const mileageTab = page.getByRole('tab', { name: '마일리지 내역' });
    const paymentTab = page.getByRole('tab', { name: '결제 내역' });
    await mileageTab.focus();
    await mileageTab.press('ArrowRight');
    await expect(paymentTab).toBeFocused();
    await expect(page.getByRole('tabpanel', { name: '결제 내역' })).toBeVisible();
    await paymentTab.press('Home');
    await expect(page.getByRole('tabpanel', { name: '마일리지 내역' }).getByText('+10,000 M')).toBeVisible();

    await radios.nth(1).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath('wallet.png'), animations: 'disabled' });
    await page.getByRole('button', { name: '카카오페이로 10,000원 결제' }).click();
    const dialog = page.getByRole('dialog', { name: '카카오페이로 충전하기' });
    await expect(dialog).toBeVisible();
    const dialogBox = (await dialog.boundingBox())!;
    expect(Math.abs(dialogBox.y + dialogBox.height - (width === 1440 ? 1024 : 844)) < 2).toBe(width !== 1440);
    await page.screenshot({ path: info.outputPath('kakao-dialog.png'), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
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
  await expect(page.getByRole('heading', { name: '10,000 M이 충전되었습니다' })).toBeVisible();
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

  await expect(popup.getByRole('heading', { name: '10,000 M이 충전되었습니다' })).toBeVisible();
  await expect(popup).not.toHaveURL(/pg_token/);
  expect(state.approve).toBe(1);
});

test.describe('모바일 웹', () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148' });

  test('같은 탭에서 결제창으로 이동했다가 결과 페이지에서 승인한다', async ({ context, page }) => {
    const state = await mockWallet(context);
    await choosePackage(page);
    await page.getByRole('button', { name: '카카오페이로 결제' }).click();

    await expect(page.getByRole('heading', { name: '10,000 M이 충전되었습니다' })).toBeVisible();
    await expect(page).not.toHaveURL(/pg_token/);
    expect(state.approve).toBe(1);
  });
});

test('결과 불명은 재조회로 확정한다', async ({ context, page }) => {
  await mockWallet(context, { paymentStatuses: ['APPROVING', 'APPROVED'] });
  await page.goto('/payments/result?orderId=o1');

  await expect(page.getByRole('heading', { name: '결제 결과를 확인하고 있습니다' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '10,000 M이 충전되었습니다' })).toBeVisible({ timeout: 8_000 });
});

test('지갑에서 멤버십 화면으로 이동한다', async ({ context, page }) => {
  await mockWallet(context);
  await page.goto('/wallet');

  await page.getByRole('link', { name: /멤버십 혜택/ }).click();
  await expect(page).toHaveURL(/\/membership$/);
  await expect(page.getByText('30일 이용권 4,900원')).toBeVisible();
  await expect(page.getByRole('button', { name: '카카오페이로 4,900원 결제' })).toBeEnabled();
});
