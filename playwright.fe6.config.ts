import base from './playwright.config';
import { defineConfig } from '@playwright/test';

// PR #110의 기존 개발 서버와 분리해 FE-6 작업트리를 검증한다.
export default defineConfig({
  ...base,
  testMatch: 'fe6-display.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  use: { ...base.use, baseURL: 'http://127.0.0.1:3106', actionTimeout: 15_000, trace: 'retain-on-failure' },
  webServer: {
    command: process.env.FE6_TEST_SERVER === 'development'
      ? 'npm run dev -- --hostname 127.0.0.1 --port 3106'
      : 'npm run build && npm run start -- --hostname 127.0.0.1 --port 3106',
    url: 'http://127.0.0.1:3106/login',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
