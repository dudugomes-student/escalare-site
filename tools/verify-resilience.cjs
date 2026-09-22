const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright-core');
const { createServer } = require('./preview.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(4178,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader'],ignoreDefaultArgs:['--disable-back-forward-cache']});
 const base='http://127.0.0.1:4178/escalare-site/';
 const results=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  const diagnostics=()=>page.locator('[data-operation-story]').evaluate(el=>el.getOperationDiagnostics());
  await page.goto(base,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('[data-operation-story]').dataset.mode==='desktop-webgl');
  for(const [width,height,expected] of [[1024,900,'tablet'],[1440,900,'desktop'],[390,844,'mobile']]){
   await page.setViewportSize({width,height});
   await page.waitForFunction(q=>document.querySelector('[data-operation-story]').getOperationDiagnostics().quality===q,expected);
   assert.equal(await page.locator('.operation-render canvas').count(),1);
  }
  results.push({test:'desktop/tablet/mobile rebuilds with one canvas',pass:true});
  await page.setViewportSize({width:844,height:390});
  await page.waitForFunction(()=>document.querySelector('[data-operation-story]').dataset.mode==='static');
  assert.equal(await page.locator('.operation-render canvas').count(),0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.resolve(__dirname,'../output/poc-review/landscape.png')});
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.querySelector('[data-operation-story]').dataset.mode==='mobile-webgl');
  results.push({test:'portrait/landscape fallback and restoration',pass:true});
  // Controlled visibility events validate the handler; this does not emulate a physical OS tab.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  const before=(await diagnostics()).renders;
  await page.evaluate(()=>window.scrollTo({top:450,behavior:'instant'}));
  await page.waitForTimeout(700);
  assert.equal((await diagnostics()).renders,before);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(300);
  assert((await diagnostics()).renders>before);
  results.push({test:'simulated document.hidden pauses and resumes rendering',pass:true});
  await page.goto(base+'sobre.html');await page.goBack({waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('[data-operation-story]')?.dataset.mode?.endsWith('webgl'));
  assert.equal(await page.locator('.operation-render canvas').count(),1);
  results.push({test:'history restores Home and one WebGL surface',pass:true});
  for(const reason of ['saveData','lowMemory']){
   const context=await browser.newContext({viewport:{width:390,height:844}});
   await context.addInitScript(reason=>{
    if(reason==='saveData') Object.defineProperty(navigator,'connection',{value:{saveData:true,addEventListener(){}}});
    else Object.defineProperty(navigator,'deviceMemory',{value:2});
   },reason);
   const limited=await context.newPage();const requests=[];limited.on('request',r=>requests.push(r.url()));
   await limited.goto(base,{waitUntil:'networkidle'});
   await limited.waitForFunction(()=>document.querySelector('[data-operation-story]').dataset.mode==='static');
   assert(!requests.some(url=>url.includes('/vendor/')));
   assert(await limited.locator('.operation-fallback').isVisible());
   results.push({test:reason+' uses SVG without vendor downloads',pass:true});
   await context.close();
  }
  await page.goto(base+'gestao-de-escalas-medicas.html',{waitUntil:'networkidle'});
  const board=page.locator('[data-process-board]');
  for(const state of ['demand','people','organized']){
   await page.locator('[data-process='+state+']').click();
   assert.equal(await board.getAttribute('data-process-state'),state);
   assert.equal(await page.locator('[data-process='+state+']').getAttribute('aria-pressed'),'true');
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await page.waitForTimeout(600);
  await page.screenshot({path:path.resolve(__dirname,'../output/poc-review/escala-interactive-desktop.png')});
  results.push({test:'interactive process diagram states',pass:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('[data-process=demand]').click();
  const duration=await board.locator('.schedule-grid>span').first().evaluate(el=>getComputedStyle(el,'::before').transitionDuration);
  assert(parseFloat(duration)<.01);
  results.push({test:'diagram respects reduced motion',pass:true});
  assert.deepEqual(errors,[]);
 }finally{
  await fs.writeFile(path.resolve(__dirname,'../output/poc-review/resilience.json'),JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({results,errors},null,2));
  await browser.close();server.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
