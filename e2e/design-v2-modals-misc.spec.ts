import { expect, test, type Locator, type Page } from '@playwright/test';
import { auditPost, auditUser, installAuditFixture } from './support/fe8-audit';

for (const connectedGame of ['RIOT', 'VALORANT', 'PUBG', 'R6']) {
  test(`${connectedGame} 연동 상태를 전적 연결 모달에 반영한다`, async ({ page }) => {
    await installAuditFixture(page, 'dark');
    await page.route('**/api/v1/users/{me,viewer}', route => route.fulfill({ json: { success: true, data: {
      id: 'viewer', handle: 'viewer', nickname: '테스터', followersCount: 0, followingCount: 0, postCount: 0, mediaPostCount: 0, mediaItemCount: 0,
      gameStats: { [connectedGame]: { connected: true } },
    } } }));
    await page.goto('/profile/viewer');
    await page.getByRole('tab', { name: '전적', exact: true }).click();
    await page.getByRole('button', { name: '전적 추가', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '게임 전적 연결', exact: true });
    for (const [key, name] of [['RIOT', 'League of Legends'], ['VALORANT', 'VALORANT'], ['PUBG', 'PUBG'], ['R6', 'Rainbow Six Siege']]) {
      const row = modal.locator('div.group').filter({ has: page.getByRole('heading', { name, exact: true }) });
      if (key === connectedGame) {
        await expect(row.getByRole('button', { name: '연동 완료', exact: true })).toBeDisabled();
        await expect(row.getByRole('button', { name: '연결', exact: true })).toHaveCount(0);
      } else {
        await expect(row.getByRole('button', { name: '연결', exact: true })).toBeEnabled();
      }
    }
  });
}

