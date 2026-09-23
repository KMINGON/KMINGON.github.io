// Run after `hugo --minify`: node scripts/check-analytics.mjs public
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync('assets/js/analytics.js', 'utf8');
const consentKey = 'blog.analytics-consent.v1';
function browser({ saved = null, hostname = 'blog.mingon.dev', blocked = false } = {}) {
  const handlers = {};
  const button = value => ({ hidden: true, dataset: { analyticsChoice: value }, addEventListener: (_, fn) => { handlers[value] = fn; } });
  const settings = button('settings');
  const buttons = [button('granted'), button('denied')];
  const banner = { hidden: true };
  const scripts = [], cookies = [], values = new Map([[consentKey, saved]]);
  let reloads = 0;
  const window = { addEventListener: (name, fn) => { handlers[name] = fn; } };
  const document = {
    referrer: 'https://example.org/private/path?q=PRIVATE_SENTINEL#secret',
    getElementById: id => id === 'blog-analytics' ? { dataset: {
      container: 'GTM-KLNKCLLG', measurement: 'G-GGY59YGHKJ',
      pageUrl: 'https://blog.mingon.dev/analysis/example/', pageTitle: 'Example'
    } } : id === 'analytics-consent' ? banner : { focus() {} },
    querySelectorAll: selector => selector === '[data-analytics-settings]' ? [settings] : buttons,
    createElement: () => ({}), head: { appendChild: script => scripts.push(script) },
    set cookie(value) { cookies.push(value); }
  };
  const localStorage = {
    getItem(key) { if (blocked) throw Error('blocked'); return values.get(key); },
    setItem(key, value) { if (blocked) throw Error('blocked'); values.set(key, value); }
  };
  vm.runInNewContext(source, { window, document, localStorage, URL, Date,
    location: { hostname, protocol: 'https:', search: '?q=PRIVATE_SENTINEL', hash: '#PRIVATE_SENTINEL', reload: () => { reloads++; } }
  });
  return { handlers, window, scripts, banner, settings, values, cookies, get reloads() { return reloads; } };
}
const saved = value => JSON.stringify({ value, expires: Date.now() + 60000 });
for (const initial of [null, saved('denied'), '{bad json', JSON.stringify({ value: 'granted', expires: 1 })]) {
  const page = browser({ saved: initial });
  assert.equal(page.scripts.length, 0, 'No container before valid consent');
  assert.equal(page.window.dataLayer, undefined, 'No pre-consent events');
}
const page = browser();
assert.equal(page.banner.hidden, false);
page.handlers.denied();
assert.equal(page.scripts.length, 0);
page.handlers.settings();
assert.equal(page.banner.hidden, false);
page.handlers.granted();
page.handlers.granted();
assert.equal(page.scripts.length, 1, 'Container loads once per document');
assert.equal(page.scripts[0].src, 'https://www.googletagmanager.com/gtm.js?id=GTM-KLNKCLLG');
const data = page.window.dataLayer;
assert.equal(data[0][0], 'consent');
assert.equal(data[0][2].analytics_storage, 'granted');
assert.equal(data[0][2].ad_user_data, 'denied');
assert.equal(data.filter(x => x.event === 'blog_analytics_ready').length, 1);
assert.equal(data.find(x => x.blog_page_location).blog_page_referrer, 'https://example.org');
assert.ok(!JSON.stringify(data).includes('PRIVATE_SENTINEL'));
page.handlers.denied();
assert.equal(page.window['ga-disable-G-GGY59YGHKJ'], true);
assert.equal(page.reloads, 1, 'Revocation unloads third-party code');
assert.ok(!page.cookies.some(x => x.startsWith('_ga=') && x.includes('Domain=.mingon.dev')));
const otherTab = browser({ saved: saved('granted') });
otherTab.values.set(consentKey, saved('denied'));
otherTab.handlers.storage({ key: consentKey });
assert.equal(otherTab.reloads, 1);
assert.equal(browser({ saved: saved('granted') }).scripts.length, 1);
assert.equal(browser({ saved: saved('granted'), hostname: 'localhost' }).scripts.length, 0);
assert.equal(browser({ saved: saved('granted'), hostname: 'toy.mingon.dev' }).scripts.length, 0);
const unavailable = browser({ blocked: true });
unavailable.handlers.granted();
assert.equal(unavailable.scripts.length, 1);

const build = process.argv[2] || 'public';
let pages = 0;
for (const name of fs.readdirSync(build, { recursive: true })) {
  if (!name.endsWith('.html')) continue;
  const html = fs.readFileSync(path.join(build, name), 'utf8');
  assert.ok(!/googletagmanager\.com\/(?:gtag\/js|ns\.html)|cloudflareinsights\.com\/beacon/.test(html), name);
  assert.ok(!html.includes('GTM-W63DRPTG'), name);
  if (!html.includes('name=generator') && !html.includes('name="generator"')) continue;
  if (/http-equiv=["']?refresh/i.test(html)) continue;
  assert.equal((html.match(/id=["']?blog-analytics(?=[\s"'>])/g) || []).length, name === '404.html' ? 0 : 1, name);
  assert.equal((html.match(/id=["']?analytics-consent(?=[\s"'>])/g) || []).length, 1, name);
  pages++;
}
assert.ok(pages > 100, 'Production HTML must be built before checking');
assert.ok(fs.existsSync(path.join(build, 'privacy/index.html')), 'Privacy notice must be published');
console.log(`Analytics checks passed: consent, revocation, privacy, hostname isolation, ${pages} HTML pages.`);
