import { expect, test, type Page, type Route } from '@playwright/test';

const activeAdmin = {
  userId: '11111111-1111-1111-1111-111111111111',
  handle: 'admin',
  nickname: 'Admin',
  role: 'ROLE_ADMIN',
  status: 'ACTIVE',
};

async function mockAuth(page: Page) {
  await page.route('**/api/v1/auth/**', async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/login') || path.endsWith('/refresh')) {
      await route.fulfill({
        json: { success: true, data: { ...activeAdmin, accessToken: 'e2e-token' } },
      });
      return;
    }
    if (path.endsWith('/me')) {
      await route.fulfill({ json: { success: true, data: activeAdmin } });
      return;
    }
    await route.fulfill({ json: { success: true, data: null } });
  });
}

async function seedAdmin(page: Page) {
  await page.addInitScript((admin) => {
    window.localStorage.setItem(
      'gamerin_user',
      JSON.stringify({
        id: admin.userId,
        name: admin.nickname,
        nickname: admin.nickname,
        gameTier: '',
        handle: admin.handle,
        role: admin.role,
        status: admin.status,
      }),
    );
  }, activeAdmin);
}

async function mockEmptyAdminReports(page: Page) {
  await page.route('**/api/v1/admin/reports**', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          content: [],
          totalPages: 0,
          totalElements: 0,
          number: 0,
          size: 10,
          first: true,
          last: true,
          empty: true,
        },
      },
    });
  });
}

test('guard redirects an unauthenticated visitor to admin login', async ({ page }) => {
  await page.goto('/admin/reports');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('admin can log in and log out with server session cleanup', async ({ page }) => {
  await mockAuth(page);
  await mockEmptyAdminReports(page);

  await page.goto('/admin/login');
  await page.locator('#admin-id').fill('admin');
  await page.locator('#admin-password').fill('password');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.evaluate(() => localStorage.getItem('gamerin_user'))).resolves.toBeNull();
});

test('admin API 403 opens the forbidden page without clearing the session', async ({ page }) => {
  await seedAdmin(page);
  await mockAuth(page);
  await page.route('**/api/v1/admin/reports**', async (route) => {
    await route.fulfill({
      status: 403,
      json: { success: false, message: 'Forbidden' },
    });
  });

  await page.goto('/admin/reports');
  await expect(page).toHaveURL(/\/admin\/forbidden$/);
  await expect(page.evaluate(() => localStorage.getItem('gamerin_user'))).resolves.not.toBeNull();
});

test('admin API 401 clears the session and opens the admin login page', async ({ page }) => {
  await seedAdmin(page);
  await mockAuth(page);
  await page.route('**/api/v1/admin/reports**', async (route) => {
    await route.fulfill({
      status: 401,
      json: { success: false, message: 'Unauthorized' },
    });
  });

  await page.goto('/admin/reports');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.evaluate(() => localStorage.getItem('gamerin_user'))).resolves.toBeNull();
});

test('a delayed logout prevents a new admin login until cleanup completes', async ({ page }) => {
  let finishLogout: (() => void) | undefined;
  await page.route('**/api/v1/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/logout')) {
      await new Promise<void>((resolve) => {
        finishLogout = resolve;
      });
      await route.fulfill({ json: { success: true, data: null } });
      return;
    }
    if (path.endsWith('/login') || path.endsWith('/refresh')) {
      await route.fulfill({
        json: { success: true, data: { ...activeAdmin, accessToken: 'e2e-token' } },
      });
      return;
    }
    await route.fulfill({ json: { success: true, data: activeAdmin } });
  });
  await mockEmptyAdminReports(page);

  await page.goto('/admin/login');
  await page.locator('#admin-id').fill('admin');
  await page.locator('#admin-password').fill('password');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('button', { name: '이전 세션 정리 중...' })).toBeDisabled();

  finishLogout?.();
  await expect(page.getByRole('button', { name: '로그인' })).toBeEnabled();
});

test('logout in one admin tab is synchronized to another tab', async ({ page, context }) => {
  await mockAuth(page);
  await mockEmptyAdminReports(page);
  await page.goto('/admin/login');
  await page.locator('#admin-id').fill('admin');
  await page.locator('#admin-password').fill('password');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin$/);

  const secondPage = await context.newPage();
  await mockAuth(secondPage);
  await mockEmptyAdminReports(secondPage);
  await secondPage.goto('/admin/reports');
  await expect(secondPage).toHaveURL(/\/admin\/reports$/);

  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(secondPage).toHaveURL(/\/admin\/login$/);
  await expect(
    secondPage.evaluate(() => localStorage.getItem('gamerin_user')),
  ).resolves.toBeNull();
});
