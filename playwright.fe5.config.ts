import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Validate a separately started instance without reusing the shared Docker stack.
export default defineConfig({
  ...base,
  webServer: undefined,
  use: { ...base.use, baseURL: process.env.FE5_BASE_URL ?? 'http://127.0.0.1:3105' },
});
