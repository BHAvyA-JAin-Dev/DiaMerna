/* ===== DiaMerna — Glucose Logger Module ===== */

const DiaMerna = window.DiaMerna || {};

DiaMerna.GlucoseLogger = (() => {

  const C = DiaMerna.CONSTANTS.GLUCOSE;
  const Storage = DiaMerna.Storage;
  const Helpers = DiaMerna.Helpers;
  const STORAGE_KEY = 'glucoseLogs';

  let selectedTiming = 'fasting';

  function getLogs() {
    return Storage.getOrDefault(STORAGE_KEY, []);
  }

  function saveLogs(logs) {
    Storage.set(STORAGE_KEY, logs);
  }

  function isHighReading(value, timing) {
    const threshold = C.THRESHOLDS[timing];
    return threshold && value >= threshold.high;
  }

  function getThresholdForTiming(timing) {
    return C.THRESHOLDS[timing] || C.THRESHOLDS.fasting;
  }

  function logReading(value, timing) {
    const logs = getLogs();
    const threshold = getThresholdForTiming(timing);
    const entry = {
      id: Helpers.generateId(),
      value: Helpers.clamp(value, C.MIN_VALUE, C.MAX_VALUE),
      timing: timing,
      timingLabel: `${threshold.emoji} ${threshold.label}`,
      isHigh: isHighReading(value, timing),
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
    logs.push(entry);
    saveLogs(logs);
    return entry;
  }

  function clearLogs() {
    saveLogs([]);
  }

  function getRecentLogs(count) {
    const logs = getLogs();
    return logs.slice(-count).reverse();
  }

  function getLogsByDate(dateStr) {
    return getLogs().filter(l => l.date && l.date.startsWith(dateStr));
  }

  function getDailySummary(dateStr) {
    const dayLogs = getLogsByDate(dateStr || new Date().toISOString().split('T')[0]);
    if (!dayLogs.length) return null;
    const values = dayLogs.map(l => l.value);
    return {
      count: dayLogs.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      highCount: dayLogs.filter(l => l.isHigh).length,
      entries: dayLogs
    };
  }

  function getWeeklySummary() {
    const logs = getLogs();
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const weekLogs = logs.filter(l => l.timestamp >= weekAgo);
    if (!weekLogs.length) return null;
    const values = weekLogs.map(l => l.value).filter(v => !isNaN(v));
    return {
      count: weekLogs.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      highCount: weekLogs.filter(l => l.isHigh).length,
      entries: weekLogs
    };
  }

  function renderChart(container) {
    const logs = getRecentLogs(50);
    if (!logs.length) {
      container.innerHTML = '<div class="text-xs text-gray-500 text-center py-6">No readings logged yet.<br><span class="text-gray-600">Enter a value above and tap Log to begin.</span></div>';
      return;
    }

    const highCount = logs.filter(l => l.isHigh).length;
    const totalCount = logs.length;
    const avgValue = Math.round(logs.reduce((s, l) => s + l.value, 0) / totalCount);

    const statsHtml = `
      <div class="grid grid-cols-3 gap-2 mb-3">
        <div class="text-center p-2 rounded-lg bg-cyber-bg/40">
          <div class="text-lg font-bold text-white">${totalCount}</div>
          <div class="text-[10px] text-gray-400">Total</div>
        </div>
        <div class="text-center p-2 rounded-lg bg-cyber-bg/40">
          <div class="text-lg font-bold text-cyber-mint">${avgValue}</div>
          <div class="text-[10px] text-gray-400">Avg mg/dL</div>
        </div>
        <div class="text-center p-2 rounded-lg bg-cyber-bg/40">
          <div class="text-lg font-bold ${highCount > 0 ? 'text-cyber-warn' : 'text-cyber-mint'}">${highCount}</div>
          <div class="text-[10px] text-gray-400">High</div>
        </div>
      </div>
    `;

    const entriesHtml = logs.slice(0, 20).map(entry => {
      const threshold = getThresholdForTiming(entry.timing);
      const timeAgo = Helpers.timeAgo(entry.timestamp);
      return `
        <div class="glucose-entry ${entry.isHigh ? 'border-cyber-warn/30' : ''}">
          <div class="flex items-center gap-2">
            <span class="value ${entry.isHigh ? 'high' : 'normal'}">${entry.value}</span>
            <span class="text-xs text-gray-500">mg/dL</span>
            ${entry.isHigh ? '<span class="text-[10px] text-cyber-warn font-semibold">▲ Spike</span>' : ''}
          </div>
          <div class="text-right">
            <div class="timing">${threshold.emoji} ${threshold.label}</div>
            <div class="time">${timeAgo}</div>
          </div>
        </div>`;
    }).join('');

    container.innerHTML = statsHtml + entriesHtml;
  }

  function init() {
    const input = document.getElementById('glucoseInput');
    const logBtn = document.getElementById('logGlucoseBtn');
    const clearBtn = document.getElementById('clearGlucoseBtn');
    const chart = document.getElementById('glucoseChart');
    const timingTags = document.querySelectorAll('.timing-btn');

    timingTags.forEach(btn => {
      btn.addEventListener('click', () => {
        timingTags.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedTiming = btn.dataset.timing;
      });
    });

    logBtn.addEventListener('click', () => {
      const raw = input.value.trim();
      if (!raw) { input.focus(); return; }
      const value = parseInt(raw);
      if (isNaN(value) || value < C.MIN_VALUE || value > C.MAX_VALUE) {
        input.value = '';
        input.focus();
        return;
      }
      logReading(value, selectedTiming);
      input.value = '';
      renderChart(chart);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') logBtn.click();
    });

    clearBtn.addEventListener('click', () => {
      if (confirm('Clear all glucose readings? This cannot be undone.')) {
        clearLogs();
        renderChart(chart);
      }
    });

    renderChart(chart);
  }

  return { init, getLogs, logReading, clearLogs, getRecentLogs, getDailySummary, getWeeklySummary, renderChart };
})();

window.DiaMerna = DiaMerna;
