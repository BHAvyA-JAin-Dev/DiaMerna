const Store = {
  get(k, def = null) {
    try { const v = localStorage.getItem('dm_' + k); return v ? JSON.parse(v) : def }
    catch { return def }
  },
  set(k, v) {
    try { localStorage.setItem('dm_' + k, JSON.stringify(v)) } catch {}
  },
  push(k, item) {
    const arr = this.get(k, []); arr.push(item); this.set(k, arr); return arr
  },
  remove(k, pred) {
    this.set(k, this.get(k, []).filter(pred))
  }
};
