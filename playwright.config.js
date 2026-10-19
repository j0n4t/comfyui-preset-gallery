// @ts-check
import { defineConfig, devices } from '@playwright/test';

const HARNESS_PORT = 8878;
const HARNESS_URL = `http://127.0.0.1:${HARNESS_PORT}/dev/index.html`;

/**
 * The UI suite runs against dev/serve.py, which serves the real web/ modules
 * with a stubbed ComfyUI host and no backend. That is why there is no ComfyUI
 * boot choreography here any more: the old suite opened ComfyUI's menus and
 * right-clicked the canvas, and broke wholesale when the frontend dropped
 * .comfy-menu-button-wrapper.
 *
 * tests/e2e/comfyui_integration.spec.ts is the exception - it drives the real
 * ComfyUI on :8188 and skips itself when that is not running.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://127.0.0.1:${HARNESS_PORT}`,
    trace: 'on-first-retry',
  },

  webServer: {
    command: `python dev/serve.py ${HARNESS_PORT}`,
    url: HARNESS_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },

    // Enable these after `npx playwright install` - the binaries are not
    // present on this machine, so the projects fail on launch.
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
