import { expect, test, type Page } from '@playwright/test';
import type { PaymentProduct } from '../src/lib/payment-api';

const account = {
  userId: 'viewer',
  handle: 'viewer',
  nickname: '테스터',
  role: 'USER',
  status: 'ACTIVE',
};

const products: PaymentProduct[] = [
  ...[5_000, 10_000, 20_000, 50_000].map((price) => ({
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
    name: 'GamerIN 멤버십 30일',
    price: 9_900,
    mileage: null,
    durationDays: 30,
  },
];

async function mockWallet(page: Page) {
  await page.addInitScript((user) => {
    localStorage.setItem('gamerin_user', JSON.stringify({
      id: user.userId,
      ...user,
      name: user.nickname,
      gameTier: 'Unranked',
    }));
  }, account);

  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = null;

    if (path.endsWith('/auth/refresh')) data = { userId: account.userId, accessToken: 'wallet-test-token' };
    else if (path.endsWith('/auth/me')) data = account;
    else if (path.endsWith('/notifications/unread-count')) data = { unreadCount: 0 };
    else if (path.endsWith('/payments/products')) data = products;
    else if (path.endsWith('/mileage/me/balance')) data = { currentBalance: 12_500 };
    else if (path.endsWith('/mileage/me/transactions')) {
      data = { content: [], totalPages: 0, totalElements: 0, number: 0, size: 10 };
    } else if (path === '/api/v1/payments') {
      data = { items: [], nextCursor: null, hasNext: false };
    }

    await route.fulfill({ json: { success: true, data } });
  });
}

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
]) {
  test('카카오페이 지갑 통합 UI: ' + viewport.name, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockWallet(page);
    await page.goto('/wallet');

    await expect(page.getByRole('heading', { name: '내 지갑' })).toBeVisible();
    await expect(page.getByText('12,500 M')).toBeVisible();

    const amounts = page.locator('button[aria-pressed]');
    await expect(amounts).toHaveCount(4);
    await expect(page.getByRole('button', { name: '카카오페이로 5,000원 결제' })).toBeEnabled();

    if (viewport.name === 'mobile') {
      const first = await amounts.nth(0).boundingBox();
      const second = await amounts.nth(1).boundingBox();
      const third = await amounts.nth(2).boundingBox();
      expect(first?.y).toBe(second?.y);
      expect((third?.y ?? 0) > (first?.y ?? 0)).toBe(true);
    }

    await page.screenshot({
      path: '/tmp/gamerin-wallet-' + viewport.name + '.png',
      fullPage: true,
    });
  });
}

test('지갑에서 멤버십 화면으로 이동한다', async ({ page }) => {
  await mockWallet(page);
  await page.goto('/wallet');

  await page.getByRole('link', { name: /멤버십 혜택/ }).click();
  await expect(page).toHaveURL(/\/membership$/);
  await expect(page.getByText('월 9,900원')).toBeVisible();
  await expect(page.getByRole('button', { name: '카카오페이로 멤버십 시작' })).toBeEnabled();
});
