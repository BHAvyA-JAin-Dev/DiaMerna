/* ===== DiaMerna — Main Application Entry ===== */

const DiaMerna = window.DiaMerna || {};

DiaMerna.App = (() => {

  function initTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const target = document.getElementById(`tab-${btn.dataset.tab}`);
        if (target) target.classList.add('active');

        if (btn.dataset.tab === 'routine') {
          DiaMerna.RoutineBuilder?.renderDailyStats();
        }
      });
    });
  }

  function checkBrowserSupport() {
    const issues = [];
    if (!window.localStorage) issues.push('localStorage is not supported in this browser.');
    if (!window.fetch) issues.push('Fetch API is not supported in this browser.');
    if (!window.Promise) issues.push('Promises are not supported in this browser.');

    if (issues.length) {
      const app = document.getElementById('app');
      if (app) {
        app.innerHTML = `
          <div class="glass-panel p-6 text-center">
            <span class="text-4xl mb-4 block">⚠️</span>
            <h2 class="text-lg font-semibold text-cyber-warn mb-2">Browser Incompatible</h2>
            <ul class="text-sm text-gray-400 space-y-1">
              ${issues.map(i => `<li>${i}</li>`).join('')}
            </ul>
            <p class="text-xs text-gray-500 mt-4">Please use a modern browser like Chrome, Firefox, Edge, or Safari.</p>
          </div>
        `;
      }
      return false;
    }
    return true;
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
      });
    }
  }

  function init() {
    if (!checkBrowserSupport()) return;

    document.documentElement.classList.add('dark');

    initTabNavigation();

    const modules = [
      'GlucoseLogger',
      'CycleCalculator',
      'MealAnalyzer',
      'RoutineBuilder',
      'AIChat'
    ];

    modules.forEach(name => {
      try {
        if (DiaMerna[name] && typeof DiaMerna[name].init === 'function') {
          DiaMerna[name].init();
        }
      } catch (e) {
        console.error(`DiaMerna.${name} init error:`, e);
      }
    });

    registerServiceWorker();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  DiaMerna.App.init();
});
