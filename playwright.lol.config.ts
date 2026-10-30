import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Use the production build on a separate port without reusing an existing dev server.
export default defineConfig({
  ...base,
  testMatch: 'lol-integration.spec.ts',
  use: { ...base.use, baseURL: 'http://127.0.0.1:3101' },
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port 3101',
    url: 'http://127.0.0.1:3101/admin/login',
    reuseExistingServer: false,
  },
});
