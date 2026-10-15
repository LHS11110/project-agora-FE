import fs from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright-core');
const base=fileURLToPath(new URL('../docs/architecture/report',import.meta.url));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
const page=await browser.newPage({viewport:{width:1600,height:1135},deviceScaleFactor:1});
let html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>Project Agora - 시스템 아키텍처</title><style>@page{size:A4 landscape;margin:8mm}body{margin:0;background:white}.sheet{width:281mm;height:193mm;break-after:page;display:flex;align-items:center;justify-content:center}.sheet:last-child{break-after:auto}.sheet svg{max-width:100%;max-height:100%;width:auto;height:auto}</style></head><body>';
for(const name of ['01-system-architecture','02-replication-protocol']){
 const svg=fs.readFileSync(base+'/'+name+'.svg','utf8');html+='<div class="sheet">'+svg+'</div>';
 await page.setContent(svg);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'/tmp/agora-'+name+'.png',fullPage:true});
}
html+='</body></html>';await page.setContent(html);await page.evaluate(()=>document.fonts.ready);await page.pdf({path:base+'/project-agora-architecture.pdf',preferCSSPageSize:true,printBackground:true});
console.log('Exported two-page vector PDF');
}finally{await browser.close();}
