/* Health Tracker Module */
(function () {

  /* ----- Medications (built-in + custom) ----- */
  function allMeds() {
    return [...MEDICATIONS, ...Store.get('customMeds', [])]
  }

  /* Auto-reset meds on new day */
  const medDate = Store.get('medDate', '')
  if (medDate !== today()) { Store.set('medState', {}); Store.set('medDate', today()) }

  function renderMeds() {
    const list = document.getElementById('medList')
    const todayKey = today()
    const medState = Store.get('medState', {})
    const meds = allMeds()

    if (!meds.length) { list.innerHTML = '<div class="empty-state">No medications. Add one below.</div>'; return }

    list.innerHTML = meds.map((m, i) => {
      const key = todayKey + '_' + i
      const state = medState[key] || ''
      const dotColor = m.color || '#ff6b9d'
      const isCustom = i >= MEDICATIONS.length
      return `<div class="med-item">
        <span class="med-dot" style="background:${dotColor}"></span>
        <span class="med-label"><strong>${m.name}</strong> <span class="text-xs text-gray-500">${m.dose || ''}${m.time ? ' · ' + m.time : ''}</span>${isCustom ? ' <span class="text-[9px] c-lav">(custom)</span>' : ''}</span>
        <button class="med-btn ${state === 'taken' ? 'taken' : ''}" data-i="${i}" data-a="taken">✓</button>
        <button class="med-btn ${state === 'missed' ? 'missed' : ''}" data-i="${i}" data-a="missed">✕</button>
        ${isCustom ? `<button class="med-btn" data-i="${i}" data-a="del">🗑</button>` : ''}
      </div>`
    }).join('')

    const total = meds.length
    let taken = 0
    Object.entries(medState).forEach(([k, v]) => {
      if (k.startsWith(todayKey) && v === 'taken') taken++
    })
    const pct = total ? Math.round(taken / total * 100) : 0
    document.getElementById('medPct').textContent = `${pct}% completed today`
    let bar = document.querySelector('.med-pct-fill')
    if (!bar) {
      const pbar = document.querySelector('.med-pct-bar')
      if (pbar) { bar = document.createElement('div'); bar.className = 'med-pct-fill'; pbar.appendChild(bar) }
    }
    if (bar) bar.style.width = pct + '%'
  }

  document.getElementById('medResetBtn').addEventListener('click', () => {
    if (confirm('Reset all medications for today?')) { Store.set('medState', {}); renderMeds() }
  })

  document.getElementById('medList').addEventListener('click', e => {
    const btn = e.target.closest('.med-btn')
    if (!btn) return
    const i = parseInt(btn.dataset.i); const action = btn.dataset.a
    if (isNaN(i)) return

    if (action === 'del') {
      const custom = Store.get('customMeds', [])
      const ci = i - MEDICATIONS.length
      if (ci >= 0 && ci < custom.length) {
        custom.splice(ci, 1)
        Store.set('customMeds', custom)
        renderMeds()
      }
      return
    }

    const todayKey = today() + '_' + i
    const medState = Store.get('medState', {})
    medState[todayKey] = medState[todayKey] === action ? '' : action
    Store.set('medState', medState)
    renderMeds()
  })

  /* Add custom medication */
  document.getElementById('medAddBtn')?.addEventListener('click', () => {
    const n = document.getElementById('medNewName')?.value?.trim()
    const d = document.getElementById('medNewDose')?.value?.trim()
    const t = document.getElementById('medNewTime')?.value?.trim()
    if (!n) return
    const custom = Store.get('customMeds', [])
    custom.push({ name: n, dose: d || '', time: t || '', color: '#b388ff' })
    Store.set('customMeds', custom)
    document.getElementById('medNewName').value = ''
    document.getElementById('medNewDose').value = ''
    document.getElementById('medNewTime').value = ''
    renderMeds()
  })

  /* ----- Sleep & Stress ----- */
  let sleepVal = 0
  let stressVal = 0

  document.getElementById('sleepStars').addEventListener('click', e => {
    const star = e.target.closest('.sleep-star')
    if (!star) return
    sleepVal = parseInt(star.dataset.v)
    document.querySelectorAll('.sleep-star').forEach(s => {
      const v = parseInt(s.dataset.v)
      s.classList.toggle('active', v <= sleepVal)
      s.classList.toggle('inactive', v > sleepVal)
    })
  })

  document.getElementById('sleepStars').innerHTML = [1,2,3,4,5].map(i =>
    `<span class="sleep-star inactive" data-v="${i}">★</span>`
  ).join('')

  const stressBtns = document.getElementById('stressBtns')
  stressBtns.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    stressVal = parseInt(b.dataset.v)
    stressBtns.querySelectorAll('button').forEach(x => x.classList.remove('active'))
    b.classList.add('active')
  }))

  document.getElementById('sleepLogBtn').addEventListener('click', () => {
    if (!sleepVal && !stressVal) return
    Store.push('sleepLogs', { date: today(), sleep: sleepVal || 0, stress: stressVal || 0 })
    sleepVal = 0; stressVal = 0
    document.querySelectorAll('.sleep-star').forEach(s => { s.classList.remove('active'); s.classList.add('inactive') })
    stressBtns.querySelectorAll('button').forEach(x => x.classList.remove('active'))
    renderSleepHistory()
  })

  function renderSleepHistory() {
    const logs = Store.get('sleepLogs', []).slice(-7).reverse()
    const el = document.getElementById('sleepHistory')
    if (!logs.length) { el.textContent = 'No logs yet'; return }
    el.innerHTML = '📊 Recent: ' + logs.map(l =>
      `${l.date} 😴${l.sleep || '-'} 😟${l.stress || '-'}`
    ).join(' · ')
  }

  /* ----- Smart Hydration ----- */
  let hydrated = Store.get('hydrated', 0)
  const target = 2.5

  function renderHyd() {
    document.getElementById('hydL').textContent = hydrated.toFixed(1)
    const pct = Math.min(100, (hydrated / target) * 100)
    document.getElementById('hydBar').style.width = pct + '%'
    const badges = document.getElementById('hydBadges')
    badges.innerHTML = ''
    if (hydrated >= target) badges.innerHTML = '<span class="c-mint font-bold">✨ Goal reached!</span>'
    else if (hydrated >= 2) badges.innerHTML = '<span class="c-mint">👍 Great!</span>'
    else if (hydrated >= 1) badges.innerHTML = '<span class="c-lav">👌 Halfway</span>'
    else if (hydrated >= 0.5) badges.innerHTML = '<span class="text-gray-400">💧 Keep going</span>'
  }

  document.getElementById('hydResetBtn').addEventListener('click', () => { hydrated = 0; Store.set('hydrated', 0); renderHyd() })

  document.getElementById('hydBtns').addEventListener('click', e => {
    const btn = e.target.closest('button')
    if (!btn) return
    const a = parseFloat(btn.dataset.a)
    hydrated = Math.min(target, hydrated + a)
    Store.set('hydrated', hydrated)
    renderHyd()
    /* Animate */
    btn.style.transform = 'scale(.92)'
    setTimeout(() => btn.style.transform = '', 150)
  })

  /* Reset hydration daily */
  const hydDate = Store.get('hydDate', '')
  if (hydDate !== today()) { hydrated = 0; Store.set('hydrated', 0); Store.set('hydDate', today()) }

  /* ----- Foot Check (AI-powered advice) ----- */
  document.getElementById('footChecks').addEventListener('click', async e => {
    const btn = e.target.closest('.foot-btn')
    if (!btn) return
    btn.classList.toggle('active')
    const active = document.querySelectorAll('.foot-btn.active')
    const advice = document.getElementById('footAdvice')
    if (!active.length) { advice.style.display = 'none'; return }
    const items = Array.from(active).map(b => b.textContent.trim().toLowerCase())
    advice.style.display = 'block'
    advice.innerHTML = '<span class="text-gray-500">🤖 Getting advice...</span>'
    try {
      const prompt = `You are a diabetic foot care specialist for a pregnant woman with gestational diabetes. She reports: ${items.join(', ')}. Provide ONE short sentence of advice (whether to see a doctor, self-care tips, or reassurance). Be concise and clear.`
      const res = await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
        body: JSON.stringify({ model: API_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 100 })
      })
      const data = await res.json()
      const msg = data.choices?.[0]?.message?.content?.trim()
      advice.innerHTML = msg
        ? (items.some(i => ['cuts','pain','redness'].includes(i))
          ? '⚠️ ' + msg
          : '✅ ' + msg)
        : (items.some(i => ['cuts','pain','redness'].includes(i))
          ? '<span class="c-warn">⚠️ Please contact your healthcare provider about ' + items.join(', ') + '.</span>'
          : '<span class="c-mint">✅ Monitor and rest. Elevate feet when possible.</span>')
    } catch {
      advice.innerHTML = items.some(i => ['cuts','pain','redness'].includes(i))
        ? '<span class="c-warn">⚠️ Please contact your healthcare provider about ' + items.join(', ') + '.</span>'
        : '<span class="c-mint">✅ Monitor and rest. Elevate feet when possible.</span>'
    }
  })

  renderMeds()
  renderHyd()
  renderSleepHistory()
  window.renderHealth = renderMeds
})()
