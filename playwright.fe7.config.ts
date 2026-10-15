import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Run against a separately started instance; never reuse or restart the shared stack.
export default defineConfig({
  ...base,
  webServer: undefined,
  use: { ...base.use, baseURL: process.env.FE7_BASE_URL ?? 'http://127.0.0.1:3102' },
});
