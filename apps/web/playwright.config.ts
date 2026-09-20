import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',fullyParallel:false,workers:1,retries:0,use:{baseURL:'http://127.0.0.1:8787',browserName:'chromium'},webServer:{command:'node --experimental-strip-types ../../scripts/dev.mjs',url:'http://127.0.0.1:8787/healthz',reuseExistingServer:false},reporter:'list'});
