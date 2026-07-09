/* Glucose Logger Module */
(function () {
  const inp = document.getElementById('gInp')
  const btn = document.getElementById('gBtn')
  const tmBtns = document.querySelectorAll('.tm-btn')
  let activeTiming = 'fasting'

  tmBtns.forEach(b => b.addEventListener('click', () => {
    tmBtns.forEach(x => x.classList.remove('active'))
    b.classList.add('active'); activeTiming = b.dataset.t
  }))

  btn.addEventListener('click', () => {
    const val = parseFloat(inp.value)
    if (!val || val <= 0 || val > 500) { inp.focus(); return }
    Store.push('glucose', { val, date: today(), time: now(), label: activeTiming })
    inp.value = ''; inp.focus()
    renderGlucose()
  })

  inp.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click() })

  /* Range buttons */
  let range = 7
  document.querySelectorAll('.range-btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.range-btn').forEach(x => x.classList.remove('active'))
    b.classList.add('active')
    range = b.dataset.r === 'all' ? 'all' : parseInt(b.dataset.r)
    renderGlucose()
  }))

  /* Emergency card */
  function checkEmergency(r) {
    const card = document.getElementById('emergencyCard')
    if (!card) return
    const recent = (r || Store.get('glucose', [])).slice(-5)
    const hasLow = recent.some(g => g.val < 70)
    card.style.display = hasLow ? 'block' : 'none'
  }

  function renderGlucose() {
    const readings = Store.get('glucose', [])
    const recent = [...readings].reverse().slice(0, 10)

    drawGlucoseChart('gChart', readings, range)
    const stats = timeInRange(readings)
    const statsEl = document.getElementById('gStats')
    statsEl.innerHTML = `
      <div class="stat-box"><div class="stat-val c-mint">${stats.normal}%</div><div class="stat-lbl">Normal</div></div>
      <div class="stat-box"><div class="stat-val c-pink">${stats.high}%</div><div class="stat-lbl">High</div></div>
      <div class="stat-box"><div class="stat-val" style="color:${stats.low > 0 ? 'var(--warn)' : 'var(--text)'}">${stats.low}%</div><div class="stat-lbl">Low</div></div>
      <div class="stat-box"><div class="stat-val">${stats.avg}</div><div class="stat-lbl">Avg</div></div>
      <div class="stat-box"><div class="stat-val">${stats.total}</div><div class="stat-lbl">Readings</div></div>
      <div class="stat-box"><div class="stat-val c-lav">${stats.highCount}</div><div class="stat-lbl">Highs</div></div>
    `

    /* Recent entries as log */
    const logContainer = document.getElementById('gLog')
    if (logContainer) {
      if (!recent.length) { logContainer.innerHTML = '<div class="empty-state">No readings logged yet</div>' }
      else {
        logContainer.innerHTML = recent.map(r => {
          const cls = r.val < 70 ? 'high' : r.val > 140 ? 'high' : ''
          return `<div class="g-entry ${cls}">
            <div><span class="g-val">${r.val}</span><span class="g-unit"> mg/dL</span></div>
            <div><span class="g-timing">${GLUCOSE_LABELS[r.label] || r.label}</span><span class="g-time"> · ${r.time}</span></div>
          </div>`
        }).join('')
      }
    }

    checkEmergency(readings)
    generateAIInsight(readings)
  }

  async function generateAIInsight(readings) {
    const el = document.getElementById('gAIinsight')
    if (!el) return
    const recent = readings.slice(-20)
    if (recent.length < 3) { el.textContent = 'Log at least 3 readings to get AI-powered pattern detection.'; return }

    try {
      const stats = timeInRange(readings)
      const lastVal = recent[recent.length - 1]?.val
      let advice = ''
      if (lastVal < 70) { advice = 'Your latest reading is LOW. Eat 15g fast-acting carbs (glucose tabs, fruit juice, honey) and re-check in 15 min. If severe symptoms, call your doctor immediately.' }
      else if (lastVal > 140) { advice = 'Your latest reading is HIGH. Drink water, take a short walk, and avoid high-carb foods at your next meal. Re-check in 1 hour. Contact your doctor if it stays high.' }
      else { advice = 'Your latest reading is NORMAL. You\'re doing well! Keep up the good routine.' }
      const prompt = `You are a gestational diabetes assistant. ${advice} Analyze these blood glucose readings and give ONE short insight (1-2 sentences) about patterns, risks, or encouragement. Address the user as "you". Readings (recent ${recent.length}): ${recent.slice(-10).map(r => r.val + ' ' + (GLUCOSE_LABELS[r.label]||r.label) + ' ' + r.date).join(', ')}. Stats: avg ${stats.avg}, ${stats.normal}% normal, ${stats.high}% high, ${stats.low}% low. Keep it concise and caring.`
      const res = await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
        body: JSON.stringify({ model: API_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 120 })
      })
      const data = await res.json()
      el.textContent = data.choices?.[0]?.message?.content?.trim() || 'Unable to generate insight right now.'
    } catch { el.textContent = 'AI insight unavailable.' }
  }

  renderGlucose()
  window.renderGlucose = renderGlucose
})()
