function today() { return new Date().toISOString().slice(0, 10) }

function now() { return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) }

function dateStr(d) { return d.toISOString().slice(0, 10) }

function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return dateStr(d) }

function diffDays(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000) }

function weekFromLMP(lmp) {
  const days = diffDays(lmp, today()); const weeks = Math.floor(days / 7); return Math.max(4, Math.min(42, weeks))
}

function pregnancyWeek(lmp) {
  if (!lmp) return 28; const days = diffDays(lmp, today())
  const w = Math.floor(days / 7); const d = days % 7; return { w: Math.max(0, Math.min(42, w)), d }
}

function dueDate(lmp) {
  const d = new Date(lmp); d.setDate(d.getDate() + 280); return dateStr(d)
}

function ovulationDate(lmp, cycle = 28) {
  const d = new Date(lmp); d.setDate(d.getDate() + (cycle - 14)); return dateStr(d)
}

function fertileWindow(lmp, cycle = 28) {
  const o = new Date(lmp); o.setDate(o.getDate() + (cycle - 14))
  const s = new Date(o); s.setDate(s.getDate() - 5)
  const e = new Date(o); e.setDate(e.getDate() + 1)
  return { start: dateStr(s), end: dateStr(e), ov: dateStr(o) }
}

function babyGrowth(w) {
  if (w < 4) return BABY_GROWTH[0]
  if (w > 42) return BABY_GROWTH[BABY_GROWTH.length - 1]
  const idx = BABY_GROWTH.findIndex(g => g.w >= w)
  if (idx === -1) return BABY_GROWTH[BABY_GROWTH.length - 1]
  if (idx === 0) return BABY_GROWTH[0]
  const prev = BABY_GROWTH[idx - 1]; const next = BABY_GROWTH[idx]
  const t = (w - prev.w) / (next.w - prev.w)
  return {
    w, fruit: next.fruit, emoji: next.emoji,
    g: Math.round(prev.g + (next.g - prev.g) * t),
    cm: Math.round((prev.cm + (next.cm - prev.cm) * t) * 10) / 10
  }
}

/* ---------- SVG Chart ---------- */
function drawGlucoseChart(canvasId, readings, days = 7) {
  const el = document.getElementById(canvasId); if (!el) return
  const w = el.clientWidth || 320; const h = 140; const pad = { t: 10, r: 10, b: 20, l: 30 }
  const cw = w - pad.l - pad.r; const ch = h - pad.t - pad.b

  const cutoff = days === 'all' ? new Date('2020-01-01') : daysAgo(days)
  const filtered = readings.filter(r => r.date >= cutoff)
  const sorted = [...filtered].sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time))
  const vals = sorted.map(r => r.val)

  if (!vals.length) { el.innerHTML = '<div class="empty-state" style="height:'+h+'px;display:flex;align-items:center;justify-content:center">No data yet</div>'; return }

  const min = Math.min(50, Math.floor(Math.min(...vals) / 10) * 10)
  const max = Math.max(250, Math.ceil(Math.max(...vals) / 10) * 10)
  const range = max - min || 1

  const points = sorted.map((r, i) => {
    const x = pad.l + (i / Math.max(sorted.length - 1, 1)) * cw
    const y = pad.t + ch - ((r.val - min) / range) * ch
    return { x, y, val: r.val, date: r.date, time: r.time, label: r.label || '' }
  })

  const dLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('')
  const dArea = points.length > 1 ? `M${points[0].x},${pad.t + ch}L${dLine.slice(1)}L${points[points.length-1].x},${pad.t + ch}Z` : ''

  const svg = `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="gradPink" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${getComputedStyle(document.documentElement).getPropertyValue('--pink').trim() || '#ff6b9d'}" stop-opacity=".3"/><stop offset="100%" stop-color="${getComputedStyle(document.documentElement).getPropertyValue('--pink').trim() || '#ff6b9d'}" stop-opacity="0"/></linearGradient></defs>
    <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + ch}" stroke="var(--border)" stroke-width="1"/>
    <line x1="${pad.l}" y1="${pad.t + ch}" x2="${pad.l + cw}" y2="${pad.t + ch}" stroke="var(--border)" stroke-width="1"/>
    <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l + cw}" y2="${pad.t}" stroke="var(--border)" stroke-width=".5" stroke-dasharray="3,3"/>
    <text x="${pad.l}" y="${pad.t - 4}" class="chart-label" text-anchor="start">${max}</text>
    <text x="${pad.l}" y="${pad.t + ch + 12}" class="chart-label" text-anchor="start">${min}</text>
    ${points.length > 1 ? `<path d="${dArea}" class="chart-area"/>` : ''}
    <path d="${points.length === 1 ? `M${points[0].x - 2},${points[0].y}L${points[0].x + 2},${points[0].y}` : dLine}" class="chart-line"/>
    ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" class="chart-dot"><title>${p.date} ${p.time}: ${p.val} mg/dL${p.label ? ' ('+p.label+')' : ''}</title></circle>`).join('')}
  </svg>`
  el.innerHTML = svg
}

function timeInRange(readings) {
  const vals = (readings || []).filter(r => r.val > 0)
  if (!vals.length) return { low: 0, normal: 0, high: 0, avg: 0 }
  const low = vals.filter(r => r.val < 70).length
  const normal = vals.filter(r => r.val >= 70 && r.val <= 140).length
  const high = vals.filter(r => r.val > 140).length
  const total = vals.length
  const avg = Math.round(vals.reduce((s, r) => s + r.val, 0) / total)
  return {
    low: Math.round(low / total * 100) || 0,
    normal: Math.round(normal / total * 100) || 0,
    high: Math.round(high / total * 100) || 0,
    avg, total, lowCount: low, highCount: high
  }
}

function goalProgress() {
  const g = Store.get('goals', {})
  const keys = ['walk20', 'water8', 'medicine', 'sugarCheck', 'healthyMeal']
  const done = keys.filter(k => g[k] === today()).length
  return { done, total: keys.length, pct: Math.round(done / keys.length * 100) || 0 }
}
