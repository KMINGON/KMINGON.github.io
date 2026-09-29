(() => {
  'use strict';
  const config = document.getElementById('blog-cloudflare');
  if (!config || location.origin !== 'https://blog.mingon.dev' || config.dataset.initialized) return;
  if (!/^[a-f0-9]{32}$/.test(config.dataset.token)) return;
  config.dataset.initialized = 'true';

  const key = 'blog.basic-analytics-disabled.v1';
  const button = document.getElementById('basic-analytics-toggle');
  const status = document.getElementById('basic-analytics-status');
  let disabled;
  try {
    disabled = localStorage.getItem(key) === '1';
  } catch (_) {
    // Do not collect when the visitor's saved opt-out cannot be read.
    if (status) status.textContent = '브라우저 저장소에 접근할 수 없어 기본 통계를 실행하지 않았습니다.';
    return;
  }

  if (button) {
    button.hidden = false;
    button.textContent = disabled ? '기본 통계 켜고 새로고침' : '기본 통계 끄고 새로고침';
    status.textContent = disabled ? '이 브라우저의 기본 통계는 꺼져 있습니다.' : '이 브라우저의 기본 통계는 켜져 있습니다.';
    button.addEventListener('click', () => {
      try {
        localStorage.setItem(key, disabled ? '0' : '1');
      } catch (_) {
        status.textContent = '설정을 저장하지 못했습니다. 변경이 적용되지 않았으므로 브라우저의 저장소 설정을 확인해 주세요.';
        return;
      }
      // Removing a script does not unload its listeners. Apply the saved choice on reload.
      location.reload();
    });
  }
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) location.reload();
  });

  // A pre-existing automatic snippet must be disabled at the provider before deployment.
  if (disabled || document.querySelector('script[data-cf-beacon], script[src^="https://static.cloudflareinsights.com/beacon.min.js"]')) return;
  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.dataset.cfBeacon = JSON.stringify({ token: config.dataset.token });
  document.head.appendChild(script);
})();
