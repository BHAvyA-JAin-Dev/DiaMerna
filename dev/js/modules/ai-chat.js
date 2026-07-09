/* AI Chat Module (Full Screen + FAB) */
(function () {
  /* Typewriter: types text char by char into element with fade */
  function typewrite(el, text, speed) {
    el.textContent = ''
    let i = 0
    function tick() {
      if (i < text.length) {
        el.textContent += text[i]
        i++
        el.scrollTop = el.scrollHeight
        setTimeout(tick, speed || 20)
      }
    }
    tick()
  }

  /* Full screen chat */
  const msgs = document.getElementById('chatFullMsgs')
  const inp = document.getElementById('chatFullInp')
  const send = document.getElementById('chatFullSend')
  const close = document.getElementById('chatFullClose')

  close.addEventListener('click', () => { window.switchTab('home') })

  function addMsg(role, text) {
    const div = document.createElement('div')
    div.className = 'msg ' + role
    msgs.appendChild(div)
    if (role === 'ai') { typewrite(div, text, 18) }
    else { div.textContent = text }
    msgs.scrollTop = msgs.scrollHeight
  }

  async function ask() {
    const text = inp.value.trim()
    if (!text) return
    addMsg('user', text)
    inp.value = ''
    const loading = document.createElement('div')
    loading.className = 'msg ai loading'
    loading.textContent = '...'
    msgs.appendChild(loading)
    msgs.scrollTop = msgs.scrollHeight

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
        body: JSON.stringify({
          model: API_MODEL,
          messages: [
            { role: 'system', content: AI_SYSTEM_PROMPT },
            ...Array.from(msgs.querySelectorAll('.msg:not(.loading)')).map(m => ({
              role: m.classList.contains('user') ? 'user' : 'assistant',
              content: m.textContent
            }))
          ],
          max_tokens: 600
        })
      })
      const data = await res.json()
      loading.remove()
      const reply = data.choices?.[0]?.message?.content?.trim() || 'Hmm, I couldn\'t respond right now.'
      addMsg('ai', reply)
    } catch {
      loading.remove()
      addMsg('ai', 'Sorry, I\'m having trouble connecting. Please try again.')
    }
  }

  send.addEventListener('click', ask)
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') ask() })

  /* FAB popup (small companion still available) */
  const fab = document.getElementById('aiFab')
  const panel = document.getElementById('aiPanel')
  const fabMsgs = document.getElementById('aiFabMsgs')
  const fabInp = document.getElementById('aiFabInp')
  const fabSend = document.getElementById('aiFabSend')
  const fabClose = document.getElementById('aiClose')

  fab.addEventListener('click', () => {
    fab.classList.toggle('open')
    panel.classList.toggle('open')
    if (panel.classList.contains('open')) fabInp.focus()
  })
  fabClose.addEventListener('click', () => { fab.classList.remove('open'); panel.classList.remove('open') })

  fabSend.addEventListener('click', async () => {
    const text = fabInp.value.trim()
    if (!text) return
    const div = document.createElement('div'); div.className = 'msg user'; div.textContent = text
    fabMsgs.appendChild(div); fabInp.value = ''
    const ld = document.createElement('div'); ld.className = 'msg ai loading'; ld.textContent = '...'
    fabMsgs.appendChild(ld); fabMsgs.scrollTop = fabMsgs.scrollHeight
    try {
      const res = await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
        body: JSON.stringify({ model: API_MODEL, messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          ...Array.from(fabMsgs.querySelectorAll('.msg:not(.loading)')).map(m => ({
            role: m.classList.contains('user') ? 'user' : 'assistant',
            content: m.textContent
          }))
        ], max_tokens: 300 })
      })
      const data = await res.json()
      ld.remove()
      const reply = data.choices?.[0]?.message?.content?.trim() || '...'
      const rd = document.createElement('div'); rd.className = 'msg ai'
      fabMsgs.appendChild(rd); typewrite(rd, reply, 15); fabMsgs.scrollTop = fabMsgs.scrollHeight
    } catch { ld.remove(); const rd = document.createElement('div'); rd.className = 'msg ai'; rd.textContent = 'Connection issue.'; fabMsgs.appendChild(rd) }
  })
  fabInp.addEventListener('keydown', e => { if (e.key === 'Enter') fabSend.click() })
})()
