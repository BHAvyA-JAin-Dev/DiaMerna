/* DiaMerna — Cross-Platform Sync Engine
   Syncs local data (weight, BP, contractions, glucose, baby growth)
   with the shared backend server so all platforms share the same data.

   Sync strategy:
   - On login: pull all server data, merge with local, save locally
   - On data change: push to server
   - Periodic background sync: every 5 minutes
   - Manual sync button: in sidebar */

(function () {
  const SYNC_INTERVAL = 5 * 60 * 1000 // 5 min
  let syncTimer = null

  function getToken() {
    try { return localStorage.getItem('diamerna_token') } catch { return null }
  }

  function apiUrl(path) {
    const serverUrl = (window.Cfg && window.Cfg.SERVER_URL) || ''
    if (serverUrl) return serverUrl.replace(/\/+$/, '') + path
    const base = window.API_URL || (window.Cfg && window.Cfg.URL) || ''
    return (base || '') + path
  }

  /* === Collect all local data === */
  function collectLocalData() {
    const data = {}

    /* Weight */
    try {
      const w = JSON.parse(localStorage.getItem('diamerna_weight') || '[]')
      data.weight = w.map((x, i) => ({
        id: 'local_w_' + i + '_' + (x.date || ''),
        weight: x.w,
        date: x.date || new Date().toISOString().split('T')[0]
      }))
    } catch { data.weight = [] }

    /* Blood Pressure */
    try {
      const bp = JSON.parse(localStorage.getItem('diamerna_bp') || '[]')
      data.bp = bp.map((x, i) => ({
        id: 'local_bp_' + i + '_' + (x.date || ''),
        systolic: x.s, diastolic: x.d,
        date: x.date || new Date().toISOString().split('T')[0]
      }))
    } catch { data.bp = [] }

    /* Contractions */
    try {
      const c = JSON.parse(localStorage.getItem('diamerna_contractions') || '[]')
      data.contractions = c.map((x, i) => ({
        id: 'local_c_' + i + '_' + (x.date || x.start || ''),
        start_time: x.start || x.date || '',
        end_time: x.end || '',
        duration_sec: x.duration || 0,
        date: (x.date || new Date().toISOString().split('T')[0])
      }))
    } catch { data.contractions = [] }

    /* Glucose */
    try {
      const g = JSON.parse(localStorage.getItem('diamerna_glucose') || '[]')
      data.glucose = g.map((x, i) => ({
        id: 'local_g_' + i + '_' + (x.date || x.time || ''),
        value: x.value || x.v || 0,
        meal_type: x.meal_type || x.meal || '',
        notes: x.notes || '',
        date: x.date || new Date().toISOString().split('T')[0]
      }))
    } catch { data.glucose = [] }

    /* Baby Growth */
    try {
      const bg = JSON.parse(localStorage.getItem('diamerna_baby_growth') || '[]')
      data.babyGrowth = bg.map((x, i) => ({
        id: 'local_bg_' + i + '_' + (x.date || ''),
        week: x.week || 0,
        weight: x.weight || null,
        height: x.height || null,
        notes: x.notes || '',
        date: x.date || new Date().toISOString().split('T')[0]
      }))
    } catch { data.babyGrowth = [] }

    return data
  }

  /* === Merge server data into local storage === */
  function mergeToLocal(serverData) {
    let changed = false

    /* Weight */
    if (Array.isArray(serverData.weight) && serverData.weight.length) {
      try {
        let local = JSON.parse(localStorage.getItem('diamerna_weight') || '[]')
        const localKeys = new Set(local.map(x => x.date || ''))
        const existingW = new Set(local.map(x => Math.round(x.w * 10)))
        for (const s of serverData.weight) {
          const key = s.date || ''
          const wVal = Math.round(parseFloat(s.weight) * 10)
          if (key && !existingW.has(wVal) && !localKeys.has(key)) {
            local.push({ w: parseFloat(s.weight), date: key })
            changed = true
          }
        }
        localStorage.setItem('diamerna_weight', JSON.stringify(local))
      } catch {}
    }

    /* BP */
    if (Array.isArray(serverData.bp) && serverData.bp.length) {
      try {
        let local = JSON.parse(localStorage.getItem('diamerna_bp') || '[]')
        const localKeys = new Set(local.map(x => (x.date || '') + '_' + (x.s || 0) + '_' + (x.d || 0)))
        for (const s of serverData.bp) {
          const key = (s.date || '') + '_' + (s.systolic || 0) + '_' + (s.diastolic || 0)
          if (!localKeys.has(key)) {
            local.push({ s: s.systolic, d: s.diastolic, date: s.date || '' })
            changed = true
          }
        }
        localStorage.setItem('diamerna_bp', JSON.stringify(local))
      } catch {}
    }

    /* Contractions */
    if (Array.isArray(serverData.contractions) && serverData.contractions.length) {
      try {
        let local = JSON.parse(localStorage.getItem('diamerna_contractions') || '[]')
        const localKeys = new Set(local.map(x => (x.start || '') + '_' + (x.duration || 0)))
        for (const s of serverData.contractions) {
          const key = (s.start_time || '') + '_' + (s.duration_sec || 0)
          if (!localKeys.has(key)) {
            local.push({ start: s.start_time, end: s.end_time, duration: s.duration_sec, date: s.date || '' })
            changed = true
          }
        }
        localStorage.setItem('diamerna_contractions', JSON.stringify(local))
      } catch {}
    }

    /* Glucose */
    if (Array.isArray(serverData.glucose) && serverData.glucose.length) {
      try {
        let local = JSON.parse(localStorage.getItem('diamerna_glucose') || '[]')
        const localKeys = new Set(local.map(x => (x.date || x.time || '') + '_' + (x.value || x.v || 0)))
        for (const s of serverData.glucose) {
          const key = (s.date || '') + '_' + (s.value || 0)
          if (!localKeys.has(key)) {
            local.push({ value: s.value, meal_type: s.meal_type || '', v: s.value, meal: s.meal_type || '', notes: s.notes || '', date: s.date || '', time: s.date || '' })
            changed = true
          }
        }
        localStorage.setItem('diamerna_glucose', JSON.stringify(local))
      } catch {}
    }

    /* Baby Growth */
    if (Array.isArray(serverData.babyGrowth) && serverData.babyGrowth.length) {
      try {
        let local = JSON.parse(localStorage.getItem('diamerna_baby_growth') || '[]')
        const localKeys = new Set(local.map(x => (x.week || 0) + '_' + (x.weight || 0)))
        for (const s of serverData.babyGrowth) {
          const key = (s.week || 0) + '_' + (s.weight || 0)
          if (!localKeys.has(key)) {
            local.push({ week: s.week, weight: s.weight, height: s.height, notes: s.notes || '', date: s.date || '' })
            changed = true
          }
        }
        localStorage.setItem('diamerna_baby_growth', JSON.stringify(local))
      } catch {}
    }

    return changed
  }

  /* === Push local data to server === */
  async function pushToServer() {
    const token = getToken()
    if (!token) return false
    const data = collectLocalData()
    const hasData = data.weight.length || data.bp.length || data.contractions.length || data.glucose.length || data.babyGrowth.length
    if (!hasData) return false

    try {
      const r = await fetch(apiUrl('/api/sync/push-all'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(data)
      })
      if (!r.ok) throw new Error('Push failed')
      return true
    } catch (e) {
      console.warn('Sync push failed:', e.message)
      return false
    }
  }

  /* === Pull server data to local === */
  async function pullFromServer() {
    const token = getToken()
    if (!token) return false

    try {
      const r = await fetch(apiUrl('/api/sync/pull-all'), {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!r.ok) throw new Error('Pull failed')
      const data = await r.json()
      return mergeToLocal(data)
    } catch (e) {
      console.warn('Sync pull failed:', e.message)
      return false
    }
  }

  /* === Full sync (push + pull) === */
  async function fullSync() {
    const pushed = await pushToServer()
    const pulled = await pullFromServer()
    if (pushed || pulled) {
      /* Trigger UI refresh if page has these functions */
      if (window.renderWeightChart && typeof window.renderWeightChart === 'function') window.renderWeightChart()
      if (window.renderBPChart && typeof window.renderBPChart === 'function') window.renderBPChart()
      if (window.renderContractions && typeof window.renderContractions === 'function') window.renderContractions()
    }
    return { pushed, pulled }
  }

  /* === Manual sync button in sidebar === */
  function addSyncButton() {
    const sidebar = document.querySelector('.sidebar-nav') || document.querySelector('.nav-links') || document.querySelector('[class*="sidebar"]')
    if (!sidebar) return
    const btn = document.createElement('button')
    btn.id = 'syncBtn'
    btn.innerHTML = '🔄 Sync'
    btn.style.cssText = 'width:100%;padding:10px 14px;margin-top:8px;border:1px solid var(--border-h);border-radius:12px;background:var(--surface);color:var(--text);font-size:.8rem;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .3s'
    btn.onmouseenter = () => { btn.style.borderColor = 'var(--mint)' }
    btn.onmouseleave = () => { btn.style.borderColor = 'var(--border-h)' }
    btn.onclick = async function () {
      btn.innerHTML = '⏳ Syncing...'
      btn.disabled = true
      const result = await fullSync()
      btn.innerHTML = result.pushed || result.pulled ? '✅ Synced' : '🔄 Sync'
      btn.disabled = false
      if (result.pushed || result.pulled) {
        setTimeout(() => { btn.innerHTML = '🔄 Sync' }, 3000)
      }
    }
    sidebar.appendChild(btn)
  }

  /* === Public API === */
  window.diamernaSync = {
    push: pushToServer,
    pull: pullFromServer,
    sync: fullSync,
    collect: collectLocalData
  }

  /* === Auto-sync on login === */
  document.addEventListener('DOMContentLoaded', function () {
    /* Pull from server on page load if logged in */
    const token = getToken()
    if (token) {
      setTimeout(pullFromServer, 2000)
    }

    addSyncButton()

    /* Periodic background sync */
    if (syncTimer) clearInterval(syncTimer)
    syncTimer = setInterval(() => {
      if (getToken()) fullSync()
    }, SYNC_INTERVAL)
  })

  console.log('🔄 Sync engine loaded — all platforms share same data')
})()
