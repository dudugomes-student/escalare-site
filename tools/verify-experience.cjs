// Run with Node and PLAYWRIGHT_PATH pointing at an installed playwright-core package.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright-core');
const { createServer } = require('./preview.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = path.resolve(__dirname, '../output/poc-review');
const executablePath = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
(async () => {
  await fs.mkdir(out, { recursive: true });
  const server = createServer();
  await new Promise(resolve => server.listen(4174, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader', '--no-first-run'] });
  const base = 'http://127.0.0.1:4174/escalare-site/';
  const results = [];
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  // Keep external network failures distinct from application errors.
  const networkFailures = [];
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', request => networkFailures.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const diagnostics = () => page.locator('[data-operation-story]').evaluate(el => el.getOperationDiagnostics());
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('[data-operation-story]').dataset.mode?.endsWith('webgl'), null, { timeout: 20000 });
    await page.screenshot({ path: path.join(out, 'desktop-01.png') });
    results.push({ test: 'desktop-loaded', ...await diagnostics() });
    const dimensions = await page.locator('[data-operation-story]').evaluate(el => ({ top: el.offsetTop - 96, travel: el.offsetHeight - el.querySelector('.operation-stage').offsetHeight }));
    for (const [index, progress] of [0, .25, .46, .68, 1].entries()) {
      await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), dimensions.top + progress * dimensions.travel);
      await page.waitForTimeout(950);
      await page.screenshot({ path: path.join(out, `desktop-state-${index + 1}.png`) });
      const data = await diagnostics();
      assert.equal(data.stage, index + 1);
      results.push({ test: `forward-${index + 1}`, ...data });
    }
    for (const [index, progress] of [[3, .68], [2, .46], [1, .25], [0, 0]]) {
      await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), dimensions.top + progress * dimensions.travel);
      await page.waitForTimeout(950);
      assert.equal((await diagnostics()).stage, index + 1);
    }
    results.push({ test: 'reverse-five-states', pass: true });
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(1100);
    const renders = (await diagnostics()).renders;
    await page.waitForTimeout(700);
    assert.equal((await diagnostics()).renders, renders);
    results.push({ test: 'offscreen-render-paused', pass: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(1200);
    assert.equal((await diagnostics()).mode, 'full-webgl');
    assert.equal((await diagnostics()).quality, 'full');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(out, 'mobile-01.png'), fullPage: false });
    await page.evaluate(() => window.scrollTo({ top: 380, behavior: 'instant' }));
    await page.waitForTimeout(750);
    await page.screenshot({ path: path.join(out, 'mobile-operation.png') });
    results.push({ test: 'mobile-and-resize', ...await diagnostics() });
    const mobileEnd = await page.evaluate(() => window.ScrollTrigger.getAll()[0].end);
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), mobileEnd);
    await page.waitForTimeout(500);
    assert.equal((await diagnostics()).stage, 5);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(500);
    assert.equal((await diagnostics()).stage, 1);
    results.push({ test: 'mobile-forward-and-reverse', pass: true });
    for (const width of [320, 360, 768, 900, 901, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(450);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`);
    }
    results.push({ test: 'responsive-widths-320-through-1440', pass: true });
    await page.setViewportSize({ width: 1200, height: 520 });
    await page.waitForTimeout(600);
    assert.equal((await diagnostics()).mode, 'full-webgl');
    assert.equal(await page.locator('.operation-render canvas').count(), 1);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    results.push({ test: 'low-height-keeps-webgl', ...await diagnostics() });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(450);
    assert.equal((await diagnostics()).mode, 'reduced-motion');
    assert.equal(await page.locator('.operation-render canvas').count(), 0);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: path.join(out, 'mobile-reduced.png') });
    results.push({ test: 'live-reduced-motion', pass: true });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(1000);
    assert.equal((await diagnostics()).mode, 'full-webgl');
    await page.locator('.operation-render canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.waitForFunction(() => document.querySelector('[data-operation-story]').dataset.mode === 'compatibility-webgl');
    assert.equal((await diagnostics()).quality, 'compatibility');
    results.push({ test: 'context-loss-retries-compatibility', pass: true });
    await page.screenshot({ path: path.join(out, 'desktop-fallback.png') });
    const staticContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await staticContext.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...rest) { return type === 'webgl2' ? null : get.call(this, type, ...rest); }; });
    const fallback = await staticContext.newPage();
    const requests = [];
    fallback.on('request', req => requests.push(req.url()));
    await fallback.goto(base, { waitUntil: 'networkidle' });
    assert.equal(await fallback.locator('[data-operation-story]').getAttribute('data-mode'), 'semantic-fallback');
    assert(requests.some(url => /vendor\/(gsap|ScrollTrigger)/.test(url)));
    assert(await fallback.locator('.operation-cta').isVisible());
    results.push({ test: 'no-webgl-keeps-dom-gsap-narrative', pass: true });
    const compatibilityContext = await browser.newContext({ viewport: { width: 1200, height: 520 } });
    await compatibilityContext.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, options, ...rest) {
        if (type === 'webgl2' && options?.failIfMajorPerformanceCaveat) return null;
        return get.call(this, type, options, ...rest);
      };
    });
    const compatibilityPage = await compatibilityContext.newPage();
    await compatibilityPage.goto(base, { waitUntil: 'networkidle' });
    await compatibilityPage.waitForFunction(() => document.querySelector('[data-operation-story]').dataset.mode === 'compatibility-webgl');
    const compatibilityDiagnostics = await compatibilityPage.locator('[data-operation-story]').evaluate(el => el.getOperationDiagnostics());
    assert.equal(compatibilityDiagnostics.quality, 'compatibility');
    assert.equal(await compatibilityPage.locator('.operation-render canvas').count(), 1);
    results.push({ test: 'major-performance-caveat-retries-compatible-webgl2', ...compatibilityDiagnostics });
    await compatibilityContext.close();
    await fallback.locator('.mobile-toggle').click();
    assert.equal(await fallback.locator('.mobile-toggle').getAttribute('aria-expanded'), 'true');
    await fallback.keyboard.press('Escape');
    assert.equal(await fallback.locator('.mobile-toggle').getAttribute('aria-expanded'), 'false');
    assert(await fallback.locator('.mobile-toggle').evaluate(el => document.activeElement === el));
    results.push({ test: 'mobile-menu-keyboard', pass: true });
    const reducedContext = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    const reducedPage = await reducedContext.newPage();
    const reducedRequests = [];
    reducedPage.on('request', req => reducedRequests.push(req.url()));
    await reducedPage.goto(base, { waitUntil: 'networkidle' });
    assert.equal(await reducedPage.locator('[data-operation-story]').getAttribute('data-mode'), 'reduced-motion');
    assert(!reducedRequests.some(url => /vendor\//.test(url)));
    results.push({ test: 'initial-reduced-motion-no-vendor-downloads', pass: true });
    const brokenContext = await browser.newContext();
    const brokenPage = await brokenContext.newPage();
    await brokenPage.route('**/vendor/gsap.min.js', route => route.fulfill({ status: 404, body: '' }));
    await brokenPage.goto(base, { waitUntil: 'networkidle' });
    assert.equal(await brokenPage.locator('[data-operation-story]').getAttribute('data-mode'), 'dependency-fallback');
    assert(await brokenPage.locator('.operation-cta').isVisible());
    results.push({ test: 'missing-library-fallback', pass: true });
    const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const plain = await noJS.newPage();
    await plain.goto(base);
    assert(await plain.locator('h1').isVisible());
    assert(await plain.locator('.operation-cta').isVisible());
    assert.equal(await plain.locator('.solution-feature').first().evaluate(el => getComputedStyle(el).opacity), '1');
    results.push({ test: 'no-js-content-and-cta', pass: true });
    for (const file of ['para-instituicoes.html', 'para-profissionais.html', 'solucoes.html', 'gestao-de-escalas-medicas.html', 'sobre.html', 'conteudos.html', 'contato.html', 'privacidade.html']) {
      const response = await page.goto(base + file, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('.operation-render').count(), 0);
      assert.equal(await page.locator('script[src*="vendor"]').count(), 0);
      results.push({ test: file, pass: true });
    }
    assert.deepEqual(errors, []);
    results.push({ test: 'console', errors });
  } finally {
    await fs.writeFile(path.join(out, 'results.json'), JSON.stringify({ results, errors, networkFailures }, null, 2));
    console.log(JSON.stringify({ results, errors, networkFailures }, null, 2));
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
