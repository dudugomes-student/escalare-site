const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright-core');
const { createServer } = require('./preview.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(4175, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: viewport.width === 390 ? 3 : 1 });
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.localMetrics = { cls: 0, lcp: 0, longTasks: [] };
        new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.localMetrics.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver(list => { window.localMetrics.lcp = list.getEntries().at(-1).startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver(list => { window.localMetrics.longTasks.push(...list.getEntries().map(e => Math.round(e.duration))); }).observe({ type: 'longtask', buffered: true });
      });
      await page.goto('http://127.0.0.1:4175/escalare-site/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.resolve(__dirname, `../output/poc-review/review-${viewport.width}.png`) });
      results.push({ viewport, metrics: await page.evaluate(() => ({ ...window.localMetrics, diagnostics: document.querySelector('[data-operation-story]').getOperationDiagnostics(), paint: performance.getEntriesByType('paint').map(e => ({ name: e.name, ms: e.startTime })) })) });
      await context.close();
    }
    const files = ['three.module.min.js', 'three.core.min.js', 'gsap.min.js', 'ScrollTrigger.min.js'];
    let raw = 0, gzip = 0;
    for (const file of files) { const content = await fs.readFile(path.resolve(__dirname, '../js/vendor', file)); raw += content.length; gzip += zlib.gzipSync(content).length; }
    results.push({ dependencyBytes: raw, dependencyGzipEstimate: gzip, note: 'Local, unthrottled headless Edge observations; not field data or Lighthouse. Gzip is an estimate; preview serves uncompressed files.' });
    await fs.writeFile(path.resolve(__dirname, '../output/poc-review/performance.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
