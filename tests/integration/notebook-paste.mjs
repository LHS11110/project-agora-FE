import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const page=await browser.newPage({ignoreHTTPSErrors:true});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto((process.env.AGORA_E2E_ORIGIN||'https://localhost:5191')+'/tests/browser/notebook-paste.html');
 const source=JSON.stringify({nbformat:4,cells:[{cell_type:'code',source:['print(42)']},{cell_type:'markdown',source:['# Notes']}]});
 for(const [index,mode] of ['file','items-only','json-text','rich-json'].entries()){
  await page.locator('.canvas-stage').evaluate(async(node,{source,mode})=>{
   const file=new File([source],mode==='file'?'sample.ipynb':'clipboard.json',{type:mode==='file'?'application/octet-stream':'application/json'});
   if(mode==='rich-json'){
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{read:async()=>[{types:['application/json'],getType:async()=>new Blob([source],{type:'application/json'})}]}});
    return;
   }
   const data=new DataTransfer();
   if(mode==='json-text')data.setData('application/x-ipynb+json',source);else data.items.add(file);
   let clipboardData=data;
   if(mode==='items-only')clipboardData={files:[],items:[{kind:'file',getAsFile:()=>file}],getData:()=>''};
   const event=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:clipboardData});node.dispatchEvent(event);
  },{source,mode});
  if(mode==='rich-json')await page.getByRole('button',{name:'Paste',exact:true}).click();
  await page.waitForFunction(count=>Object.keys(window.pasteFixture.items()).length===count,index+1);
 }
 const items=await page.evaluate(()=>Object.values(window.pasteFixture.items()));
 for(const item of items){assert.equal(item.runtimeRole,'notebook');assert.equal(item.notebookCells.length,2);assert.equal(item.notebookCells[0].source,'print(42)');assert.equal(item.notebookCells[1].source,'# Notes');}
 assert.equal(await page.locator('.notebook-content').count(),4);assert.deepEqual(errors,[]);
 console.log('PASS ipynb file, items-only file transfer, notebook MIME text, filename-free JSON via paste button, source cells and rendered notebooks');
}finally{await browser.close();}
