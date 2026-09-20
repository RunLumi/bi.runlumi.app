import {test,expect} from '@playwright/test';
test('tenant dashboard has evidence, no false cash savings and no console errors',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.locator('h1')).toBeVisible();await expect(page.getByText('Giờ công được giải phóng không phải tiền mặt tiết kiệm.')).toBeVisible();await expect(page.locator('.kpi-value').first()).toBeVisible();expect(errors).toEqual([]);await page.screenshot({path:'../../artifacts/lumi-bi-react-desktop.png',fullPage:true});
});
test('identity switch clears tenant data and platform operator sees only metadata',async({page})=>{
 await page.goto('/');await expect(page.locator('.kpi-value').first()).toBeVisible();await page.getByLabel('Danh tính thử nghiệm').selectOption('platform-admin');await expect(page.getByRole('heading',{name:'Control Plane'})).toBeVisible();await expect(page.locator('.dashboard-grid')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Control Plane'})).toBeVisible();
 await page.getByLabel('Danh tính thử nghiệm').selectOption('beta-viewer');await expect(page.getByRole('link',{name:'Control Plane'})).toHaveCount(0);await page.getByRole('link',{name:'Tổng quan'}).click();await expect(page.locator('.kpi-value').first()).toBeVisible();await expect(page.getByText('Tùy chỉnh dashboard',{exact:true})).toHaveCount(0);
});
test('mobile layout and configuration show honest pending states',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);await page.screenshot({path:'../../artifacts/lumi-bi-react-mobile.png',fullPage:true});await page.getByRole('link',{name:'Cấu hình Git & AI'}).click();await expect(page.getByText('Tenant đang dùng pack mặc định. Chưa kích hoạt bản cấu hình từ Git.')).toBeVisible();
});
