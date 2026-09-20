import {test,expect,type Page,type APIRequestContext} from '@playwright/test';
import {readFileSync} from 'node:fs';import {resolve} from 'node:path';
import {commerceSchemaFingerprint} from '../../../packages/core/commerce-model.ts';
const raw=JSON.parse(readFileSync(resolve(process.cwd(),'../../examples/commerce/orders-negative.json'),'utf8'));
const headers={'x-demo-user':'beta-owner'};
async function asOwner(page:Page){await page.goto('/');await page.getByLabel('Danh tính thử nghiệm').selectOption('beta-owner');await expect(page.locator('.topbar')).toContainText('beta / owner');}
async function seed(api:APIRequestContext,suffix:string){
 const root='/api/tenants/beta',connectionId='visual-'+suffix;
 const create=await api.post(root+'/commerce-connections',{headers,data:{id:connectionId,provider:'generic',sourceAccountId:'shop-A',resourceType:'orders',approvalRef:'synthetic-ui-test'}});expect([201,409]).toContain(create.status());
 const receipt=await api.post(root+'/commerce-receipts',{headers,data:{connectionId,eventType:'snapshot',sourceAccountId:'shop-A',resourceType:'orders',deliveryId:'test-'+suffix,sourceObjectId:'synthetic',sourceRevision:null,sourceEventAt:null,sourceUpdatedAt:null,window:raw.window,schemaFingerprint:await commerceSchemaFingerprint(),rawJson:JSON.stringify(raw)}});expect([200,202]).toContain(receipt.status());
 const n=await api.post(root+'/commerce-normalizations',{headers,data:{receiptId:(await receipt.json()).receiptId}});expect(n.ok()).toBe(true);const head=await(await api.get(root+'/commerce-publications/status',{headers})).json();
 const candidate={normalizationIds:[(await n.json()).normalizationId],mappingId:null,controls:[],expectedRevision:head.revision,expectedPublicationId:head.activePublicationId};
 const p=await api.post(root+'/commerce-publications/preview',{headers,data:candidate});expect(p.ok()).toBe(true);const pub=await api.post(root+'/commerce-publications',{headers,data:{...candidate,previewHash:(await p.json()).previewHash,reason:'Synthetic browser fixture, not merchant evidence'}});expect(pub.status()).toBe(201);return pub.json();
}

test('owner completes source authorization, file import, normalization, reviewed publication, export and investigation in the UI',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:390,height:844});await asOwner(page);
 await page.getByRole('link',{name:'Nguồn & bản nhập',exact:true}).click();await expect(page.getByRole('heading',{level:1})).toContainText('Nhập có kiểm tra');
 await page.getByLabel('Mã kết nối',{exact:true}).fill('e2e-ui-orders');await page.getByLabel('Mã tài khoản nguồn',{exact:true}).fill('shop-A');await page.getByLabel('Tham chiếu bằng chứng cho phép').fill('synthetic-owner-approval');await page.getByRole('button',{name:'Cho phép bản xuất',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Đã ghi nhận quyền dùng bản xuất');
 await page.getByLabel('Tệp JSON theo hợp đồng Lumi').setInputFiles({name:'synthetic-orders.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});await page.getByRole('button',{name:'Lưu bằng chứng gốc',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Cần chuẩn hóa');await page.getByRole('button',{name:'Chuẩn hóa',exact:true}).click();await expect(page.getByRole('status')).toContainText('Đã chuẩn hóa');
 await page.getByRole('checkbox').first().check();await page.getByRole('button',{name:'Tạo bản xem trước (1 nguồn)',exact:true}).click();await expect(page.locator('[data-metric=contribution_pre_ads]')).toHaveText('−160.000');
 await expect(page.getByText('Bản xem trước, chưa công bố.',{exact:false})).toBeVisible();await page.getByLabel('Lý do duyệt và phạm vi đã kiểm tra').fill('Đã kiểm tra dữ liệu tổng hợp dùng thử');await page.getByRole('button',{name:'Công bố bản đã duyệt',exact:true}).click();await expect(page.getByRole('status')).toContainText('Đã công bố bản đã duyệt');
 await page.getByRole('link',{name:'Số liệu thương mại',exact:true}).click();await expect(page.locator('[data-metric=net_merchandise_sales]')).toHaveText('720.000');await expect(page.locator('[data-metric=contribution_pre_ads]')).toHaveText('−160.000');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await page.locator('.commerce-metrics [data-slot=card-content]').first().evaluate(el=>parseFloat(getComputedStyle(el).paddingTop))).toBeGreaterThanOrEqual(20);await page.screenshot({path:'../../artifacts/commerce-money-390.png',fullPage:true});
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất số CSV',exact:true}).click();const download=await pending;expect(download.suggestedFilename()).toMatch(/^lumi-cp_[a-f0-9]+\.csv$/);
 await page.getByRole('button',{name:'Việc & kết quả',exact:true}).click();await page.getByRole('button',{name:'Ghi nhận việc',exact:true}).click();await page.getByLabel('Lý do và việc sẽ kiểm tra').fill('Đối chiếu giá vốn và phí nguồn');await page.getByRole('button',{name:'Lưu việc cần kiểm tra',exact:true}).click();await expect(page.getByText('Đối chiếu giá vốn và phí nguồn',{exact:true})).toBeVisible();
 await page.screenshot({path:'../../artifacts/commerce-decisions-390.png',fullPage:true});
 await page.getByLabel('Danh tính thử nghiệm').selectOption('beta-viewer');await expect(page.locator('[data-metric]')).toHaveCount(0);await expect(page.getByRole('link',{name:'Nguồn & bản nhập',exact:true})).toHaveCount(0);expect(errors).toEqual([]);
});
for(const width of [320,390,768,1280])test(`commerce money, stock, decision and source views remain usable at ${width}px`,async({page,request})=>{
 await seed(request,String(width));await page.setViewportSize({width,height:900});await asOwner(page);await page.getByRole('link',{name:'Số liệu thương mại',exact:true}).click();await expect(page.locator('[data-metric=net_merchandise_sales]')).toBeVisible();
 for(const section of ['Tiền & lợi nhuận','Kho vật lý','Việc & kết quả']){await page.getByRole('button',{name:section,exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
 await page.getByRole('link',{name:'Nguồn & bản nhập',exact:true}).click();await expect(page.getByRole('heading',{level:1})).toBeVisible();await expect(page.getByLabel('Mã tài khoản nguồn',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 if(width===1280){await page.screenshot({path:'../../artifacts/commerce-ingestion-1280.png',fullPage:true});await page.getByRole('link',{name:'Số liệu thương mại',exact:true}).click();await expect(page.locator('[data-metric=net_merchandise_sales]')).toBeVisible();await page.screenshot({path:'../../artifacts/commerce-money-1280.png',fullPage:true});}
});
test('stale publication and revoked source failures clear the report rather than showing cached financial numbers',async({page,request})=>{
 await seed(request,'revocation');await asOwner(page);await page.getByRole('link',{name:'Số liệu thương mại',exact:true}).click();await expect(page.locator('[data-metric=net_merchandise_sales]')).toBeVisible();
 await page.route('**/api/tenants/beta/commerce-publications',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'PUBLICATION_SOURCE_REVOKED'}})}));await page.getByRole('link',{name:'Chi phí thao tác',exact:true}).click();await page.getByRole('link',{name:'Số liệu thương mại',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Không mở lại số đã lưu');await expect(page.locator('[data-metric]')).toHaveCount(0);
});
