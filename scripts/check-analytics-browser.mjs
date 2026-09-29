// Optional isolated Chromium check. Every request is fulfilled locally or aborted.
// BLOG_PLAYWRIGHT_MODULE may point to a temporary Playwright installation; see docs/analytics.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.BLOG_PLAYWRIGHT_MODULE || 'playwright');
const build = path.resolve(process.argv[2] || 'public');
const browser = await chromium.launch({ headless: true, executablePath: process.env.BLOG_CHROMIUM_EXECUTABLE || undefined });
const token = 'ba6343dfd33a4e5998a37308989dd022';
const cfKey = 'blog.basic-analytics-disabled.v1';
const gaKey = 'blog.analytics-consent.v1';
const origin = 'https://blog.mingon.dev';
const results = [];

async function session({ viewport = { width: 1365, height: 900 }, localStorage = [], javaScriptEnabled = true, blocked = false } = {}) {
  const context = await browser.newContext({ viewport, javaScriptEnabled, serviceWorkers: 'block',
    storageState: { cookies: [], origins: [{ origin, localStorage }] } });
  if (blocked) await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw Error('Storage blocked'); } });
  });
  const requests = [], errors = [];
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === 'static.cloudflareinsights.com') {
      requests.push({ kind: 'cf', url: url.href, referer: request.headers().referer });
      return route.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body:
        'window.__cfStub = JSON.parse(document.querySelector("script[data-cf-beacon]").dataset.cfBeacon);' });
    }
    if (/google(?:tagmanager|analytics)|google-analytics|analytics\.google/.test(url.hostname)) {
      requests.push({ kind: 'google', url: url.href });
      return route.fulfill({ contentType: 'text/javascript', body: 'window.__gtmStub = true;' });
    }
    // Serve all tested hosts from the local build. No request ever goes to production.
    if (['blog.mingon.dev', 'kmingon.github.io', 'preview.mingon.dev', 'localhost'].includes(url.hostname)) {
      const name = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const file = path.resolve(build, name.endsWith('/') || !name ? name + 'index.html' : name);
      if (file.startsWith(build + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }[path.extname(file)] || 'application/octet-stream';
        return route.fulfill({ contentType: type, body: fs.readFileSync(file) });
      }
    }
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, requests, errors, count: kind => requests.filter(r => r.kind === kind).length };
}

try {
  for (const viewport of [{ width: 1365, height: 900 }, { width: 390, height: 844 }]) {
    const s = await session({ viewport });
    await s.page.goto(origin + '/privacy/?q=PRIVATE_SENTINEL#PRIVATE_SENTINEL');
    await s.page.waitForFunction(() => window.__cfStub);
    assert.equal(s.count('cf'), 1);
    assert.equal(s.count('google'), 0, 'No Google requests before consent');
    assert.deepEqual(await s.page.evaluate(() => window.__cfStub), { token });
    assert.equal(await s.page.locator('script[data-cf-beacon]').getAttribute('type'), 'module');
    assert.equal(s.requests[0].referer, origin + '/');
    const box = await s.page.locator('#analytics-consent').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= viewport.width && box.y >= 0 && box.y + box.height <= viewport.height);
    await s.page.locator('[data-analytics-choice="denied"]').click();
    assert.equal(s.count('google'), 0, 'Rejecting Google leaves it unloaded');
    await Promise.all([s.page.waitForEvent('load'), s.page.locator('#basic-analytics-toggle').click()]);
    assert.equal(s.count('cf'), 1, 'Opt-out reload does not load another beacon');
    assert.equal(await s.page.locator('script[data-cf-beacon]').count(), 0);
    assert.equal(await s.page.evaluate(key => localStorage.getItem(key), cfKey), '1');
    await s.page.locator('[data-analytics-settings]:visible').first().click();
    await s.page.locator('[data-analytics-choice="granted"]').click();
    await s.page.waitForFunction(() => window.__gtmStub);
    await s.page.locator('[data-analytics-settings]:visible').first().click();
    await s.page.locator('[data-analytics-choice="granted"]').click();
    assert.equal(s.count('google'), 1, 'Repeated consent loads GTM once');
    assert.equal(s.count('cf'), 1, 'Google consent does not enable Cloudflare');
    await s.page.locator('[data-analytics-settings]:visible').first().click();
    await Promise.all([s.page.waitForEvent('load'), s.page.locator('[data-analytics-choice="denied"]').click()]);
    assert.equal(s.count('google'), 1, 'Revocation unloads Google');
    await Promise.all([s.page.waitForEvent('load'), s.page.locator('#basic-analytics-toggle').click()]);
    await s.page.waitForFunction(() => window.__cfStub);
    assert.equal(s.count('cf'), 2, 'Re-enable loads once on the new document');
    assert.equal(s.count('google'), 1, 'Cloudflare toggle does not grant Google consent');
    assert.ok(!JSON.stringify(s.requests).includes('PRIVATE_SENTINEL'));
    assert.deepEqual(s.errors, []);
    results.push({ viewport, unknown: { cf: 1, google: 0 }, deniedGoogle: 0, optedOutNewDocument: { cf: 0, google: 0 }, googleConsentGtmLoads: 1, independentChoices: true });
    await s.context.close();
  }
  for (const url of ['http://localhost:1313/', 'https://kmingon.github.io/', 'https://preview.mingon.dev/', 'http://blog.mingon.dev/', origin + ':1313/', origin + '/404.html']) {
    const s = await session({ localStorage: [{ name: gaKey, value: JSON.stringify({ value: 'granted', expires: Date.now() + 60000 }) }] });
    await s.page.goto(url);
    assert.equal(s.requests.length, 0, url);
    await s.context.close();
  }
  for (const options of [{ javaScriptEnabled: false }, { blocked: true }, { localStorage: [{ name: cfKey, value: '1' }] }]) {
    const s = await session(options);
    await s.page.goto(origin + '/privacy/');
    assert.equal(s.requests.length, 0, JSON.stringify(options));
    await s.context.close();
  }
  const tabs = await session();
  await tabs.page.goto(origin + '/privacy/');
  const second = await tabs.context.newPage();
  await second.goto(origin + '/');
  await Promise.all([tabs.page.waitForEvent('load'), second.waitForEvent('load'), tabs.page.locator('#basic-analytics-toggle').click()]);
  assert.equal(await second.locator('script[data-cf-beacon]').count(), 0, 'Other tabs apply opt-out after reload');
  await tabs.context.close();
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), build, mode: 'local HTML and stubbed vendors; all network requests intercepted', results,
    excludedOriginsAnd404: true, javascriptDisabled: true, blockedStorage: true, persistedOptOut: true, crossTabOptOut: true, realAnalyticsRequests: 0 }, null, 2));
} finally {
  await browser.close();
}
