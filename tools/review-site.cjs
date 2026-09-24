// Whole-site browser QA. Artifacts are local; no messages are sent.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright-core');
const { createServer } = require('./preview.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const pages = ['index.html','solucoes.html','gestao-de-escalas-medicas.html','para-instituicoes.html','para-profissionais.html','sobre.html','conteudos.html','contato.html','privacidade.html'];
const internalSceneByPage = {
  'gestao-de-escalas-medicas.html': 'management',
  'para-instituicoes.html': 'institutions',
  'para-profissionais.html': 'professional'
};
const output = path.resolve(__dirname, '../output/poc-review');
(async () => {
  await fs.mkdir(output, {recursive:true});
  const server = createServer();
  await new Promise(resolve => server.listen(4176,'127.0.0.1',resolve));
  const browser = await chromium.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader']});
  const base = 'http://127.0.0.1:4176/escalare-site/';
  const results = [];
  const errors = [];
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000}});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    for (const file of pages) {
      const response = await page.goto(base+file,{waitUntil:'networkidle'});
      assert.equal(response.status(),200,file);
      assert.equal(await page.locator('h1').count(),1,file);
      assert.equal(await page.locator('main').count(),1,file);
      assert.equal(await page.locator('link[rel=canonical]').count(),1,file);
      assert.equal(await page.locator('meta[name="referrer"][content="strict-origin-when-cross-origin"]').count(),1,file);
      assert.equal(await page.locator('.main-nav a[href="conteudos.html"]').count(),0,file);
      const unsafeBlankLinks=await page.locator('a[target="_blank"]').evaluateAll(links=>links.filter(link=>!link.relList.contains('noopener')||!link.relList.contains('noreferrer')).map(link=>link.outerHTML));
      assert.deepEqual(unsafeBlankLinks,[],file+' unsafe target=_blank');
      assert(await page.title(),file);
      const broken = await page.evaluate(async () => {
        const urls = [...new Set([...document.querySelectorAll('a[href],img[src],script[src],link[rel=stylesheet]')].map(el=>el.href || el.src).filter(url=>url && new URL(url).origin===location.origin))];
        const invalid=[];
        for (const url of urls) {
          const target = new URL(url);
          const response=await fetch(target.pathname);
          if(!response.ok) {invalid.push(url);continue;}
          if(target.hash && target.pathname.endsWith('.html')) {
            const doc=new DOMParser().parseFromString(await response.text(),'text/html');
            if(!doc.getElementById(decodeURIComponent(target.hash.slice(1)))) invalid.push(url);
          }
        }
        return invalid;
      });
      assert.deepEqual(broken,[],file+' broken links');
      const schema = await page.locator('script[type="application/ld+json"]').allTextContents();
      schema.forEach(text=>JSON.parse(text));
      if(file!=='index.html') assert.equal(await page.locator('script[src*="vendor"]').count(),0,file);
      if(internalSceneByPage[file]) {
        const type=internalSceneByPage[file];
        await page.waitForFunction(sceneType=>document.querySelector(`[data-internal-scene="${sceneType}"]`)?.dataset.renderMode==='full',type);
        assert.equal(await page.locator(`[data-internal-scene="${type}"] canvas`).count(),1,file);
      } else if(file!=='index.html') {
        assert.equal(await page.locator('canvas').count(),0,file);
      }
      for(const width of [360,375,390,412,430,768,1024,1440,1920]) {
        await page.setViewportSize({width,height:900});
        await page.waitForTimeout(file==='index.html'?220:150);
        const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
        assert(overflow.scroll <= overflow.width, file+' overflow '+JSON.stringify(overflow));
      }
      await page.setViewportSize({width:1440,height:1000});
      // Reveal every section before full-page review.
      await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){scrollTo({top:y,behavior:'instant'});await new Promise(r=>setTimeout(r,60));}scrollTo({top:0,behavior:'instant'});});
      await page.waitForTimeout(800);
      await page.screenshot({path:path.join(output,file.replace('.html','')+'-desktop.png'),fullPage:false});
      await page.setViewportSize({width:390,height:844});
      await page.waitForTimeout(600);
      await page.screenshot({path:path.join(output,file.replace('.html','')+'-mobile.png'),fullPage:false});
      results.push({page:file,links:'pass',responsive:'360–1920',headings:'pass',schema:'pass'});
    }
    await page.goto(base+'contato.html?perfil=profissional');
    assert.equal(await page.locator('#profile').inputValue(),'Profissional');
    await page.locator('#contact-name').fill('Teste de avaliação');
    await page.locator('#message').fill('Mensagem de teste local. Não enviar.');
    const external=[];
    page.on('request',request=>{if(/wa\.me/.test(request.url())) external.push(request.url());});
    await page.locator('button[type=submit]').click();
    assert(await page.locator('[data-form-result]').isVisible());
    assert.match(await page.locator('[data-form-result] a').getAttribute('href'),/^https:\/\/wa\.me\/5511978116482\?text=/);
    assert.deepEqual(external,[]);
    assert.match(await page.locator('[role=status]').textContent(),/Mensagem preparada/);
    await page.locator('#message').fill('Alteração local.');
    assert(await page.locator('[data-form-result]').isHidden());
    results.push({test:'form prepares message without submitting personal data',pass:true});
    await page.goto(base+'contato.html?perfil=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
    assert.equal(await page.locator('#profile').inputValue(),'Instituição');
    assert.equal(await page.locator('img[src="x"]').count(),0);
    await page.locator('#contact-name').evaluate(element=>{element.value='  Nome\u0000  <b>literal</b>  ';element.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('#message').fill('Linha 1\r\n<script>window.injected=true</script>');
    await page.locator('button[type=submit]').click();
    const safeHref=await page.locator('[data-form-result] a').getAttribute('href');
    const prepared=new URL(safeHref);
    assert.equal(prepared.origin,'https://wa.me');
    assert.equal(prepared.pathname,'/5511978116482');
    assert.match(prepared.searchParams.get('text'),/Nome <b>literal<\/b>/);
    assert.match(prepared.searchParams.get('text'),/<script>window\.injected=true<\/script>/);
    assert.equal(await page.evaluate(()=>window.injected),undefined);
    assert.equal(await page.locator('script').evaluateAll(scripts=>scripts.some(script=>script.textContent.includes('window.injected=true'))),false);
    results.push({test:'query allowlist and WhatsApp payload remain encoded text without DOM injection',pass:true});
    await page.setViewportSize({width:390,height:844});
    await page.locator('.mobile-toggle').click();
    assert.equal(await page.locator('.mobile-toggle').getAttribute('aria-expanded'),'true');
    assert(await page.locator('main').evaluate(el=>el.inert));
    await page.keyboard.press('Shift+Tab');
    assert(await page.locator('.mobile-toggle').evaluate(el=>el===document.activeElement));
    await page.keyboard.press('Tab');
    assert(await page.locator('.main-nav a').first().evaluate(el=>el===document.activeElement));
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.site-header').evaluate(el=>Math.round(el.getBoundingClientRect().top)),0);
    await page.screenshot({path:path.join(output,'mobile-menu.png')});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.mobile-toggle').getAttribute('aria-expanded'),'false');
    assert(!(await page.locator('main').evaluate(el=>el.inert)));
    results.push({test:'menu focus loop, background inert, Escape',pass:true});
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(base+'solucoes.html');
    await page.locator('.nav-link[href="sobre.html"]').click();
    await page.waitForURL('**/sobre.html');
    await page.goBack();
    assert(page.url().endsWith('solucoes.html'));
    await page.goForward();
    assert(page.url().endsWith('sobre.html'));
    const notFound=await page.goto(base+'missing/deep-page');
    assert.equal(notFound.status(),404);
    assert.equal(await page.locator('#home-link').getAttribute('href'),'/escalare-site/index.html');
    results.push({test:'native history and nested 404 recovery',pass:true});
    const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
    const plain=await noJS.newPage();
    await plain.goto(base+'solucoes.html');
    assert(await plain.locator('.nav-link').first().isVisible());
    assert(await plain.locator('h1').isVisible());
    results.push({test:'navigation and content without JavaScript',pass:true});
    // Produce social artwork from our authored SVG; this is browser rasterization, not stock imagery.
    await page.setViewportSize({width:1200,height:630});
    await page.goto(base+'assets/og-escalare.svg');
    await page.screenshot({path:path.join(output,'og-escalare.png')});
    assert.deepEqual(errors,[]);
    results.push({test:'application errors',errors});
  } finally {
    await fs.writeFile(path.join(output,'site-results.json'),JSON.stringify({results,errors},null,2));
    console.log(JSON.stringify({results,errors},null,2));
    await browser.close();
    server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
