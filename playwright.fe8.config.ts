import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// A separate frontend instance; these tests mock all API requests.
export default defineConfig({
  ...base,
  webServer: undefined,
  use: { ...base.use, baseURL: process.env.FE8_BASE_URL ?? 'http://127.0.0.1:3106' },
});
