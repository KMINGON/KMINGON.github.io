(() => {
  'use strict';
  const config = document.getElementById('blog-analytics');
  if (!config || location.hostname !== 'blog.mingon.dev' || location.protocol !== 'https:') return;

  const key = 'blog.analytics-consent.v1';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const banner = document.getElementById('analytics-consent');
  const measurement = config.dataset.measurement;
  let loaded = false;

  function choice() {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      if (value && value.expires > Date.now() && ['granted', 'denied'].includes(value.value)) return value.value;
    } catch (_) { /* Storage may be unavailable; ask again on the next page. */ }
    return null;
  }

  function clearCookies() {
    const streamCookie = '_ga_' + measurement.slice(2).replaceAll('-', '_');
    for (const name of ['_ga', streamCookie]) {
      for (const domain of ['', location.hostname, '.' + location.hostname]) {
        document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax; Secure' + (domain ? '; Domain=' + domain : '');
      }
    }
    // Retire this blog's legacy stream cookie without touching sibling streams.
    document.cookie = streamCookie + '=; Max-Age=0; Path=/; Domain=.mingon.dev; SameSite=Lax; Secure';
  }

  function start() {
    if (loaded) return;
    const page = new URL(config.dataset.pageUrl);
    if (page.origin !== 'https://blog.mingon.dev') return;
    loaded = true;
    window['ga-disable-' + measurement] = false;
    window.dataLayer = window.dataLayer || [];
    function queue() { window.dataLayer.push(arguments); }
    // Called only after explicit consent. Set it before GTM loads; revocation unloads GTM.
    queue('consent', 'default', {
      analytics_storage: 'granted', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'
    });
    queue('set', 'ads_data_redaction', true);
    queue('set', 'url_passthrough', false);
    let referrer = '';
    try { referrer = new URL(document.referrer).origin; } catch (_) { /* Direct visit. */ }
    window.dataLayer.push({
      blog_page_location: page.origin + page.pathname,
      blog_page_title: config.dataset.pageTitle,
      blog_page_referrer: /^https?:\/\//.test(referrer) ? referrer : ''
    });
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtm.js?id=' + config.dataset.container;
    document.head.appendChild(script);
    window.dataLayer.push({ event: 'blog_analytics_ready' });
  }

  function stop() {
    window['ga-disable-' + measurement] = true;
    clearCookies();
    // Unload third-party timers and listeners, including pending engagement events.
    if (loaded) location.reload();
  }

  document.querySelectorAll('[data-analytics-settings]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      banner.hidden = false;
      document.getElementById('analytics-consent-title').focus();
    });
  });
  document.querySelectorAll('[data-analytics-choice]').forEach(button => {
    button.addEventListener('click', () => {
      const value = button.dataset.analyticsChoice;
      try { localStorage.setItem(key, JSON.stringify({ value, expires: Date.now() + lifetime })); } catch (_) {}
      banner.hidden = true;
      if (value === 'granted') start(); else stop();
    });
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      if (choice() !== 'granted') stop();
      banner.hidden = choice() !== null;
    }
  });
  const saved = choice();
  banner.hidden = saved !== null;
  if (saved === 'granted') start(); else stop();
})();