async function checkPanel(page: Page, panel: Locator, width: number) {
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('transform', 'none');
  await expect.poll(() => panel.evaluate(element => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      if (Number(getComputedStyle(node).opacity) < 1) return false;
    }
    return true;
  })).toBe(true);
  const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  await expect(panel).toHaveCSS('background-color', dark ? 'rgb(34, 34, 38)' : 'rgb(255, 255, 255)');
  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(box.y + box.height).toBeLessThanOrEqual(900);
  if (width < 1024) expect(Math.round(box.y + box.height)).toBe(900);
  else expect(box.width).toBeLessThanOrEqual(560);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`공통 모달 v2 ${theme} ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await installAuditFixture(page, theme);
      await page.goto('/posts/1');
      await page.getByRole('button', { name: '게시글 공유', exact: true }).click();
      const share = page.getByRole('dialog', { name: '게시글 공유', exact: true });
      await checkPanel(page, share, width);
      await expect(share.getByRole('button', { name: '보내기', exact: true })).toBeDisabled();
      const recipient = share.getByRole('button', { name: /대화상대/ });
      await recipient.click();
      await expect(recipient).toHaveAttribute('aria-pressed', 'true');
      await expect(share.getByRole('button', { name: '보내기', exact: true })).toHaveCSS('background-color', 'rgb(245, 185, 61)');
      await expect(share.getByRole('textbox', { name: '게시글 링크' })).toHaveValue(/\/posts\/1$/);
      await share.getByRole('textbox', { name: '공유 메시지' }).fill('함께 볼 게시글');
      await page.screenshot({ path: info.outputPath('share.png') });
      await page.keyboard.press('Escape');
      await expect(share).toHaveCount(0);

      await page.getByRole('button', { name: '게시글 메뉴', exact: true }).click();
      await page.getByRole('button', { name: '게시글 신고', exact: true }).click();
      const report = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /신고/ }) });
      await checkPanel(page, report, width);
      await report.getByRole('button', { name: '스팸', exact: true }).click();
      await expect(report.getByRole('button', { name: '스팸', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.screenshot({ path: info.outputPath('report.png') });
      await report.getByRole('button', { name: '취소', exact: true }).click();

      await page.route('**/api/v1/posts/{post-1,by-number/1}', route => route.fulfill({ json: { success: true, data: { ...auditPost, bookmarkedByMe: false } } }));
      await page.reload();
      await page.getByRole('button', { name: '북마크 저장', exact: true }).click();
      const collection = page.getByRole('dialog', { name: '모음집에 저장', exact: true });
      await checkPanel(page, collection, width);
      await collection.getByRole('button', { name: '새 모음집 만들기' }).click();
      await collection.getByRole('textbox', { name: '모음집 이름' }).fill('새 게임 모음');
      await page.screenshot({ path: info.outputPath('collection.png') });
      await collection.getByRole('button', { name: '모달 닫기' }).click();

      await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { success: true, data: { ...auditUser, membershipBadge: true } } }));
      await page.route('**/api/v1/posts/{post-1,by-number/1}', route => route.fulfill({ json: { success: true, data: {
        ...auditPost, mine: true, authorHandle: 'viewer', editCount: 0, editableUntil: new Date(Date.now() + 600_000).toISOString(),
      } } }));
      await page.reload();
      await page.getByRole('button', { name: '게시글 메뉴', exact: true }).click();
      await page.getByRole('button', { name: '수정', exact: true }).click();
      const editor = page.getByRole('dialog', { name: '게시글 수정', exact: true });
      await checkPanel(page, editor, width);
      await expect(editor.getByRole('button', { name: '수정하기', exact: true })).toBeDisabled();
      await editor.getByRole('textbox', { name: '게시글 본문' }).fill('수정할 내용');
      await expect(editor.getByRole('button', { name: '수정하기', exact: true })).toBeEnabled();
      await expect(editor.getByRole('button', { name: '수정하기', exact: true })).toHaveCSS('background-color', 'rgb(245, 185, 61)');
      await page.screenshot({ path: info.outputPath('edit-post.png') });
      await editor.getByRole('button', { name: '취소', exact: true }).click();
      await page.getByRole('button', { name: '게시글 메뉴', exact: true }).click();
      await page.getByRole('button', { name: '삭제', exact: true }).click();
      const confirm = page.getByRole('alertdialog');
      await expect(confirm).toBeVisible();
      await expect(confirm).toHaveCSS('background-color', theme === 'dark' ? 'rgb(34, 34, 38)' : 'rgb(255, 255, 255)');
      await confirm.getByRole('button', { name: '취소', exact: true }).click();

      await page.goto('/profile/viewer');
      await page.getByRole('button', { name: '프로필 수정', exact: true }).click();
      const profile = page.getByRole('dialog', { name: '프로필 수정', exact: true });
      await checkPanel(page, profile, width);
      await expect(profile.getByRole('textbox', { name: '닉네임' })).toHaveValue('테스터');
      await page.screenshot({ path: info.outputPath('edit-profile.png') });
      await profile.getByRole('button', { name: '닫기', exact: true }).click();
      await page.getByRole('tab', { name: '전적', exact: true }).click();
      await page.getByRole('button', { name: '전적 추가', exact: true }).click();
      const games = page.getByRole('dialog', { name: '게임 전적 연결', exact: true });
      await checkPanel(page, games, width);
      const lol = games.getByRole('heading', { name: 'League of Legends', exact: true }).locator('..').locator('..').locator('..');
      await lol.getByRole('button', { name: '연결', exact: true }).click();
      await games.getByRole('textbox', { name: 'Riot ID', exact: true }).fill('시안#KR1');
      await page.screenshot({ path: info.outputPath('game-connect.png') });
      await page.keyboard.press('Escape');
      await expect(games.getByRole('textbox', { name: 'Riot ID', exact: true })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(games).toHaveCount(0);
    });

    test(`결제 결과·약관 v2 ${theme} ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await installAuditFixture(page, theme);
      for (const status of ['APPROVED', 'FAILED', 'APPROVING']) {
        await page.route('**/api/v1/payments/v2-order', route => route.fulfill({ json: { success: true, data: {
          orderId: 'v2-order', status, purpose: 'MILEAGE_CHARGE', productCode: 'CHARGE_10000', itemName: '마일리지 10,000', amount: 10000,
        } } }));
        await page.goto('/payments/result?orderId=v2-order');
        const title = status === 'APPROVED' ? '10,000 M이 충전되었습니다' : status === 'FAILED' ? '결제가 완료되지 않았습니다' : '결제 결과를 확인하고 있습니다';
        await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
        if (status === 'APPROVED') await expect(page.getByRole('link', { name: '지갑으로' })).toHaveCSS('background-color', 'rgb(245, 185, 61)');
        await page.screenshot({ path: info.outputPath(`payment-${status}.png`) });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      for (const [path, title] of [['/terms', '이용약관'], ['/privacy', '개인정보 처리방침']]) {
        await page.goto(path);
        await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible();
        await expect(page.locator('main')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(25, 25, 29)' : 'rgb(250, 250, 250)');
        await expect(page.getByText(/법률 검토를 거치지 않아/)).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`${path.slice(1)}.png`) });
      }
    });
  }
}
