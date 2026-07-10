/* More Menu Module */
(function () {

  /* ----- Symptom Checker (AI) — Pre-defined + Temperature + Custom ----- */
  const SYMPTOM_OPTIONS = [
    {id:'headache', label:'Headache', emoji:'🤕'},
    {id:'blurred', label:'Blurred Vision', emoji:'👁️'},
    {id:'nausea', label:'Nausea', emoji:'🤢'},
    {id:'fatigue', label:'Fatigue', emoji:'😴'},
    {id:'swelling', label:'Swelling (Feet/Hands)', emoji:'🦶'},
    {id:'dizziness', label:'Dizziness', emoji:'😵'},
    {id:'thirst', label:'Excessive Thirst', emoji:'💧'},
    {id:'numbness', label:'Numbness/Tingling', emoji:'❄️'},
    {id:'vomiting', label:'Vomiting', emoji:'🤮'},
    {id:'pain', label:'Abdominal Pain', emoji:'💢'}
  ]

  const sympBtns = document.getElementById('sympBtns')
  SYMPTOM_OPTIONS.forEach(s => {
    const btn = document.createElement('button')
    btn.className = 'symp-btn'
    btn.dataset.symp = s.id
    btn.textContent = s.emoji + ' ' + s.label
    btn.addEventListener('click', () => btn.classList.toggle('active'))
    sympBtns.appendChild(btn)
  })

  document.getElementById('sympAnalyzeBtn').addEventListener('click', async () => {
    const sel = Array.from(document.querySelectorAll('#sympBtns .symp-btn.active')).map(b => b.textContent.trim())
    const custom = document.getElementById('sympCustom').value.trim()
    const temp = document.getElementById('sympTemp').value.trim()
    const result = document.getElementById('sympResult')

    if (!sel.length && !custom) {
      result.style.display = 'block'
      result.innerHTML = '<span class="c-warn">Please select symptoms or describe other symptoms.</span>'
      return
    }
    result.style.display = 'block'
    result.innerHTML = '<span class="text-gray-500">🤖 Analyzing with AI...</span>'

    let symptomsText = sel.join(', ')
    if (custom) symptomsText += (symptomsText ? '; also: ' : '') + custom
    if (temp) symptomsText += ` (Temperature: ${temp}°C)`

    const includeGlucose = document.getElementById('sympIncludeGlucose')?.checked
    const includeMeds = document.getElementById('sympIncludeMeds')?.checked

    let context = ''
    if (includeGlucose) {
      const glucose = Store.get('glucose', []).slice(-15)
      if (glucose.length) {
        const stats = timeInRange(glucose)
        context += `\nGlucose (last ${glucose.length}): avg ${stats.avg}, ${stats.normal}% normal, ${stats.high}% high, ${stats.low}% low.`
        context += ` Latest: ${glucose.slice(-3).map(g => g.val + (GLUCOSE_LABELS[g.label]||'')).join(', ')}.`
      }
    }
    if (includeMeds) {
      const medState = Store.get('medState', {})
      const todayKey = today()
      const taken = MEDICATIONS.map((m, i) => ({ name: m.name, taken: medState[todayKey + '_' + i] === 'taken' }))
      if (taken.length) context += `\nMeds: ${taken.map(m => m.name + '(' + (m.taken ? 'taken' : 'missed') + ')').join(', ')}.`
    }

    try {
      const prompt = `You are a medical AI assistant for pregnancy/gestational diabetes. A pregnant woman reports: "${symptomsText}".${context ? ' Health data:' + context : ''} Give a SHORT, direct answer (2-3 sentences max). Identify if she needs urgent care, an appointment, or home monitoring. Be concise and clear.`
      const res = await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
        body: JSON.stringify({ model: API_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 350 })
      })
      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content?.trim() || 'Unable to analyze.'
      result.innerHTML = '<div class="c-lav font-semibold mb-1">🤖 Assessment</div><div class="text-gray-300 whitespace-pre-line" style="font-size:13px">' + reply + '</div>'
    } catch {
      result.innerHTML = '<span class="c-warn">AI unavailable. For serious symptoms, contact your doctor immediately.</span>'
    }
  })

  /* ----- Doctor Visit Summary (PDF-ready) ----- */
  document.getElementById('docSummaryBtn').addEventListener('click', async () => {
    const result = document.getElementById('docSummary')
    result.innerHTML = '<span class="text-gray-500">Generating report...</span>'

    const glucose = Store.get('glucose', [])
    const stats = timeInRange(glucose)
    const g = goalProgress()
    const medState = Store.get('medState', {})
    const todayKey = today()
    const medCount = MEDICATIONS.length
    let takenCount = 0
    Object.entries(medState).forEach(([k, v]) => { if (k.startsWith(todayKey) && v === 'taken') takenCount++ })
    const sleepLogs = Store.get('sleepLogs', []).slice(-7)
    const avgSleep = sleepLogs.length ? (sleepLogs.reduce((s, l) => s + l.sleep, 0) / sleepLogs.length).toFixed(1) : '--'
    const avgStress = sleepLogs.length ? (sleepLogs.reduce((s, l) => s + l.stress, 0) / sleepLogs.length).toFixed(1) : '--'

    const data = {
      glucoseReadings: glucose.length, avgGlucose: stats.avg, timeInRange: stats.normal + '%',
      highReadings: stats.highCount, lowReadings: stats.lowCount,
      goalsMet: g.pct + '%', medsTaken: takenCount + '/' + medCount,
      avgSleep, avgStress, hydrated: Store.get('hydrated', 0) + 'L'
    }

    const profile = Store.get('profile', {})
    const name = profile.name || 'Patient'
    const lmp = profile.lmp || '--'
    const pregnant = profile.isPregnant !== false
    const dob = profile.dob || '--'
    const todayStr = today()

    let aiReport = 'Unable to generate AI report.'
    try {
      const prompt = `Create a brief doctor visit summary for a gestational diabetes patient. Data: ${JSON.stringify(data)}. 3-4 bullet points on glucose control, medication, lifestyle, concerns. Professional, concise.`
      const res = await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
        body: JSON.stringify({ model: API_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 300 })
      })
      const d = await res.json()
      if (d.choices?.[0]?.message?.content?.trim()) aiReport = d.choices[0].message.content.trim()
    } catch {}

    /* Build full report HTML */
    const reportHTML = `
      <div id="docReportContainer" style="background:white;color:#111;padding:24px 20px;border-radius:12px;font-family:'Inter',sans-serif;max-width:600px;margin:0 auto">
        <div style="text-align:center;border-bottom:2px solid #ff6b9d;padding-bottom:12px;margin-bottom:16px">
          <div style="font-size:20px;font-weight:800;background:linear-gradient(135deg,#ff6b9d,#b388ff,#69f0ae);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">🌸 DiaMerna</div>
          <div style="font-size:10px;color:#888;margin-top:2px">Maternal Wellness Report</div>
        </div>
        <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:12px">
          <tr><td style="padding:3px 6px;font-weight:600;color:#555">Patient</td><td style="padding:3px 6px">${name}</td></tr>
          <tr><td style="padding:3px 6px;font-weight:600;color:#555">Date of Birth</td><td style="padding:3px 6px">${dob}</td></tr>
          <tr><td style="padding:3px 6px;font-weight:600;color:#555">Pregnant</td><td style="padding:3px 6px">${pregnant ? 'Yes' : 'No'}</td></tr>
          <tr><td style="padding:3px 6px;font-weight:600;color:#555">LMP</td><td style="padding:3px 6px">${lmp}</td></tr>
          <tr><td style="padding:3px 6px;font-weight:600;color:#555">Report Date</td><td style="padding:3px 6px">${todayStr}</td></tr>
        </table>
        <div style="background:#f5f5f5;border-radius:8px;padding:12px;font-size:11px;margin-bottom:12px">
          <div style="font-weight:700;color:#ff6b9d;margin-bottom:6px">📊 Summary</div>
          <div>Readings: ${data.glucoseReadings} · Avg: ${data.avgGlucose} mg/dL · Time in Range: ${data.timeInRange}</div>
          <div>Highs: ${data.highReadings} · Lows: ${data.lowReadings} · Meds: ${data.medsTaken} · Goals: ${data.goalsMet}</div>
          <div>Sleep: ${data.avgSleep}h · Stress: ${data.avgStress}/10 · Hydration: ${data.hydrated}</div>
        </div>
        <div style="font-size:11px;line-height:1.6;margin-bottom:12px;white-space:pre-line">${aiReport}</div>
        <div style="font-size:9px;color:#999;border-top:1px solid #ddd;padding-top:8px;text-align:center">⚠️ AI-generated summary — may contain errors. Always consult your doctor.</div>
      </div>`

    const cloudBtn = `<button id="cloudUploadReportBtn" class="btn-primary text-sm ml-2">☁️ Upload to Cloud</button>`
    result.innerHTML = reportHTML + '<div class="mt-3 text-center no-print flex justify-center gap-2 flex-wrap"><button id="printReportBtn" class="btn-primary text-sm">🖨️ Print / Save as PDF</button>' + cloudBtn + '</div>'
    setTimeout(() => {
      document.getElementById('cloudUploadReportBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('cloudUploadReportBtn')
        btn.textContent = '☁️ Uploading...'
        const token = Store.get('authToken', '')
        if (!token) { btn.textContent = '☁️ Login required'; return }
        const provider = 'dropbox'
        const reportText = document.getElementById('docReportContainer')?.innerText || 'DiaMerna Report'
        try {
          const r = await fetch('/api/cloud/upload', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ provider, fileName: 'DiaMerna_Report_' + today() + '.txt', content: reportText })
          })
          const d = await r.json()
          if (d.publicUrl) { btn.innerHTML = '☁️ <a href="' + d.publicUrl + '" target="_blank" style="color:var(--mint);text-decoration:underline">View on Cloud</a>' }
          else { btn.textContent = '☁️ Uploaded' }
        } catch { btn.textContent = '☁️ Upload failed' }
      })
      document.getElementById('printReportBtn')?.addEventListener('click', () => {
      const w = window.open('', '_blank', 'width=600,height=800')
      w.document.write('<html><head><title>DiaMerna Report</title><style>body{font-family:Inter,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse;font-size:11px}td{padding:3px 6px}td:first-child{font-weight:600;color:#555}.header{text-align:center;border-bottom:2px solid #ff6b9d;padding-bottom:12px;margin-bottom:16px}.header h1{font-size:20px;font-weight:800;background:linear-gradient(135deg,#ff6b9d,#b388ff,#69f0ae);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:0}.header p{font-size:10px;color:#888;margin:2px 0 0}.summary{background:#f5f5f5;border-radius:8px;padding:12px;font-size:11px;margin-bottom:12px}.summary h3{font-weight:700;color:#ff6b9d;margin:0 0 6px}.report{font-size:11px;line-height:1.6;margin-bottom:12px;white-space:pre-line}.footer{font-size:9px;color:#999;border-top:1px solid #ddd;padding-top:8px;text-align:center}@media print{body{padding:0}}<\/style></head><body>')
      w.document.write(document.getElementById('docReportContainer').outerHTML)
      w.document.write('</body></html>')
      w.document.close()
      setTimeout(() => { w.focus(); w.print(); w.close() }, 300)
      })
    }, 100)
  })

  /* ----- Report Upload & AI Analysis ----- */
  const uploadBtn = document.getElementById('uploadReportBtn')
  const reportFile = document.getElementById('reportFileInput')
  const reportPaste = document.getElementById('reportPasteInput')
  const uploadedList = document.getElementById('uploadedReports')
  const reportAnalysis = document.getElementById('reportAnalysis')

  function renderUploaded() {
    const reports = Store.get('reports', [])
    if (!reports.length) { uploadedList.innerHTML = ''; return }
    uploadedList.innerHTML = reports.map((r, i) =>
      `<div class="flex items-center justify-between p-2 rounded-lg" style="background:var(--surface);border:1px solid var(--border);font-size:11px">
        <span>📄 ${r.name} <span class="text-gray-500">(${r.date})</span></span>
        <button class="text-xs c-warn" style="background:none;border:none;cursor:pointer" data-ridx="${i}">✕</button>
      </div>`
    ).join('')
    uploadedList.querySelectorAll('[data-ridx]').forEach(b => {
      b.addEventListener('click', () => {
        const reports = Store.get('reports', [])
        reports.splice(parseInt(b.dataset.ridx), 1)
        Store.set('reports', reports)
        renderUploaded()
      })
    })
  }

  uploadBtn.addEventListener('click', async () => {
    const pasted = reportPaste.value.trim()
    const files = reportFile.files
    if (!pasted && (!files || !files.length)) {
      reportAnalysis.style.display = 'block'
      reportAnalysis.innerHTML = '<span class="c-warn">Upload a file or paste report text.</span>'
      return
    }
    reportAnalysis.style.display = 'block'
    reportAnalysis.innerHTML = '<span class="text-gray-500">📤 Processing...</span>'
    let allText = pasted
    const fileNames = []
    if (files && files.length) {
      for (const f of files) {
        fileNames.push(f.name)
        if (f.name.endsWith('.txt') || f.name.endsWith('.csv')) {
          allText += (allText ? '\n\n--- ' + f.name + ' ---\n' : '') + await f.text()
        } else {
          allText += (allText ? '\n\n--- ' + f.name + ' (binary file, content not readable) ---' : '')
        }
      }
    }
    if (pasted) Store.push('reports', { name: 'Pasted text', content: pasted.slice(0, 200), date: today() })
    fileNames.forEach(n => Store.push('reports', { name: n, content: allText.slice(0, 200), date: today() }))
    renderUploaded()
    reportPaste.value = ''; reportFile.value = ''
    try {
      const prompt = `You are a medical data analyst for gestational diabetes. Analyze these reports and provide a concise summary of key findings, abnormal values, and recommendations. Keep it short and direct. Reports:\n${allText.slice(0, 2000)}`
      const res = await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
        body: JSON.stringify({ model: API_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 300 })
      })
      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content?.trim() || 'Could not analyze.'
      reportAnalysis.innerHTML = '<div class="c-lav font-semibold mb-1">📋 Analysis</div><div class="text-gray-300 whitespace-pre-line" style="font-size:13px">' + reply + '</div>'
    } catch {
      reportAnalysis.innerHTML = '<span class="c-warn">AI analysis unavailable.</span>'
    }
  })
  renderUploaded()

  /* ===== Profile Editing ===== */
  async function loadProfile() {
    const token = Store.get('authToken', '')
    if (!token) return
    try {
      const r = await fetch('/api/profile', { headers: { 'Authorization': 'Bearer ' + token } })
      const d = await r.json()
      if (!d.profile) return
      const p = d.profile
      document.getElementById('profName').textContent = p.name || '—'
      document.getElementById('profDob').textContent = p.dob || '—'
      document.getElementById('profLmp').textContent = p.lmp || '—'
      document.getElementById('profPreg').textContent = p.is_pregnant ? '✅ Yes' : '❌ No'
      document.getElementById('profCycle').textContent = p.cycle_length || '—'
      document.getElementById('profGoal').textContent = p.health_goal ? p.health_goal.replace(/-/g, ' ') : '—'
    } catch {}
  }
  loadProfile()

  document.getElementById('profileEditBtn')?.addEventListener('click', () => {
    document.getElementById('profileEditForm').style.display = 'block'
    document.getElementById('profEditName').value = document.getElementById('profName').textContent === '—' ? '' : document.getElementById('profName').textContent
    document.getElementById('profEditDob').value = document.getElementById('profDob').textContent === '—' ? '' : document.getElementById('profDob').textContent
    document.getElementById('profEditLmp').value = document.getElementById('profLmp').textContent === '—' ? '' : document.getElementById('profLmp').textContent
    document.getElementById('profEditPreg').checked = document.getElementById('profPreg').textContent === '✅ Yes'
    document.getElementById('profEditCycle').value = document.getElementById('profCycle').textContent === '—' ? 28 : parseInt(document.getElementById('profCycle').textContent)
    const goalText = document.getElementById('profGoal').textContent
    const goalVal = goalText === '—' ? 'general-wellness' : goalText.replace(/\s+/g, '-').toLowerCase()
    ;[...document.getElementById('profEditGoal').options].some(o => { if (o.value === goalVal || o.text.includes(goalText)) { o.selected = true; return true } })
  })

  document.getElementById('profCancelBtn')?.addEventListener('click', () => {
    document.getElementById('profileEditForm').style.display = 'none'
    document.getElementById('profMsg').textContent = ''
  })

  document.getElementById('profSaveBtn')?.addEventListener('click', async () => {
    const token = Store.get('authToken', '')
    if (!token) { document.getElementById('profMsg').textContent = '❌ Login required'; return }
    const name = document.getElementById('profEditName').value.trim()
    if (!name) { document.getElementById('profMsg').textContent = '❌ Name is required'; return }
    const body = {
      name,
      dob: document.getElementById('profEditDob').value,
      lmp: document.getElementById('profEditLmp').value,
      is_pregnant: document.getElementById('profEditPreg').checked,
      cycle_length: parseInt(document.getElementById('profEditCycle').value) || 28,
      health_goal: document.getElementById('profEditGoal').value
    }
    document.getElementById('profMsg').textContent = '⏳ Saving...'
    try {
      const r = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(body) })
      const d = await r.json()
      if (d.profile) {
        document.getElementById('profMsg').textContent = '✅ Saved!'
        document.getElementById('profileEditForm').style.display = 'none'
        loadProfile()
        Store.set('userName', name)
        Store.set('profile', { name, dob: body.dob, lmp: body.lmp, isPregnant: body.is_pregnant })
        if (body.lmp) Store.set('lmp', body.lmp)
        if (body.is_pregnant) { Store.set('pregnant', true); if (body.lmp) { const pw = pregnancyWeek(body.lmp); Store.set('pregWeek', pw.w) } }
        setTimeout(() => document.getElementById('profMsg').textContent = '', 2000)
      } else { document.getElementById('profMsg').textContent = '❌ ' + (d.error || 'Save failed') }
    } catch { document.getElementById('profMsg').textContent = '❌ Server error' }
  })
})()
