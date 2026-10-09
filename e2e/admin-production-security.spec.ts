import { expect, test } from '@playwright/test';

test.describe('isolated production Docker checks', () => {
  test.skip(process.env.ADMIN_DOCKER_REVIEW !== '1', 'Runs against the isolated production image with generated benign image fixtures.');

  test('preserves security headers and the login redirect', async ({ request }) => {
    const response = await request.get('/admin/login');
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).not.toContain("'unsafe-eval'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-powered-by']).toBeUndefined();
    const root = await request.get('/', { maxRedirects: 0 });
    expect(root.status()).toBe(308);
    expect(root.headers().location).toBe('/login');
  });

  test('optimizes normal images and rejects an unapproved remote origin', async ({ request }) => {
    for (const path of ['/logo.png', '/google.png', '/__admin_review.png', '/__admin_review.jpg', '/__admin_review.webp', '/__admin_review.avif']) {
      const response = await request.get('/_next/image?' + new URLSearchParams({ url: path, w: '128', q: '75' }), { headers: { Accept: 'image/webp' } });
      expect(response.status(), path).toBe(200);
      expect(response.headers()['content-type'], path).toMatch(/^image\//);
      expect((await response.body()).byteLength, path).toBeGreaterThan(0);
    }
    const denied = await request.get('/_next/image?' + new URLSearchParams({ url: 'https://example.invalid/forbidden.png', w: '128', q: '75' }));
    expect(denied.status()).toBe(400);
  });
});
