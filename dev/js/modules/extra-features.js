(function () {
  const tab = document.querySelector('.section.active')?.dataset?.tab || ''

  /* ===== WEIGHT TRACKER (health page) ===== */
  if (tab === 'health') {
    const card = document.createElement('div')
    card.className = 'card'
    card.id = 'weightCard'
    card.innerHTML = `
      <div class="card-header"><span class="c-pink">⚖️</span><h2>Weight Tracker</h2></div>
      <div class="flex items-center gap-2 mb-2">
        <input type="number" id="wtInput" class="input" placeholder="Weight (kg)" step="0.1" style="flex:1">
        <button id="wtLogBtn" class="btn-primary">Log</button>
      </div>
      <div id="wtChartArea" class="mb-2" style="height:100px"></div>
      <div id="wtHistory" class="text-xs text-gray-500"></div>
    `
    document.querySelector('.section.active').appendChild(card)

    const wtInput = document.getElementById('wtInput')
    const wtLogBtn = document.getElementById('wtLogBtn')
    const wtHistory = document.getElementById('wtHistory')
    const wtChartArea = document.getElementById('wtChartArea')

    function getWeightData() {
      try { return JSON.parse(localStorage.getItem('diamerna_weight') || '[]') } catch { return [] }
    }
    function saveWeightData(d) { localStorage.setItem('diamerna_weight', JSON.stringify(d)) }

    function renderWeightChart() {
      const data = getWeightData()
      const recent = data.slice(-14)
      if (recent.length < 2) { wtChartArea.innerHTML = '<div class="text-xs text-gray-500 mt-2">Log at least 2 entries to see trend</div>'; return }
      const vals = recent.map(x => x.w)
      const min = Math.floor(Math.min(...vals) - 1), max = Math.ceil(Math.max(...vals) + 1)
      const range = max - min || 1
      const w = 280, h = 100, pad = { t: 10, r: 10, b: 20, l: 30 }
      const xScale = (i) => pad.l + (i / (recent.length - 1)) * (w - pad.l - pad.r)
      const yScale = (v) => pad.t + (1 - (v - min) / range) * (h - pad.t - pad.b)
      let svg = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:100%">`
      svg += `<defs><linearGradient id="wtGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--pink)" stop-opacity=".3"/><stop offset="100%" stop-color="var(--pink)" stop-opacity=".01"/></linearGradient></defs>`
      let pts = recent.map((d, i) => `${xScale(i)},${yScale(d.w)}`).join(' ')
      let areaPts = `${pad.l},${h - pad.b} ${pts} ${xScale(recent.length-1)},${h - pad.b}`
      svg += `<polygon points="${areaPts}" fill="url(#wtGrad)"/>`
      svg += `<polyline points="${pts}" fill="none" stroke="var(--pink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
      recent.forEach((d, i) => {
        svg += `<circle cx="${xScale(i)}" cy="${yScale(d.w)}" r="3" fill="var(--pink)"><title>${d.w} kg — ${d.date}</title></circle>`
      })
      svg += `<line x1="${pad.l}" y1="${h - pad.b}" x2="${w - pad.r}" y2="${h - pad.b}" stroke="var(--border)" stroke-width="1"/>`
      svg += `</svg>`
      wtChartArea.innerHTML = svg
    }

    function renderWeightHistory() {
      const data = getWeightData()
      const recent = data.slice(-10).reverse()
      if (!recent.length) { wtHistory.textContent = 'No weight entries yet'; return }
      wtHistory.innerHTML = recent.map(d =>
        `<div class="flex justify-between items-center py-1 border-b" style="border-color:var(--border)"><span class="c-pink font-semibold">${d.w} kg</span><span class="text-gray-500">${d.date}</span></div>`
      ).join('')
    }

    wtLogBtn.addEventListener('click', () => {
      const v = parseFloat(wtInput.value)
      if (!v || v < 20 || v > 250) { return }
      const data = getWeightData()
      data.push({ w: v, date: new Date().toLocaleDateString() })
      saveWeightData(data)
      wtInput.value = ''
      renderWeightChart()
      renderWeightHistory()
    })
    wtInput.addEventListener('keydown', e => { if (e.key === 'Enter') wtLogBtn.click() })

    renderWeightChart()
    renderWeightHistory()
  }

  /* ===== BLOOD PRESSURE TRACKER (health page) ===== */
  if (tab === 'health') {
    const card = document.createElement('div')
    card.className = 'card'
    card.id = 'bpCard'
    card.innerHTML = `
      <div class="card-header"><span class="c-warn">❤️</span><h2>Blood Pressure</h2></div>
      <div class="flex items-center gap-2 mb-2">
        <input type="number" id="bpSystolic" class="input" placeholder="Systolic" style="flex:1" min="60" max="250">
        <span class="text-xs text-gray-500">/</span>
        <input type="number" id="bpDiastolic" class="input" placeholder="Diastolic" style="flex:1" min="30" max="180">
        <button id="bpLogBtn" class="btn-primary">Log</button>
      </div>
      <div id="bpStatus" class="text-xs mb-2"></div>
      <div id="bpHistory" class="text-xs text-gray-500"></div>
    `
    document.querySelector('.section.active').appendChild(card)

    const bpSys = document.getElementById('bpSystolic')
    const bpDia = document.getElementById('bpDiastolic')
    const bpLog = document.getElementById('bpLogBtn')
    const bpStatus = document.getElementById('bpStatus')
    const bpHistory = document.getElementById('bpHistory')

    function getBP() {
      try { return JSON.parse(localStorage.getItem('diamerna_bp') || '[]') } catch { return [] }
    }
    function saveBP(d) { localStorage.setItem('diamerna_bp', JSON.stringify(d)) }

    function bpCategory(s, d) {
      if (s >= 180 || d >= 120) return { label: 'Hypertensive Crisis', color: 'var(--warn)', urgent: true }
      if (s >= 140 || d >= 90) return { label: 'Stage 2 Hypertension', color: 'var(--warn)', urgent: false }
      if (s >= 130 || d >= 80) return { label: 'Stage 1 Hypertension', color: '#ff9800', urgent: false }
      if (s >= 120 && s < 130 && d < 80) return { label: 'Elevated', color: '#ff9800', urgent: false }
      return { label: 'Normal', color: 'var(--mint)', urgent: false }
    }

    function renderBPHistory() {
      const data = getBP()
      const recent = data.slice(-8).reverse()
      if (!recent.length) { bpHistory.textContent = 'No readings yet'; return }
      bpHistory.innerHTML = recent.map(r => {
        const cat = bpCategory(r.s, r.d)
        return `<div class="flex justify-between items-center py-1 border-b" style="border-color:var(--border)">
          <span><span class="font-semibold" style="color:${cat.color}">${r.s}/${r.d}</span> <span class="text-gray-500">${cat.label}</span></span>
          <span class="text-gray-500">${r.date}</span>
        </div>`
      }).join('')
    }

    bpLog.addEventListener('click', () => {
      const s = parseInt(bpSys.value), d = parseInt(bpDia.value)
      if (!s || !d || s < 60 || s > 250 || d < 30 || d > 180) { return }
      const cat = bpCategory(s, d)
      bpStatus.innerHTML = `<span style="color:${cat.color}">${cat.label}</span>`
      if (cat.urgent) bpStatus.innerHTML += ' <span class="c-warn">⚠️ Contact your doctor immediately</span>'
      const data = getBP()
      data.push({ s, d, date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
      saveBP(data)
      bpSys.value = ''; bpDia.value = ''
      renderBPHistory()
    })
    bpDia.addEventListener('keydown', e => { if (e.key === 'Enter') bpLog.click() })

    renderBPHistory()
  }

  /* ===== CONTRACTION TIMER (baby page) ===== */
  if (tab === 'baby') {
    const card = document.createElement('div')
    card.className = 'card'
    card.id = 'contractionCard'
    card.innerHTML = `
      <div class="card-header"><span class="c-lav">⏱️</span><h2>Contraction Timer</h2></div>
      <div class="text-center mb-2">
        <div id="ctTimer" style="font-size:2.5rem;font-weight:800;font-variant-numeric:tabular-nums;background:linear-gradient(135deg,var(--pink),var(--lav));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">00:00</div>
        <div class="text-xs text-gray-500 mb-2" id="ctStatus">Tap Start when contraction begins</div>
        <div class="flex gap-2 justify-center">
          <button id="ctStartBtn" class="btn-primary">▶ Start</button>
          <button id="ctStopBtn" class="btn-secondary" disabled>⏹ Stop</button>
          <button id="ctResetBtn" class="btn-secondary">↺ Reset</button>
        </div>
      </div>
      <div id="ctLog" class="text-xs text-gray-500 mt-2"></div>
    `
    document.querySelector('.section.active')?.appendChild(card)

    let ctRunning = false, ctStart = 0, ctTimerId = null, ctElapsed = 0
    const ctTimer = document.getElementById('ctTimer')
    const ctStatus = document.getElementById('ctStatus')
    const ctStartBtn = document.getElementById('ctStartBtn')
    const ctStopBtn = document.getElementById('ctStopBtn')
    const ctLog = document.getElementById('ctLog')

    function getCT() {
      try { return JSON.parse(localStorage.getItem('diamerna_ct') || '[]') } catch { return [] }
    }
    function saveCT(d) { localStorage.setItem('diamerna_ct', JSON.stringify(d)) }

    function ctUpdateDisplay() {
      const sec = Math.floor(ctElapsed / 1000)
      const m = Math.floor(sec / 60), s = sec % 60
      ctTimer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }

    function ctRenderLog() {
      const data = getCT()
      const recent = data.slice(-10).reverse()
      if (!recent.length) { ctLog.textContent = 'No contractions logged'; return }
      ctLog.innerHTML = recent.map((c, i) => {
        const dur = c.duration ? Math.floor(c.duration / 1000) + 's' : '—'
        return `<div class="flex justify-between py-1 border-b" style="border-color:var(--border)"><span>#${data.length - i} — ${dur}</span><span class="text-gray-500">${c.time || ''}</span></div>`
      }).join('')
    }

    ctStartBtn.addEventListener('click', () => {
      if (ctRunning) return
      ctRunning = true
      ctStart = Date.now()
      ctStartBtn.disabled = true
      ctStopBtn.disabled = false
      ctStatus.textContent = '⏳ Contraction in progress...'
      ctTimerId = setInterval(() => {
        ctElapsed = Date.now() - ctStart
        ctUpdateDisplay()
      }, 100)
    })

    ctStopBtn.addEventListener('click', () => {
      if (!ctRunning) return
      ctRunning = false
      clearInterval(ctTimerId)
      const dur = Date.now() - ctStart
      const data = getCT()
      data.push({ start: new Date(ctStart).toISOString(), duration: dur, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
      saveCT(data)
      ctStartBtn.disabled = false
      ctStopBtn.disabled = true
      ctStatus.textContent = '✅ Contraction logged. Tap Start when next begins.'
      ctElapsed = 0
      ctUpdateDisplay()
      ctRenderLog()
    })

    ctResetBtn.addEventListener('click', () => {
      if (ctRunning) {
        clearInterval(ctTimerId)
        ctRunning = false
        ctStartBtn.disabled = false
        ctStopBtn.disabled = true
      }
      ctElapsed = 0
      ctUpdateDisplay()
      ctStatus.textContent = 'Tap Start when contraction begins'
    })

    ctRenderLog()
  }

  /* ===== HOSPITAL BAG CHECKLIST (baby page) ===== */
  if (tab === 'baby') {
    const card = document.createElement('div')
    card.className = 'card'
    card.id = 'hospitalBagCard'
    const items = [
      { cat: '📄 Documents', list: ['ID proof', 'Insurance card', 'Medical reports', 'Hospital registration'] },
      { cat: '👚 For Mom', list: ['Maternity gowns (2-3)', 'Nursing bra', 'Slippers with grip', 'Toiletries kit', 'Phone charger', 'Water bottle', 'Snacks (dates, nuts)', 'Pillow'] },
      { cat: '👶 For Baby', list: ['Onesies (3-4)', 'Swaddle blanket', 'Diapers (10-15)', 'Wipes', 'Baby hat & socks', 'Nipple cream', 'Baby oil & lotion'] }
    ]
    card.innerHTML = `
      <div class="card-header"><span class="c-mint">🧳</span><h2>Hospital Bag Checklist</h2></div>
      ${items.map(g => `
        <div class="mb-2">
          <div class="text-xs font-semibold mb-1" style="color:var(--lav)">${g.cat}</div>
          ${g.list.map(item => {
            const key = 'hb_' + item.toLowerCase().replace(/\s+/g, '_')
            const checked = localStorage.getItem('diamerna_' + key) === 'true'
            return `<label class="chk-item mb-1" style="padding:8px 12px;font-size:.8rem">
              <input type="checkbox" ${checked ? 'checked' : ''} data-key="${key}">
              <span>${item}</span>
            </label>`
          }).join('')}
        </div>
      `).join('')}
      <button id="hbResetBtn" class="btn-secondary text-xs" style="width:100%">↺ Reset All</button>
    `
    document.querySelector('.section.active').appendChild(card)

    card.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        localStorage.setItem('diamerna_' + cb.dataset.key, cb.checked)
      })
    })
    document.getElementById('hbResetBtn').addEventListener('click', () => {
      if (confirm('Reset all checklist items?')) {
        card.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = false
          localStorage.removeItem('diamerna_' + cb.dataset.key)
        })
      }
    })
  }

  /* ===== SIDEBAR NAV UPDATES ===== */
  if (tab === 'baby') {
    const el = document.querySelector('#sidebarNav a[href*="baby.html"]')
    if (el) {
      const badge = document.createElement('span')
      badge.className = 'badge'
      badge.textContent = '4'
      badge.style.cssText = 'margin-left:auto;font-size:9px;min-width:18px;height:18px'
      el.appendChild(badge)
    }
  }
  if (tab === 'health') {
    const el = document.querySelector('#sidebarNav a[href*="health.html"]')
    if (el) {
      const badge = document.createElement('span')
      badge.className = 'badge'
      badge.textContent = '6'
      badge.style.cssText = 'margin-left:auto;font-size:9px;min-width:18px;height:18px'
      el.appendChild(badge)
    }
  }
})()
