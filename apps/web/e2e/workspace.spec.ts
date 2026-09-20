import {test,expect} from '@playwright/test';

test('commerce home shows decision products and honest connector/inference readiness',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.getByRole('heading',{name:'Tiền rõ. Hàng đúng. Việc không sót.'})).toBeVisible();
 for(const name of ['Tiền & lợi nhuận','Quyết định tồn kho','Ngoại lệ vận hành','Ask Lumi · chưa bật'])await expect(page.getByRole('heading',{name})).toBeVisible();
 await expect(page.getByText('Chưa kết nối dữ liệu thương mại thực tế.')).toBeVisible();
 await expect(page.locator('.kpi-value')).toHaveCount(0);expect(errors).toEqual([]);
 await page.screenshot({path:'../../artifacts/commerce-desktop.png',fullPage:true});
});

test('operations dashboard uses one batch, evidence and no false cash savings',async({page})=>{
 const batches:string[]=[];const errors:string[]=[];
 page.on('request',r=>{if(r.url().endsWith('/query-batch'))batches.push(r.postData()??'');});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/operations');await expect(page.locator('.kpi-value').first()).toHaveText('450');
 const cash=page.locator('[data-slot=card]').filter({has:page.getByRole('heading',{name:'Tiền mặt tiết kiệm được ghi nhận'})});
 await expect(cash.locator('.kpi-value')).toHaveText('0');
 await expect(page.getByText('Giờ công được giải phóng không phải tiền mặt tiết kiệm.')).toBeVisible();
 await expect(page.getByRole('status')).toContainText('Mốc nguồn chưa bao phủ');
 expect(batches.length).toBe(1);expect(JSON.parse(batches[0]!).queries).toHaveLength(6);
 await page.locator('summary').filter({hasText:'Nguồn và giới hạn'}).first().click();
 await expect(page.locator('.evidence-list').first()).toContainText('2026-09-18');expect(errors).toEqual([]);
 await page.screenshot({path:'../../artifacts/operations-desktop.png',fullPage:true});
});

test('identity switch drops tenant data; operator has metadata only; viewer cannot edit',async({page})=>{
 await page.goto('/operations');await expect(page.locator('.kpi-value').first()).toHaveText('450');
 await page.getByLabel('Danh tính thử nghiệm').selectOption('beta-viewer');await expect(page.locator('.kpi-value').first()).toHaveText('1.350');
 await expect(page.getByText('Tùy chỉnh dashboard',{exact:true})).toHaveCount(0);
 await page.getByLabel('Danh tính thử nghiệm').selectOption('platform-admin');await page.getByRole('link',{name:'Control Plane',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Control Plane',exact:true})).toBeVisible();await expect(page.locator('.dashboard-grid')).toHaveCount(0);
 const denied=await page.request.get('/api/tenants/alpha/metrics',{headers:{'x-demo-user':'platform-admin'}});expect(denied.status()).toBe(403);
});

for(const width of [320,390,768,1280])test(`all main views contain content at ${width}px without hiding overflow`,async({page})=>{
 await page.setViewportSize({width,height:844});
 for(const path of ['/','/operations','/configuration']){
  await page.goto(path);await expect(page.locator('h1')).toBeVisible();
  if(path==='/operations')await expect(page.locator('.kpi-value').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 }
 if(width===390){await page.goto('/operations');await expect(page.locator('.kpi-value').first()).toBeVisible();await page.screenshot({path:'../../artifacts/operations-mobile.png',fullPage:true});}
});

test('configuration is explicit about operator provenance and disabled inference',async({page})=>{
 await page.goto('/configuration');await expect(page.getByText('Tenant đang dùng pack mặc định. Chưa kích hoạt bản cấu hình từ Git.')).toBeVisible();
 await expect(page.getByText(/chưa tự xác minh PR\/GitHub attestation/)).toBeVisible();
});

test('empty selected period does not manufacture zero KPIs',async({page})=>{
 await page.goto('/operations');await expect(page.locator('.kpi-value').first()).toBeVisible();
 await page.getByLabel('Từ ngày').fill('2026-08-01');await page.getByLabel('Đến trước ngày').fill('2026-09-01');
 await expect(page.locator('.kpi-value')).toHaveCount(0);await expect(page.getByText('Chưa có dữ liệu',{exact:true}).first()).toBeVisible();
});

test('stale configuration context fails whole dashboard rather than presenting mixed cards',async({page})=>{
 await page.route('**/api/tenants/alpha/query-batch',route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:{code:'CONFIGURATION_CHANGED'}})}));
 await page.goto('/operations');await expect(page.getByRole('alert')).toContainText('Cấu hình vừa đổi');await expect(page.locator('.kpi-value')).toHaveCount(0);
});
