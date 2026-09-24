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
  await page.waitForFunction(()=>document.querySelector('[data-operation-story]').dataset.mode==='full-webgl');
  for(const [width,height] of [[1024,900],[1440,900],[390,844],[390,520]]){
   await page.setViewportSize({width,height});
   await page.waitForFunction(()=>{const story=document.querySelector('[data-operation-story]');const diagnostics=story.getOperationDiagnostics();return story.dataset.mode==='full-webgl'&&diagnostics.quality==='full';});
   assert.equal((await diagnostics()).mode,'full-webgl');
   assert.equal(await page.locator('.operation-render canvas').count(),1);
  }
  results.push({test:'desktop/tablet/mobile/low-height keep full quality and one canvas',pass:true});
  const denseContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3});
  const densePage=await denseContext.newPage();
  await densePage.goto(base,{waitUntil:'networkidle'});
  await densePage.waitForFunction(()=>document.querySelector('[data-operation-story]').dataset.mode==='full-webgl');
  const denseDiagnostics=await densePage.locator('[data-operation-story]').evaluate(el=>el.getOperationDiagnostics());
  assert(denseDiagnostics.pixelRatio>2&&denseDiagnostics.pixelRatio<=2.25);
  assert(Math.abs(denseDiagnostics.drawingBuffer.width-denseDiagnostics.cssSize.width*denseDiagnostics.pixelRatio)<=2);
  assert(Math.abs(denseDiagnostics.drawingBuffer.height-denseDiagnostics.cssSize.height*denseDiagnostics.pixelRatio)<=2);
  assert(denseDiagnostics.drawingBuffer.width*denseDiagnostics.drawingBuffer.height<=denseDiagnostics.pixelBudget*1.02);
  results.push({test:'high-density canvas is sharp and bounded by a physical-pixel budget',diagnostics:denseDiagnostics});
  await denseContext.close();
  await page.setViewportSize({width:844,height:390});
  await page.waitForFunction(()=>document.querySelector('[data-operation-story]').dataset.mode==='full-webgl');
  assert.equal(await page.locator('.operation-render canvas').count(),1);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.resolve(__dirname,'../output/poc-review/landscape.png')});
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.querySelector('[data-operation-story]').dataset.mode==='full-webgl');
  results.push({test:'portrait/landscape keep WebGL with responsive composition',pass:true});
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
  for(const reason of ['saveData','reportedMemory']){
   const context=await browser.newContext({viewport:{width:390,height:844}});
   await context.addInitScript(reason=>{
    if(reason==='saveData') Object.defineProperty(navigator,'connection',{value:{saveData:true,addEventListener(){}}});
    else Object.defineProperty(navigator,'deviceMemory',{value:2});
   },reason);
   const limited=await context.newPage();const requests=[];limited.on('request',r=>requests.push(r.url()));
   await limited.goto(base,{waitUntil:'networkidle'});
   await limited.waitForFunction(()=>document.querySelector('[data-operation-story]').dataset.mode==='full-webgl');
   const data=await limited.locator('[data-operation-story]').evaluate(el=>el.getOperationDiagnostics());
   assert.equal(data.quality,'full');
   assert(requests.some(url=>url.includes('/vendor/')));
   assert.equal(await limited.locator('.operation-render canvas').count(),1);
   results.push({test:reason+' does not preemptively reduce WebGL',pass:true});
   await context.close();
  }
  await page.goto(base+'gestao-de-escalas-medicas.html',{waitUntil:'networkidle'});
  const board=page.locator('[data-composition-board]');
  await page.waitForFunction(()=>document.querySelector('[data-internal-scene="management"]')?.dataset.renderMode==='full');
  assert.equal(await page.locator('[data-internal-scene="management"] canvas').count(),1);
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
  await page.emulateMedia({reducedMotion:'no-preference'});

  await page.goto(base+'gestao-de-escalas-medicas.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('[data-internal-scene="management"]')?.dataset.renderMode==='full');
  const managementStages=[];
  for(const progress of [.02,.34,.62,.96]){
   const target=await page.locator('.composition-story').evaluate((story,value)=>{const top=scrollY+story.getBoundingClientRect().top;const travel=Math.max(story.offsetHeight-innerHeight*.18,innerHeight*1.15);return top-innerHeight*.7+value*travel;},progress);
   await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),target);
   await page.waitForTimeout(450);
   managementStages.push(await page.locator('[data-internal-scene="management"]').evaluate(el=>el.getSceneDiagnostics()));
  }
  assert.deepEqual(managementStages.map(item=>item.stage),[1,2,3,4]);
  assert(managementStages.every(item=>item.textPlanes>=4&&item.mode==='full'));
  assert.equal(await page.locator('.composition-board .schedule-grid').evaluate(el=>getComputedStyle(el).visibility),'hidden');
  await page.screenshot({path:path.resolve(__dirname,'../output/poc-review/internal-management-3d.png')});
  results.push({test:'management transforms persistent entities through four 3D stages',stages:managementStages.map(item=>item.stage)});
  await page.setViewportSize({width:390,height:844});
  const managementMobileTarget=await page.locator('.composition-story').evaluate(story=>{const top=scrollY+story.getBoundingClientRect().top;const travel=Math.max(story.offsetHeight-innerHeight*.18,innerHeight*1.15);return top-innerHeight*.7+.96*travel;});
  await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),managementMobileTarget);
  await page.waitForTimeout(500);
  assert.equal((await page.locator('[data-internal-scene="management"]').evaluate(el=>el.getSceneDiagnostics())).mode,'full');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.resolve(__dirname,'../output/poc-review/internal-management-mobile-3d.png')});
  results.push({test:'management mobile keeps the full 3D narrative',pass:true});

  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+'solucoes.html',{waitUntil:'networkidle'});
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  assert.equal(await page.locator('[data-system-map]').getAttribute('data-scene-state'),'parts');
  const solutionStates=[];
  for(const progress of [.02,.32,.57,.94]){
   const target=await page.locator('[data-system-map]').evaluate((scene,value)=>{const story=scene.closest('.hero-split')||scene;scene.classList.add('is-measuring');const header=document.querySelector('.site-header')?.offsetHeight||80;const sceneTop=scrollY+scene.getBoundingClientRect().top;const storyBottom=scrollY+story.getBoundingClientRect().bottom;const start=Math.max(0,sceneTop-header-24);const travel=Math.max(innerHeight*.72,storyBottom-scene.offsetHeight-start);scene.classList.remove('is-measuring');return start+value*travel;},progress);
   await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),target);
   await page.waitForTimeout(300);
   solutionStates.push(await page.locator('[data-system-map]').getAttribute('data-scene-state'));
  }
  assert.deepEqual(solutionStates,['parts','proximity','relations','system']);
  assert.equal(await page.locator('[data-system-map] canvas').count(),0);
  results.push({test:'solutions transforms demand, professionals and schedules into one system without decorative 3D',states:solutionStates});

  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+'para-instituicoes.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('[data-internal-scene="institutions"]')?.dataset.renderMode==='full');
  const institutionStates=[];
  for(const progress of [.02,.32,.57,.94]){
   const target=await page.locator('[data-coordination-field]').evaluate((scene,value)=>{const story=scene.closest('.page-hero');const header=document.querySelector('.site-header')?.offsetHeight||80;const stickyTop=header+(innerHeight<620?12:28);scene.classList.add('is-measuring');const sceneTop=scrollY+scene.getBoundingClientRect().top;const storyTop=scrollY+story.getBoundingClientRect().top;const start=sceneTop-stickyTop;const end=storyTop+story.offsetHeight-scene.offsetHeight-stickyTop;scene.classList.remove('is-measuring');return start+value*Math.max(end-start,innerHeight*2.2);},progress);
   await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),target);
   await page.waitForTimeout(450);
   institutionStates.push({state:await page.locator('[data-coordination-field]').getAttribute('data-coordination-state'),diagnostics:await page.locator('[data-internal-scene="institutions"]').evaluate(el=>el.getSceneDiagnostics())});
  }
  assert.deepEqual(institutionStates.map(item=>item.state),['fragmented','recognition','coordination','continuity']);
  assert.deepEqual(institutionStates.map(item=>item.diagnostics.stage),[1,2,3,4]);
  assert(institutionStates.every(item=>item.diagnostics.textPlanes>=6&&item.diagnostics.mode==='full'));
  assert.equal(await page.locator('.coordination-fragment').first().evaluate(el=>getComputedStyle(el).visibility),'hidden');
  await page.screenshot({path:path.resolve(__dirname,'../output/poc-review/internal-institutions-3d.png')});
  results.push({test:'institutions runs fragmented-recognition-coordination-continuity in WebGL',states:institutionStates.map(item=>item.state)});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await page.waitForTimeout(300);
  const institutionMobileTarget=await page.locator('[data-coordination-field]').evaluate(scene=>{const story=scene.closest('.page-hero');const header=document.querySelector('.site-header')?.offsetHeight||80;const stickyTop=header+(innerHeight<620?12:28);scene.classList.add('is-measuring');const sceneTop=scrollY+scene.getBoundingClientRect().top;const storyTop=scrollY+story.getBoundingClientRect().top;const start=sceneTop-stickyTop;const end=storyTop+story.offsetHeight-scene.offsetHeight-stickyTop;scene.classList.remove('is-measuring');return start+.94*Math.max(end-start,innerHeight*2.2);});
  await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),institutionMobileTarget);
  await page.waitForTimeout(500);
  const institutionMobileDiagnostics=await page.locator('[data-internal-scene="institutions"]').evaluate(el=>el.getSceneDiagnostics());
  const institutionMobileLayout=await page.locator('[data-coordination-field]').evaluate(scene=>{const rect=scene.getBoundingClientRect();const host=scene.querySelector('[data-internal-scene]')?.getBoundingClientRect();return {innerHeight,scene:{top:rect.top,bottom:rect.bottom,height:rect.height},host:host&&{top:host.top,bottom:host.bottom,height:host.height}};});
  assert.equal(institutionMobileDiagnostics.mode,'full');
  assert.equal(institutionMobileDiagnostics.stage,4);
  assert(institutionMobileDiagnostics.renders>0);
  assert(institutionMobileLayout.scene.bottom>0&&institutionMobileLayout.scene.top<institutionMobileLayout.innerHeight,JSON.stringify(institutionMobileLayout));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.resolve(__dirname,'../output/poc-review/internal-institutions-mobile-3d.png')});
  results.push({test:'institutions mobile keeps the four-stage 3D narrative',pass:true});

  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+'para-profissionais.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('[data-internal-scene="professional"]')?.dataset.renderMode==='full');
  const professionalStages=[];
  for(const progress of [.02,.34,.62,.96]){
   const target=await page.locator('[data-professional-story]').evaluate((story,value)=>{const top=scrollY+story.getBoundingClientRect().top;const travel=Math.max(story.offsetHeight-innerHeight*.18,innerHeight*.75);return top-innerHeight*.72+value*travel;},progress);
   await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),target);
   await page.waitForTimeout(450);
   professionalStages.push(await page.locator('[data-internal-scene="professional"]').evaluate(el=>el.getSceneDiagnostics()));
  }
  assert.deepEqual(professionalStages.map(item=>item.stage),[1,2,3,4]);
  assert(professionalStages.every(item=>item.textPlanes>=4&&item.mode==='full'));
  assert.equal(await page.locator('.route-label').first().evaluate(el=>getComputedStyle(el).visibility),'hidden');
  await page.screenshot({path:path.resolve(__dirname,'../output/poc-review/internal-professionals-3d.png')});
  results.push({test:'professional route keeps CatmullRom journey and four 3D stages',stages:professionalStages.map(item=>item.stage)});
  await page.setViewportSize({width:390,height:844});
  const professionalMobileTarget=await page.locator('[data-professional-story]').evaluate(story=>{const top=scrollY+story.getBoundingClientRect().top;const travel=Math.max(story.offsetHeight-innerHeight*.18,innerHeight*.75);return top-innerHeight*.72+.96*travel;});
  await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),professionalMobileTarget);
  await page.waitForTimeout(500);
  assert.equal((await page.locator('[data-internal-scene="professional"]').evaluate(el=>el.getSceneDiagnostics())).mode,'full');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.resolve(__dirname,'../output/poc-review/internal-professionals-mobile-3d.png')});
  results.push({test:'professional mobile keeps the full CatmullRom journey',pass:true});
  assert.deepEqual(errors,[]);
 }finally{
  await fs.writeFile(path.resolve(__dirname,'../output/poc-review/resilience.json'),JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({results,errors},null,2));
  await browser.close();server.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
