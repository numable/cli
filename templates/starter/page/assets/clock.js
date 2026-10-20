/* 首页示例只读设备时间；复用 numable.css 时可替换本脚本与正文。 */
(() => {
  const root = document.documentElement;
  const copy = {
    'zh-CN': { title: '此刻', subtitle: '跟随你所在的时区', now: '当地时间', details: '今天', weekday: '星期', zone: '时区', add: '添加组件', privacy: '使用设备时间，无需联网。', error: '暂时无法打开，请稍后重试。' },
    'en-US': { title: 'Right now', subtitle: 'In your local time zone', now: 'Local time', details: 'Today', weekday: 'Day', zone: 'Time zone', add: 'Add widget', privacy: 'Uses your device clock. No network needed.', error: 'Could not open. Please try again.' },
  };
  let locale = root.dataset.lang || root.lang || 'zh-CN';
  function render() {
    const words = copy[locale.startsWith('zh') ? 'zh-CN' : 'en-US'];
    root.lang = locale;
    document.title = words.title;
    document.querySelectorAll('[data-copy]').forEach(el => { el.textContent = words[el.dataset.copy]; });
    const now = new Date();
    const fmt = options => new Intl.DateTimeFormat(locale, options).format(now);
    document.getElementById('time').textContent = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    document.getElementById('date').textContent = fmt({ year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('weekday').textContent = fmt({ weekday: 'long' });
    document.getElementById('zone').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  addEventListener('languagechange', e => {
    locale = e.detail?.language || root.dataset.lang || locale;
    render();
  });
  const inApp = !!(window.xbridge && window.xbridge.isXBundleEnv());
  if (inApp) {
    document.getElementById('app-actions').hidden = false;
    window.xbridge.appInfo().then(r => {
      if (r?.code !== 0 || !r.data) return;
      // 属性可能已由容器更新，异步回包不能盖回旧主题或旧语言。
      if (!root.dataset.theme && ['light', 'dark'].includes(r.data.theme)) root.dataset.theme = r.data.theme;
      locale = root.dataset.lang || r.data.language || r.data.locale || locale;
      render();
    }).catch(() => { /* 容器属性仍可驱动页面。 */ });
  }
  document.getElementById('add-widget').addEventListener('click', async () => {
    const error = document.getElementById('error');
    error.hidden = true;
    try {
      await window.xbridge.pickWidgets([{ id: 'clock', params: {} }]);
    } catch {
      error.textContent = copy[locale.startsWith('zh') ? 'zh-CN' : 'en-US'].error;
      error.hidden = false;
    }
  });
  render();
  // 页面回来立即校准；主题由 CSS 属性驱动，不触发取数。
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  setInterval(() => { if (!document.hidden) render(); }, 1000);
})();
