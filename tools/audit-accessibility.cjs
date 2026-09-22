const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright-core');
const { createServer } = require('./preview.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
(async()=>{
 const server=createServer();
 await new Promise(resolve=>server.listen(4177,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader']});
 const pages=['index.html','solucoes.html','gestao-de-escalas-medicas.html','para-instituicoes.html','para-profissionais.html','sobre.html','conteudos.html','contato.html','privacidade.html'];
 const results=[];
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  for(const file of pages) {
   await page.goto('http://127.0.0.1:4177/escalare-site/'+file,{waitUntil:'networkidle'});
   await page.addScriptTag({path:path.resolve(__dirname,'../output/poc-tools/node_modules/axe-core/axe.min.js')});
   const result=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {violations:r.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({html:n.html,summary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,count:v.nodes.length}))};});
   results.push({file,...result});
  }
  await page.goto('http://127.0.0.1:4177/escalare-site/contato.html');
  await page.setViewportSize({width:390,height:844});
  await page.locator('.mobile-toggle').click();
  await page.addScriptTag({path:path.resolve(__dirname,'../output/poc-tools/node_modules/axe-core/axe.min.js')});
  const menu=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)}));});
  results.push({file:'mobile-menu',violations:menu});
  console.log(JSON.stringify(results,null,2));
  await fs.writeFile(path.resolve(__dirname,'../output/poc-review/accessibility.json'),JSON.stringify(results,null,2));
  if(results.some(r=>r.violations.length)) process.exitCode=1;
 } finally { await browser.close(); server.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
