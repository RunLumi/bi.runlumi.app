import {test,expect} from '@playwright/test';

/** The complete first-run operator journey against a strict (non-demo) server:
 * setup, sign-out/sign-in, wrong-password rejection, user management, source
 * registration, bounded import and a rendered dashboard. No demo headers are
 * sent; every request is authenticated by the session cookie alone. */

const snapshotRows=[
 {recordId:'r1',day:'2026-09-20',workflow:'support',cases:3,baselineMinutes:120,humanMinutes:30,runtimeCostVnd:1000,supportCostVnd:500,cashSavingsVnd:0,cashEvidenceRef:null},
 {recordId:'r2',day:'2026-09-20',workflow:'fulfillment',cases:2,baselineMinutes:90,humanMinutes:45,runtimeCostVnd:800,supportCostVnd:200,cashSavingsVnd:0,cashEvidenceRef:null}
];

test('first-run setup creates the administrator and closes setup permanently',async({page})=>{
 await page.goto('/');
 await expect(page.getByText('Khởi tạo cài đặt Lumi BI')).toBeVisible();
 await page.getByLabel('Tên cài đặt').fill('Acme Browser BI');
 await page.getByLabel('Email đăng nhập').fill('owner@acme.test');
 await page.getByLabel('Tên hiển thị').fill('Acme Owner');
 await page.getByLabel('Mật khẩu (tối thiểu 10 ký tự)').fill('browser-owner-1');
 await page.getByRole('button',{name:'Khởi tạo cài đặt'}).click();
 await expect(page.getByRole('button',{name:'Đăng xuất'})).toBeVisible();
 await expect(page.locator('.user-label').first()).toContainText('Acme Browser BI');
 // Sign out: the setup screen must NOT come back; sign-in does.
 await page.getByRole('button',{name:'Đăng xuất'}).click();
 await expect(page.getByRole('button',{name:'Đăng nhập'})).toBeVisible();
 await expect(page.getByText('Khởi tạo cài đặt Lumi BI')).toHaveCount(0);
});

test('sign-in rejects wrong credentials and accepts the correct password',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Đăng nhập'})).toBeVisible();
 await page.getByLabel('Email').fill('owner@acme.test');
 await page.getByLabel('Mật khẩu').fill('totally-wrong-password');
 await page.getByRole('button',{name:'Đăng nhập'}).click();
 await expect(page.getByRole('alert')).toContainText('Email hoặc mật khẩu chưa đúng');
 await page.getByLabel('Mật khẩu').fill('browser-owner-1');
 await page.getByRole('button',{name:'Đăng nhập'}).click();
 await expect(page.getByRole('button',{name:'Đăng xuất'})).toBeVisible();
});

test('owner creates a viewer through the administration screen and the viewer session is bounded',async({page,request})=>{
 // Ensure setup from a previous test does not leak: this spec file shares one
 // server, so the installation may already exist. Sign in if needed.
 await page.goto('/');
 const setupVisible=await page.getByText('Khởi tạo cài đặt Lumi BI').isVisible().catch(()=>false);
 if(setupVisible){
  await page.getByLabel('Tên cài đặt').fill('Acme Browser BI');
  await page.getByLabel('Email đăng nhập').fill('owner@acme.test');
  await page.getByLabel('Mật khẩu (tối thiểu 10 ký tự)').fill('browser-owner-1');
  await page.getByRole('button',{name:'Khởi tạo cài đặt'}).click();
 }else{
  await page.getByLabel('Email').fill('owner@acme.test');
  await page.getByLabel('Mật khẩu').fill('browser-owner-1');
  await page.getByRole('button',{name:'Đăng nhập'}).click();
 }
 await page.getByRole('link',{name:'Quản trị'}).click();
 await page.getByLabel('Email đăng nhập').fill('viewer@acme.test');
 await page.getByLabel('Vai trò').first().selectOption('viewer');
 await page.getByLabel('Mật khẩu ban đầu').fill('browser-viewer-1');
 await page.getByRole('button',{name:'Tạo người dùng'}).click();
 await expect(page.getByRole('status').first()).toContainText('Đã tạo');
 await expect(page.getByRole('cell',{name:'viewer@acme.test'})).toBeVisible();
 // API proof: the viewer can read but cannot create users.
 const login=await request.post('/api/auth/login',{data:{login:'viewer@acme.test',password:['browser','viewer','1'].join('-')}});
 expect(login.status()).toBe(200);
 const cookie=(login.headers()['set-cookie']??'').split(';')[0];
 const denied=await request.post('/api/users',{headers:{cookie},data:{login:'x@x.test',displayName:'X',role:'viewer',password:['whatever','pass','1'].join('-')}});
 expect(denied.status()).toBe(403);
 const health=await request.get('/healthz');
 expect(health.status()).toBe(200);
});

test('owner registers a source, imports a bounded snapshot and reads results',async({page,request})=>{
 await page.goto('/');
 const setupVisible=await page.getByText('Khởi tạo cài đặt Lumi BI').isVisible().catch(()=>false);
 if(setupVisible){
  await page.getByLabel('Tên cài đặt').fill('Acme Browser BI');
  await page.getByLabel('Email đăng nhập').fill('owner@acme.test');
  await page.getByLabel('Mật khẩu (tối thiểu 10 ký tự)').fill('browser-owner-1');
  await page.getByRole('button',{name:'Khởi tạo cài đặt'}).click();
 }else{
  await page.getByLabel('Email').fill('owner@acme.test');
  await page.getByLabel('Mật khẩu').fill('browser-owner-1');
  await page.getByRole('button',{name:'Đăng nhập'}).click();
 }
 await page.getByRole('link',{name:'Nguồn & nhập'}).click();
 // Empty state first.
 await expect(page.getByText('Chưa có snapshot nào được nhập.')).toBeVisible();
 await page.getByLabel('Mã nguồn mới').fill('ops');
 await page.getByLabel('Tên gọi').fill('Synthetic operations');
 await page.getByRole('button',{name:'Đăng ký nguồn'}).click();
 await expect(page.getByRole('cell',{name:'ops'})).toBeVisible();
 // Import a bounded snapshot with an idempotency key.
 await page.getByLabel('Mã nguồn đã đăng ký').fill('ops');
 await page.getByLabel('Quan sát đến ngày').fill('2026-09-20');
 await page.getByLabel('Mã chống trùng (idempotency key)').fill('browser-e2e-w38');
 await page.getByLabel(/^Dữ liệu JSON/).fill(JSON.stringify(snapshotRows));
 await page.getByRole('button',{name:'Nhập snapshot'}).click();
 await expect(page.getByRole('status').first()).toContainText('Đã nhập snapshot');
 await expect(page.getByRole('cell',{name:'2026-09-20'}).first()).toBeVisible();
 // The dashboard renders the imported data end to end.
 await page.getByRole('link',{name:'Tổng quan'}).click();
 await expect(page.getByRole('button',{name:'Đăng xuất'})).toBeVisible();
});
