import {test,expect} from '@playwright/test';

test('loaded narrow-screen cards fit and overflowing table columns remain reachable',async({page})=>{
 await page.setViewportSize({width:320,height:844});
 await page.goto('/operations');
 await expect(page.locator('.kpi-value').first()).toHaveText('450');
 await page.evaluate(()=>document.fonts.ready);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 for(const card of await page.locator('[data-slot=card]').all()){
  const bounds=await card.boundingBox();expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(321);
 }
 const table=page.locator('.table-scroll').first();await expect(table).toBeVisible();
 const geometry=await table.evaluate(element=>{
  element.scrollLeft=element.scrollWidth;
  return {client:element.clientWidth,scroll:element.scrollWidth,offset:element.scrollLeft,overflow:getComputedStyle(element).overflowX};
 });
 expect(geometry.overflow).toMatch(/auto|scroll/);
 if(geometry.scroll>geometry.client)expect(geometry.offset).toBeGreaterThan(0);
 await expect(table.locator('td').last()).not.toBeEmpty();
});
