/* ===== DiaMerna — Helper Utilities ===== */

const DiaMerna = window.DiaMerna || {};

DiaMerna.Helpers = (() => {

  function formatDate(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  function formatDateLong(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  }

  function formatTime(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit'
    });
  }

  function formatDateTime(date) {
    return `${formatDate(date)} ${formatTime(date)}`;
  }

  function daysBetween(d1, d2) {
    const a = new Date(d1);
    const b = new Date(d2);
    return Math.floor((b - a) / (1000 * 60 * 60 * 24));
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function isDateInPast(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d < new Date();
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.trim().replace(/<[^>]*>/g, '');
  }

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function pluralize(count, singular, plural) {
    return count === 1 ? singular : (plural || singular + 's');
  }

  function timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }

  function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }

  function getTrimester(pregnancyWeeks) {
    const trimesters = DiaMerna.CONSTANTS.CYCLE.TRIMESTERS;
    for (const t of trimesters) {
      if (pregnancyWeeks >= t.weeksStart && pregnancyWeeks <= t.weeksEnd) {
        return t;
      }
    }
    return trimesters[trimesters.length - 1];
  }

  function getDueDate(lmp) {
    return addDays(lmp, 280);
  }

  function fuzzyMatch(ingredient, list) {
    const ing = ingredient.toLowerCase().trim();
    for (const item of list) {
      if (ing.includes(item) || item.includes(ing)) return true;
      const ingWords = ing.split(/\s+/);
      const itemWords = item.split(/\s+/);
      for (const iw of ingWords) {
        if (iw.length > 2 && item.includes(iw)) return true;
      }
    }
    return false;
  }

  return {
    formatDate, formatDateLong, formatTime, formatDateTime,
    daysBetween, addDays, isDateInPast, clamp, sanitizeString,
    debounce, generateId, pluralize, timeAgo, getWeekNumber,
    getTrimester, getDueDate, fuzzyMatch
  };
})();

window.DiaMerna = DiaMerna;
