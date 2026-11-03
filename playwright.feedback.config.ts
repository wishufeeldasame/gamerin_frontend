import { defineConfig, devices } from '@playwright/test';

// Isolated port: never reuse the user's existing frontend or send requests to their backend.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'feedback.spec.ts',
  workers: 1,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3200' },
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port 3200',
    url: 'http://127.0.0.1:3200/login',
    reuseExistingServer: false,
  },
});
