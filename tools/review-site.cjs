// Whole-site browser QA. Artifacts are local; no messages are sent.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright-core');
const { createServer } = require('./preview.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Exercise the smaller internal WebGL scenes before the multi-scene Home so
// headless GPU resource pressure does not create a false negative in this suite.
const pages = ['gestao-de-escalas-medicas.html','para-instituicoes.html','para-profissionais.html','solucoes.html','sobre.html','conteudos.html','contato.html','privacidade.html','index.html'];
const internalSceneByPage = {
  'gestao-de-escalas-medicas.html': 'management',
  'para-instituicoes.html': 'institutions',
  'para-profissionais.html': 'professional'
};
const siteRoot = path.resolve(__dirname, '..');
const output = path.resolve(__dirname, '../output/poc-review');
(async () => {
  await fs.mkdir(output, {recursive:true});
  const jekyllConfig = await fs.readFile(path.join(siteRoot, '_config.yml'),'utf8');
  for (const exclusion of ['"*.md"','"**/*.md"','tools','output','"*.log"']) {
    assert(jekyllConfig.includes(`- ${exclusion}`),`missing Jekyll exclusion: ${exclusion}`);
  }
  const sitemap = await fs.readFile(path.join(siteRoot, 'sitemap.xml'),'utf8');
  assert.doesNotMatch(sitemap,/conteudos\.html/,'empty editorial page must stay out of sitemap');
  for (const file of [...pages,'404.html']) {
    const html = await fs.readFile(path.join(siteRoot,file),'utf8');
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const raw = match[1];
      if (/^(?:https?:|mailto:|tel:|data:)/.test(raw)) continue;
      const [reference,hash=''] = raw.split('#',2);
      const relative = decodeURIComponent(reference.split('?')[0] || file);
      const target = path.resolve(siteRoot,relative);
      assert(target.startsWith(siteRoot+path.sep),`${file} unsafe local path: ${raw}`);
      await fs.access(target);
      if(hash && path.extname(target)==='.html') {
        const targetHtml = await fs.readFile(target,'utf8');
        assert(new RegExp(`\\bid=["']${escapeRegExp(decodeURIComponent(hash))}["']`).test(targetHtml),`${file} missing anchor: ${raw}`);
      }
    }
  }
  const server = createServer();
  await new Promise(resolve => server.listen(4176,'127.0.0.1',resolve));
  const browser = await chromium.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader']});
  const base = 'http://127.0.0.1:4176/escalare-site/';
  const results = [];
  const errors = [];
  try {
    const pageTitles = new Set();
    const canonicalUrls = new Set();
    for (const file of pages) {
      const pageContext = await browser.newContext({viewport:{width:1440,height:1000}});
      const page = await pageContext.newPage();
      let internalRenderMode = 'not-applicable';
      page.on('pageerror', error => errors.push(error.message));
      try {
      const response = await page.goto(base+file,{waitUntil:'networkidle'});
      assert.equal(response.status(),200,file);
      assert.equal(await page.locator('h1').count(),1,file);
      assert.equal(await page.locator('main').count(),1,file);
      assert.equal(await page.locator('html[lang="pt-BR"]').count(),1,file);
      assert.equal(await page.locator('meta[name="viewport"]').count(),1,file);
      assert.equal(await page.locator('meta[name="description"]').count(),1,file);
      assert.equal(await page.locator('link[rel=canonical]').count(),1,file);
      assert.equal(await page.locator('meta[property="og:title"]').count(),1,file);
      assert.equal(await page.locator('meta[property="og:description"]').count(),1,file);
      assert.equal(await page.locator('meta[property="og:url"]').count(),1,file);
      assert.equal(await page.locator('meta[property="og:image"]').count(),1,file);
      assert.equal(await page.locator('meta[name="referrer"][content="strict-origin-when-cross-origin"]').count(),1,file);
      const robotsMeta = page.locator('meta[name="robots"]');
      const robots = await robotsMeta.count() ? await robotsMeta.getAttribute('content') : null;
      if(file==='conteudos.html') assert.match(robots || '',/(?:^|,\s*)noindex(?:,|$)/,file);
      else assert(!robots?.includes('noindex'),`${file} must remain indexable`);
      assert.equal(await page.locator('.main-nav a[href="conteudos.html"]').count(),0,file);
      const unsafeBlankLinks=await page.locator('a[target="_blank"]').evaluateAll(links=>links.filter(link=>!link.relList.contains('noopener')||!link.relList.contains('noreferrer')).map(link=>link.outerHTML));
      assert.deepEqual(unsafeBlankLinks,[],file+' unsafe target=_blank');
      const title = await page.title();
      assert(title,file);
      assert(!pageTitles.has(title),`${file} duplicate title: ${title}`);
      pageTitles.add(title);
      const canonical = await page.locator('link[rel=canonical]').getAttribute('href');
      const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
      assert.match(canonical,/^https:\/\/escalaregestaoempresarial\.com\//,file);
      assert.equal(ogUrl,canonical,`${file} Open Graph URL must match canonical`);
      assert(!canonicalUrls.has(canonical),`${file} duplicate canonical: ${canonical}`);
      canonicalUrls.add(canonical);
      const schema = await page.locator('script[type="application/ld+json"]').allTextContents();
      schema.forEach(text=>JSON.parse(text));
      if(file!=='index.html') assert.equal(await page.locator('script[src*="vendor"]').count(),0,file);
      if(internalSceneByPage[file]) {
        const type=internalSceneByPage[file];
        await page.locator(`[data-internal-scene="${type}"]`).scrollIntoViewIfNeeded();
        try {
          await page.waitForFunction(sceneType=>{
            const mode=document.querySelector(`[data-internal-scene="${sceneType}"]`)?.dataset.renderMode || '';
            return /^(?:full|compatibility|semantic-fallback)/.test(mode) && !mode.endsWith('-loading');
          },type,{timeout:8000});
        } catch {
          const mode = await page.locator(`[data-internal-scene="${type}"]`).getAttribute('data-render-mode');
          throw new Error(`${file} internal scene did not reach a stable render mode (renderMode=${mode})`);
        }
        internalRenderMode = await page.locator(`[data-internal-scene="${type}"]`).getAttribute('data-render-mode');
        const canvasCount = await page.locator(`[data-internal-scene="${type}"] canvas`).count();
        if(/^(?:full|compatibility)$/.test(internalRenderMode)) assert.equal(canvasCount,1,file);
        else {
          assert.match(internalRenderMode,/^semantic-fallback/,file);
          assert.equal(canvasCount,0,`${file} fallback must remove the failed canvas`);
        }
      } else if(file!=='index.html') {
        assert.equal(await page.locator('canvas').count(),0,file);
      }
      const viewports = [
        {width:360,height:800},{width:375,height:812},{width:390,height:844},
        {width:412,height:915},{width:430,height:932},{width:768,height:1024},
        {width:1024,height:900},{width:1366,height:768},{width:1440,height:900},{width:1920,height:1080}
      ];
      for(const viewport of viewports) {
        await page.setViewportSize(viewport);
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
      results.push({page:file,links:'pass',responsive:'360×800–1920×1080',headings:'pass',schema:'pass',seo:'pass',internalRenderMode});
      } finally {
        await pageContext.close();
      }
    }
    assert.equal(pageTitles.size,pages.length,'every page needs a unique title');
    assert.equal(canonicalUrls.size,pages.length,'every page needs a unique canonical');
    results.push({test:'Jekyll exclusions and editorial noindex/sitemap policy',pass:true});
    const context = await browser.newContext({viewport:{width:1440,height:1000}});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
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
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
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
