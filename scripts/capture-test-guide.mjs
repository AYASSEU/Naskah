import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='artifacts/test-guide/screenshots';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge'}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const evidence=[];const shot=async(name)=>{await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${out}/${name}.png`});evidence.push(name);};
try{
 if(process.argv.includes('--live')){
  await page.goto('http://127.0.0.1:3000/settings');await expect(page.locator('#integration-deepseek')).toBeVisible({timeout:60000});
  await page.locator('#integration-deepseek').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/13-settings-live.png`});
  await page.locator('#knowledge-base').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/14-knowledge.png`});
  await page.goto('http://127.0.0.1:3000/new-project');await expect(page.locator('button[type=submit]')).toBeDisabled();await page.screenshot({path:`${out}/15-live-blocked.png`});
  console.log('Captured live Settings, corpus and readiness state.');
 }else{
 await page.goto('http://127.0.0.1:3000');await expect(page.locator('.project-table tbody tr')).toHaveCount(3);await shot('01-ledger');
 await page.goto('http://127.0.0.1:3000/new-project');await page.getByLabel('Nama dokumen',{exact:true}).fill('Uji panduan klinik mahasiswa');await page.getByLabel('Deskripsi sistem',{exact:true}).fill('Petugas klinik mendaftarkan pasien mahasiswa dan mengatur jadwal dokter. Hak akses berdasarkan peran. Waktu respons maksimal 2 detik.');await shot('02-intake');
 await page.getByRole('button',{name:'Mulai buat dokumen SRS',exact:true}).click();await expect(page).toHaveURL(/workspace/);await shot('03-generation');await expect(page.getByRole('button',{name:'Setujui dan finalisasi',exact:true})).toBeEnabled({timeout:60000});await shot('04-workspace');
 const first=page.locator('#section-1\\.1');await first.getByRole('button',{name:'Edit',exact:true}).click();const editor=first.getByRole('textbox',{name:'Markdown',exact:true});await editor.fill((await editor.inputValue())+'\n\nCatatan uji manual tersimpan.');await shot('05-edit');await first.getByRole('button',{name:'Selesai mengedit',exact:true}).click();await expect(first).toContainText('Catatan uji manual tersimpan.');
 const security=page.locator('#section-3\\.4');await security.getByRole('button',{name:'Revisi AI',exact:true}).click();await page.getByRole('button',{name:'Wajibkan 2-Factor Authentication dan enkripsi AES-256',exact:true}).click();await page.getByRole('button',{name:'Kirim revisi',exact:true}).click();await expect(page.getByRole('heading',{name:'Tinjau usulan revisi'})).toBeVisible();await shot('06-revision');await page.getByRole('button',{name:'Terapkan perubahan',exact:true}).click();
 await page.getByRole('button',{name:'Setujui dan finalisasi',exact:true}).click();await page.getByLabel('Saya telah meninjau dokumen ini').check();await shot('07-finalize');await page.getByRole('button',{name:'Finalisasi dokumen',exact:true}).click();await expect(page).toHaveURL(/export/);await shot('08-export');
 const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh dokumen Word',exact:true}).click();await (await dl).saveAs('artifacts/test-guide/sample-export.docx');
 await page.goto('http://127.0.0.1:3000/evaluation?tab=sus');for(let i=0;i<10;i++)await page.getByRole('radio',{name:`SUS ${i+1}: ${i%2===0?5:1}`,exact:true}).check();await page.getByRole('button',{name:'Kirim jawaban SUS',exact:true}).click();await expect(page.locator('.result-panel')).toContainText('100.0');await shot('09-sus');
 await page.getByRole('tab',{name:'Penilaian pakar',exact:true}).click();await shot('10-expert');
 await page.goto('http://127.0.0.1:3000/settings');await expect(page.getByRole('region',{name:'Koneksi AI'})).toBeVisible();await shot('11-settings-mock');
 await page.setViewportSize({width:390,height:900});await page.goto('http://127.0.0.1:3000/evaluation?tab=sus');await expect(page.getByRole('radio')).toHaveCount(5);await shot('12-mobile');
 await writeFile('artifacts/test-guide/capture-evidence.json',JSON.stringify({mode:'mock',captured_at:new Date().toISOString(),screenshots:evidence},null,2));console.log('Captured '+evidence.length+' screenshots and verified the illustrated mock workflow.');
 }
}finally{await browser.close();}
