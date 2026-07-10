/* Auth & Cloud Storage Module */
(function () {
  const overlay = document.getElementById('authOverlay')
  if (!overlay) return

  const token = Store.get('authToken', '')
  const PROV = [
    { id: 'dropbox', label: 'Dropbox', icon: '📦' }
  ]

  function authToken() { return Store.get('authToken', '') }

  function show(msg) {
    overlay.style.display = 'flex'
    if (msg) document.getElementById('authMsg').textContent = msg
  }
  function hide() { overlay.style.display = 'none' }
  function resetForm() {
    document.getElementById('authTitle').textContent = 'Login'
    document.getElementById('authSubmitBtn').textContent = 'Login'
    document.getElementById('authToggleBtn').textContent = 'No account? Register'
    document.getElementById('authNameGroup').style.display = 'none'
    document.getElementById('authPinGroup').style.display = 'none'
    document.getElementById('authProfileGroup').style.display = 'none'
    document.getElementById('authConfirmGroup').style.display = 'none'
    document.getElementById('authConfirmPassword').value = ''
    document.getElementById('authForgotGroup').style.display = 'none'
    document.getElementById('authForgotLink').style.display = 'block'
    document.getElementById('authMsg').textContent = ''
  }

  function ensureOnboarded() {
    if (!Store.get('onboarded', false)) {
      const prof = Store.get('profile', {})
      if (prof.name) {
        Store.set('onboarded', true)
        const ob = document.getElementById('onboardingOverlay')
        if (ob) { ob.classList.add('done'); ob.style.display = 'none' }
      }
    }
  }

  const __params = new URLSearchParams(window.location.search)
  if (token && !__params.get('oauth_success') && !__params.get('oauth_error')) {
    fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(r => r.json()).then(d => {
        if (d.user) { hide(); ensureOnboarded(); updateUI(d.user, d.clouds || [], d.envProviders || []) }
        else { Store.remove('authToken'); show() }
      }).catch(() => {
        setTimeout(() => {
          fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } })
            .then(r => r.json()).then(d => {
              if (d.user) { hide(); ensureOnboarded(); updateUI(d.user, d.clouds || [], d.envProviders || []) }
              else { Store.remove('authToken'); show() }
            }).catch(() => { Store.remove('authToken'); show() })
        }, 2000)
      })
  } else { show() }

  document.getElementById('authToggleBtn').addEventListener('click', () => {
    const isLogin = document.getElementById('authTitle').textContent.includes('Login')
    if (isLogin) {
      document.getElementById('authTitle').textContent = 'Create Account'
      document.getElementById('authSubmitBtn').textContent = 'Register'
      document.getElementById('authToggleBtn').textContent = 'Already have an account? Login'
      document.getElementById('authNameGroup').style.display = 'block'
      document.getElementById('authPinGroup').style.display = 'block'
      document.getElementById('authProfileGroup').style.display = 'block'
      document.getElementById('authConfirmGroup').style.display = 'block'
      document.getElementById('authForgotGroup').style.display = 'none'
      document.getElementById('authForgotLink').style.display = 'none'
    } else { resetForm() }
    document.getElementById('authMsg').textContent = ''
  })

  document.getElementById('authForgotLink').addEventListener('click', () => {
    document.getElementById('authTitle').textContent = 'Reset Password'
    document.getElementById('authSubmitBtn').textContent = 'Reset Password'
    document.getElementById('authToggleBtn').style.display = 'none'
    document.getElementById('authNameGroup').style.display = 'none'
    document.getElementById('authPinGroup').style.display = 'none'
    document.getElementById('authForgotLink').style.display = 'none'
    document.getElementById('authForgotGroup').style.display = 'block'
    document.getElementById('authMsg').textContent = ''
  })

  document.getElementById('authForgotCancel').addEventListener('click', () => {
    document.getElementById('authToggleBtn').style.display = 'block'
    resetForm()
  })

  document.getElementById('authSubmitBtn').addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value.trim()
    const password = document.getElementById('authPassword').value
    const name = document.getElementById('authName').value.trim()
    const pin = document.getElementById('authPin').value.trim()
    const title = document.getElementById('authTitle').textContent
    const isLogin = title === 'Login'
    const isForgot = title === 'Reset Password'
    const msg = document.getElementById('authMsg')

    if (isForgot) {
      const newPassword = document.getElementById('authForgotNewPass').value
      const pin = document.getElementById('authForgotPin').value.trim()
      if (!email || !pin || !newPassword) { msg.textContent = 'Email, PIN, and new password required'; return }
      if (newPassword.length < 4) { msg.textContent = 'Password must be at least 4 characters'; return }
      msg.textContent = 'Please wait...'
      try {
        const r = await fetch('/api/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, pin, newPassword }) })
        const d = await r.json()
        if (d.error) { msg.textContent = d.error; return }
        msg.textContent = '✅ ' + d.message
        document.getElementById('authForgotNewPass').value = ''
        document.getElementById('authForgotPin').value = ''
        setTimeout(() => { document.getElementById('authToggleBtn').style.display = 'block'; resetForm() }, 2000)
      } catch { msg.textContent = 'Server unavailable' }
      return
    }

    if (!email || !password) { msg.textContent = 'Email and password required'; return }
    if (!isLogin && !name) { msg.textContent = 'Name required'; return }
    if (!isLogin && !pin) { msg.textContent = 'PIN required'; return }
    if (!isLogin && !/^\d{4,6}$/.test(pin)) { msg.textContent = 'PIN must be 4-6 digits'; return }
    if (!isLogin) {
      const confirm = document.getElementById('authConfirmPassword').value
      if (password !== confirm) { msg.textContent = 'Passwords do not match'; return }
    }

    msg.textContent = 'Please wait...'
    const endpoint = isLogin ? '/api/login' : '/api/register'
    const body = isLogin ? { email, password } : {
      email, password, name, pin,
      dob: document.getElementById('authDob').value,
      lmp: document.getElementById('authLmp').value,
      is_pregnant: document.getElementById('authPreg').checked,
      cycle_length: parseInt(document.getElementById('authCycle').value) || 28,
      health_goal: document.getElementById('authGoal').value
    }

    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (d.error) { msg.textContent = d.error; return }
      Store.set('authToken', d.token)
      Store.set('userEmail', d.user.email)
      Store.set('userName', d.user.name)
      const profData = {
        name: d.user.name,
        dob: body.dob || '',
        lmp: body.lmp || '',
        isPregnant: !isLogin ? (body.is_pregnant !== false) : true
      }
      Store.set('profile', profData)
      if (body.lmp) { Store.set('lmp', body.lmp); Store.set('cycleLen', body.cycle_length || 28); Store.set('pregnant', body.is_pregnant !== false) }
      if (body.health_goal) Store.set('goal', body.health_goal)
      if (body.dob) Store.set('dob', body.dob)
      hide()
      updateUI(d.user, [], [])
      /* Also fetch profile from server to get stored details */
      if (isLogin) {
        fetch('/api/profile', { headers: { 'Authorization': 'Bearer ' + d.token } })
          .then(r => r.json()).then(p => {
            if (p.profile) {
              Store.set('profile', {
                name: p.profile.name || d.user.name,
                dob: p.profile.dob || '',
                lmp: p.profile.lmp || '',
                isPregnant: p.profile.is_pregnant !== 0
              })
              if (p.profile.lmp) { Store.set('lmp', p.profile.lmp); Store.set('pregnant', p.profile.is_pregnant !== 0) }
              if (p.profile.health_goal) Store.set('goal', p.profile.health_goal)
              if (p.profile.dob) Store.set('dob', p.profile.dob)
            }
          }).catch(() => {})
      }
    } catch { msg.textContent = 'Server unavailable. Is the server running?' }
  })

  function updateUI(user, clouds, envProviders) {
    const nameEl = document.getElementById('dashName')
    if (nameEl) nameEl.textContent = '🌸 ' + user.name
    const sideName = document.getElementById('sidebarName')
    if (sideName) sideName.textContent = user.name
    Store.set('userName', user.name)

    const cloudStatus = document.getElementById('sidebarCloudStatus')
    if (cloudStatus) {
      if (clouds.length) {
        cloudStatus.textContent = '☁️ ' + clouds.map(c => c.provider.replace('_', ' ')).join(', ')
      } else { cloudStatus.textContent = '☁️ Not connected' }
    }

    /* Render connect buttons + fetch env status */
    renderCloudProviders(clouds, envProviders || [])
  }

  /* Logout — delegated on sidebarNav for reliability */
  document.getElementById('sidebarNav')?.addEventListener('click', e => {
    if (!e.target.closest('#authLogoutBtn')) return
    const keys = Object.keys(localStorage).filter(k => k.startsWith('dm_'))
    keys.forEach(k => localStorage.removeItem(k))
    const u = new URL(window.location); u.search = ''; window.history.replaceState({}, '', u)
    location.href = '/'
  })

  /* ===== Multi-Provider Cloud Config (env-only OAuth) ===== */
  function renderCloudProviders(clouds, envProviders) {
    const container = document.getElementById('cloudProvidersConfig')
    if (!container) return
    let html = ''
    /* Also fetch env status from server */
    fetch('/api/oauth/env-status').then(r => r.json()).then(envStatus => {
      let anyConfigured = false
      for (const p of PROV) {
        const configured = envStatus[p.id] === true
        const connected = clouds.find(c => c.provider === p.id)
        const connStatus = connected ? '✅ Connected' : '⚪ Not connected'
        const connColor = connected ? 'var(--mint)' : 'var(--text-sec)'
        const cfgStatus = configured ? '🟢 Ready' : '🔴 Not set'
        const cfgColor = configured ? 'var(--mint)' : 'var(--warn)'
        if (configured) anyConfigured = true
        html += '<div class="p-2 rounded-lg" style="background:rgba(255,255,255,0.03)">' +
          '<div class="flex items-center justify-between mb-1">' +
            '<strong class="text-xs">' + p.icon + ' ' + p.label + '</strong>' +
            '<div class="flex gap-2 text-[10px]">' +
              '<span style="color:' + cfgColor + '">OAuth: ' + cfgStatus + '</span>' +
              '<span style="color:' + connColor + '">' + connStatus + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="flex gap-1">' +
            (configured
              ? '<button id="conn_' + p.id + '" class="btn-primary text-[10px]" style="flex:1;padding:4px 8px;background:linear-gradient(135deg,#4fc3f7,#29b6f6)">🔗 Connect to ' + p.label + '</button>'
              : '<span class="text-[10px] text-gray-600" style="flex:1;padding:4px 8px">OAuth not configured on server (see .env.example)</span>'
            ) +
          '</div>' +
        '</div>'
      }
      container.innerHTML = html
      /* Show hint if none configured */
      const hint = document.getElementById('cloudOauthStatus')
      if (hint) {
        if (!anyConfigured) {
          hint.innerHTML = '⚠️ <strong>No OAuth providers configured.</strong> The app owner must set environment variables. <a href="#guides" class="c-lav">See setup guides below</a>.'
        } else {
          hint.innerHTML = '✅ Dropbox OAuth is ready. <strong>One important step:</strong> Go to <a href="https://www.dropbox.com/developers/apps" target="_blank" class="c-mint">Dropbox Developer Console</a> → your DiaMerna app → <strong>OAuth 2</strong> → Add redirect URI: <code class="c-mint">' + window.location.origin + '/api/oauth/callback</code>. Then click <strong>"Connect to Dropbox"</strong> below.'
        }
      }
      /* Wire connect buttons */
      for (const p of PROV) {
        document.getElementById('conn_' + p.id)?.addEventListener('click', async () => {
          const msg = document.getElementById('cloudMsg')
          const tk = authToken()
          if (!tk) { msg.textContent = 'Please login first'; return }
          msg.textContent = 'Opening ' + p.label + ' authorization...'
          try {
          const r = await fetch('/api/oauth/start', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk },
            body: JSON.stringify({ provider: p.id })
          })
          const d = await r.json()
          if (d.error) { msg.textContent = d.error; return }
          /* Redirect main page — popups can't update it on callback */
          if (d.authUrl) window.location.href = d.authUrl
          } catch { msg.textContent = 'Failed to start OAuth' }
        })
      }
    }).catch(() => {
      container.innerHTML = '<div class="text-[10px] text-gray-500">Could not reach server to check OAuth status.</div>'
    })
  }

  /* Manual connect */
  document.getElementById('cloudConnectBtn')?.addEventListener('click', async () => {
    const provider = document.getElementById('cloudProvider').value
    const accessToken = document.getElementById('cloudAccessToken').value.trim()
    const refreshToken = document.getElementById('cloudRefreshToken').value.trim()
    const msg = document.getElementById('cloudMsg')
    if (!accessToken) { msg.textContent = 'Access token required'; return }
    msg.textContent = 'Connecting...'
    const t = authToken()
    if (!t) { msg.textContent = 'Please login first'; return }
    try {
      const r = await fetch('/api/cloud/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t },
        body: JSON.stringify({ provider, access_token: accessToken, refresh_token: refreshToken })
      })
      const d = await r.json()
      if (d.error) { msg.textContent = d.error; return }
      msg.textContent = '✅ Connected! Folder: ' + (d.folderId || 'created')
      if (d.token) Store.set('authToken', d.token)
      document.getElementById('cloudAccessToken').value = ''
      document.getElementById('cloudRefreshToken').value = ''
    } catch { msg.textContent = 'Connection failed' }
  })

  /* Check URL params for OAuth callback result */
  const params = new URLSearchParams(window.location.search)
  if (params.get('oauth_success')) {
    const cloudMsg = document.getElementById('cloudMsg')
    if (cloudMsg) cloudMsg.textContent = '✅ Connected to ' + params.get('oauth_success').replace('_', ' ') + ' via OAuth! Your files go to your personal folder.'
    /* Store the new JWT if provided (embeds cloud info to survive DB resets) */
    const newToken = params.get('token')
    if (newToken) Store.set('authToken', newToken)
    const u = new URL(window.location); u.search = ''; window.history.replaceState({}, '', u)
    /* Refresh cloud status from server */
    const tk = Store.get('authToken', '')
    if (tk) {
      fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + tk } })
        .then(r => r.json()).then(d => {
          if (d.user) updateUI(d.user, d.clouds || [], d.envProviders || [])
        }).catch(() => {})
    }
  }
  if (params.get('oauth_error')) {
    const cloudMsg = document.getElementById('cloudMsg')
    if (cloudMsg) cloudMsg.textContent = '❌ OAuth error: ' + decodeURIComponent(params.get('oauth_error'))
    const u = new URL(window.location); u.search = ''; window.history.replaceState({}, '', u)
  }

  /* Cloud file browser */
  document.getElementById('cloudListBtn')?.addEventListener('click', async () => {
    const listEl = document.getElementById('cloudFileList')
    const token = authToken()
    if (!token) { listEl.innerHTML = '<div class="text-xs c-warn">Login required</div>'; return }
    listEl.innerHTML = '<div class="text-xs text-gray-500">📡 Loading files...</div>'
    try {
      const r = await fetch('/api/cloud/list?provider=dropbox', { headers: { 'Authorization': 'Bearer ' + token } })
      const d = await r.json()
      if (d.error) { listEl.innerHTML = '<div class="text-xs c-warn">' + d.error + '</div>'; return }
      if (d.files && d.files.length) {
        listEl.innerHTML = d.files.map(f =>
          '<div class="flex items-center justify-between p-2 rounded-lg" style="background:var(--surface);border:1px solid var(--border);font-size:11px">' +
            '<span>' + (f.type === 'folder' ? '📁' : '📄') + ' ' + f.name + '</span>' +
            '<span class="text-gray-500">' + (f.size ? Math.round(f.size / 1024) + ' KB' : '') + '</span>' +
          '</div>'
        ).join('')
      } else {
        listEl.innerHTML = '<div class="text-xs text-gray-500">📂 No files found in your cloud folder.</div>'
      }
    } catch {
      listEl.innerHTML = '<div class="text-xs c-warn">Failed to list files</div>'
    }
  })

  document.getElementById('cloudRefreshBtn')?.addEventListener('click', () => {
    const tk = authToken()
    if (tk) {
      fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + tk } })
        .then(r => r.json()).then(d => {
          if (d.user) updateUI(d.user, d.clouds || [], d.envProviders || [])
          const msg = document.getElementById('cloudMsg')
          if (msg) msg.textContent = '🔄 Status refreshed'
        }).catch(() => {})
    }
  })

  /* Secret admin gate: tap logo 7 times → admin panel */
  let _tapCount = 0, _tapTimer, _hintEl
  document.querySelectorAll('[src*="logo.jpeg"]').forEach(el => {
    el.style.cursor = 'pointer'
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      _tapCount++
      clearTimeout(_tapTimer)
      _tapTimer = setTimeout(() => { _tapCount = 0; if (_hintEl) { _hintEl.remove(); _hintEl = null } }, 1200)
      if (_tapCount >= 7) {
        _tapCount = 0
        if (_hintEl) { _hintEl.remove(); _hintEl = null }
        window.location.href = '/admin.html'
        return
      }
      if (_tapCount >= 5 && !_hintEl) {
        _hintEl = document.createElement('div')
        _hintEl.textContent = '🔐'
        _hintEl.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1a1a28;border:1px solid #b388ff;color:#b388ff;font-size:20px;padding:8px 14px;border-radius:12px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.5);animation:fadeIn .3s;pointer-events:none'
        document.body.appendChild(_hintEl)
        setTimeout(() => { if (_hintEl) { _hintEl.style.opacity = '.6' } }, 300)
      }
    })
  })

  /* Decorative floating particles */
  ;(function() {
    if (document.querySelector('.particle')) return
    const colors = ['var(--pink)', 'var(--lav)', 'var(--mint)']
    const el = document.body
    for (let i = 0; i < 3; i++) {
      const p = document.createElement('div')
      p.className = 'particle'
      p.style.cssText = `position:fixed;border-radius:50%;pointer-events:none;z-index:-1;opacity:.12;background:radial-gradient(circle,${colors[i]},transparent);animation:float ${18 + i * 4}s infinite ease-in-out;animation-delay:-${i * 6}s`
      const size = [280, 200, 150][i]
      p.style.width = size + 'px'
      p.style.height = size + 'px'
      const pos = [[-80, -80], [null, null], [null, null]]
      if (i === 0) { p.style.top = '-80px'; p.style.right = '-80px'; p.style.left = 'auto'; p.style.bottom = 'auto' }
      else if (i === 1) { p.style.bottom = '-60px'; p.style.left = '-60px' }
      else { p.style.top = '30%'; p.style.left = '-40px' }
      document.body.appendChild(p)
    }
  })()

  /* Toast helper */
  window.toast = function(msg, type) {
    const t = document.createElement('div')
    t.className = 'toast'
    t.textContent = msg
    if (type === 'success') t.style.borderColor = 'var(--mint)'
    else if (type === 'error') t.style.borderColor = 'var(--warn)'
    else if (type === 'info') t.style.borderColor = 'var(--pink)'
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 3000)
  }

  /* Animate number on scroll */
  ;(function() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target
          const target = parseFloat(el.dataset.count)
          if (isNaN(target)) return
          const dur = parseInt(el.dataset.dur) || 1000
          const start = performance.now()
          const step = (now) => {
            const p = Math.min((now - start) / dur, 1)
            const eased = 1 - Math.pow(1 - p, 3)
            el.textContent = Math.round(target * eased)
            if (p < 1) requestAnimationFrame(step)
            else el.textContent = target
          }
          requestAnimationFrame(step)
          observer.unobserve(el)
        }
      })
    }, { threshold: .5 })
    document.querySelectorAll('[data-count]').forEach(el => observer.observe(el))
  })()

  /* Register service worker for offline + push notifications */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function(err) {
      console.warn('SW registration failed:', err.message)
    })
  }

  /* Notification permission banner */
  function showNotifBanner() {
    if (!('Notification' in window) || Notification.permission !== 'default') return
    const main = document.querySelector('.main-content') || document.getElementById('mainContent') || document.querySelector('.section.active')
    if (!main) return
    /* Don't show on admin or chat */
    if (location.pathname.includes('admin') || location.pathname.includes('chat')) return
    const banner = document.createElement('div')
    banner.className = 'notif-banner'
    banner.innerHTML = '<span class="icon">🔔</span><div class="txt"><strong>Enable Notifications</strong><span>Get reminders for glucose checks, vitamins, and more</span></div><button class="dismiss" id="notifDismiss">✕</button>'
    main.insertBefore(banner, main.firstChild)
    banner.addEventListener('click', function(e) {
      if (e.target.closest('.dismiss')) { banner.remove(); localStorage.setItem('notifBannerDismissed', '1'); return }
      Notification.requestPermission().then(function(p) {
        if (p === 'granted') {
          banner.innerHTML = '<span class="icon">✅</span><div class="txt"><strong>Notifications Enabled!</strong><span>You\'ll get helpful reminders throughout the day</span></div>'
          setTimeout(function() { banner.remove() }, 3000)
        }
      })
    })
  }
  if (!localStorage.getItem('notifBannerDismissed')) showNotifBanner()
})()
