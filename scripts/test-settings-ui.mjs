import {chromium,expect} from '@playwright/test';
import {randomBytes} from 'node:crypto';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
try{
 const page=await browser.newPage({colorScheme:'dark'}),errors=[];
 page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3000/settings');const row=page.locator('#integration-deepseek');
 await row.waitFor({timeout:60000});await row.getByRole('button',{name:'Ganti kunci'}).click();
 const key=`naskah-test-${randomBytes(24).toString('hex')}`;
 await row.locator('input[type=password]').fill(key);await row.getByRole('button',{name:'Simpan dan sambungkan'}).click();
 await expect(row.getByRole('button',{name:'Ganti kunci'})).toBeVisible({timeout:60000});
 await expect(row.locator('.integration-state.ready')).toHaveCount(3);
 if((await page.content()).includes(key))throw Error('key retained in DOM');
 const storage=await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage]));if(storage.includes(key))throw Error('key in browser storage');
 await page.screenshot({path:'artifacts/settings-live-dark.png',fullPage:true});
 await page.goto('http://127.0.0.1:3000/new-project');await expect(page.locator('button[type=submit]')).toBeDisabled();
 await expect(page.locator('a[href="/settings#knowledge-base"]')).toBeVisible();
 if(errors.length)throw Error(errors.join('\n'));
 console.log('Live Settings save, status indicators, cleared key, browser storage, and generation readiness passed.');
}finally{await browser.close();}
