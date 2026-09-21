import {defineConfig} from '@playwright/test';
/** Strict-mode browser journey: a fresh, non-demo installation exercised
 * through real rendered forms. The server keeps an in-memory database for the
 * duration of the run only; no external resource is created. */
export default defineConfig({testDir:'./e2e',testMatch:'auth-journey.spec.ts',fullyParallel:false,workers:1,retries:0,use:{baseURL:'http://127.0.0.1:8791',browserName:'chromium',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}},webServer:{command:'node --experimental-strip-types ../../scripts/dev.mjs --strict --port 8791',url:'http://127.0.0.1:8791/healthz',reuseExistingServer:false,timeout:30_000},reporter:'list'});
