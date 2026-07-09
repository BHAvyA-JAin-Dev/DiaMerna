/* ===== DiaMerna — LocalStorage Wrapper ===== */

const DiaMerna = window.DiaMerna || {};

DiaMerna.Storage = (() => {

  const PREFIX = 'diaMerna_';

  function get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Storage.get error:', key, e);
      return null;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('Storage.set error:', key, e);
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
      return true;
    } catch (e) {
      console.warn('Storage.remove error:', key, e);
      return false;
    }
  }

  function getOrDefault(key, defaultValue) {
    const val = get(key);
    return val !== null ? val : defaultValue;
  }

  function pushToList(key, item) {
    const list = getOrDefault(key, []);
    list.push(item);
    set(key, list);
    return list;
  }

  function removeFromList(key, predicate) {
    const list = getOrDefault(key, []);
    const filtered = list.filter(item => !predicate(item));
    set(key, filtered);
    return filtered;
  }

  function clearAll() {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
      keys.forEach(k => localStorage.removeItem(k));
      return keys.length;
    } catch (e) {
      console.warn('Storage.clearAll error:', e);
      return 0;
    }
  }

  function getKeys() {
    try {
      return Object.keys(localStorage)
        .filter(k => k.startsWith(PREFIX))
        .map(k => k.slice(PREFIX.length));
    } catch (e) {
      return [];
    }
  }

  return { get, set, remove, getOrDefault, pushToList, removeFromList, clearAll, getKeys };
})();

window.DiaMerna = DiaMerna;
