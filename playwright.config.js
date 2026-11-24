import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    // Uses the Google Chrome already installed on the machine, so no browser download is needed.
    channel: "chrome",
    locale: "en-IN",
  },
  webServer: {
    command: "npx http-server -p 4173 -a 127.0.0.1 -c-1 --silent .",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: !process.env.CI,
  },
});
