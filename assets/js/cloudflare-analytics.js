(() => {
  'use strict';
  const config = document.getElementById('blog-cloudflare');
  if (!config || location.origin !== 'https://blog.mingon.dev' || config.dataset.initialized) return;
  if (!/^[a-f0-9]{32}$/.test(config.dataset.token)) return;
  config.dataset.initialized = 'true';

  if (document.querySelector('script[data-cf-beacon], script[src^="https://static.cloudflareinsights.com/beacon.min.js"]')) return;
  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.dataset.cfBeacon = JSON.stringify({ token: config.dataset.token });
  document.head.appendChild(script);
})();
