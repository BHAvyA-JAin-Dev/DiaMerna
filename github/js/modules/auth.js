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
    document.getElementById('authForgotGroup').style.display = 'none'
    document.getElementById('authForgotLink').style.display = 'block'
    document.getElementById('authMsg').textContent = ''
  }

  if (token) {
    fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(r => r.json()).then(d => {
        if (d.user) { hide(); updateUI(d.user, d.clouds || [], d.envProviders || []) }
        else { Store.remove('authToken'); show() }
      }).catch(() => show())
  } else { show() }

  document.getElementById('authToggleBtn').addEventListener('click', () => {
    const isLogin = document.getElementById('authTitle').textContent.includes('Login')
    if (isLogin) {
      document.getElementById('authTitle').textContent = 'Create Account'
      document.getElementById('authSubmitBtn').textContent = 'Register'
      document.getElementById('authToggleBtn').textContent = 'Already have an account? Login'
      document.getElementById('authNameGroup').style.display = 'block'
      document.getElementById('authPinGroup').style.display = 'block'
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

    msg.textContent = 'Please wait...'
    const endpoint = isLogin ? '/api/login' : '/api/register'
    const body = isLogin ? { email, password } : { email, password, name, pin }

    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (d.error) { msg.textContent = d.error; return }
      Store.set('authToken', d.token)
      Store.set('userEmail', d.user.email)
      Store.set('userName', d.user.name)
      hide()
      updateUI(d.user, [], [])
      location.reload()
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

  /* Logout */
  document.getElementById('authLogoutBtn')?.addEventListener('click', () => {
    Store.remove('authToken'); Store.remove('userEmail'); Store.remove('userName')
    location.reload()
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
          hint.innerHTML = '✅ Dropbox OAuth is ready. <strong>One important step:</strong> Go to <a href="https://www.dropbox.com/developers/apps" target="_blank" class="c-mint">Dropbox Developer Console</a> → your DiaMerna app → <strong>OAuth 2</strong> → Add redirect URI: <code class="c-mint">http://localhost:5500/api/oauth/callback</code>. Then click <strong>"Connect to Dropbox"</strong> below.'
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
            if (d.authUrl) window.open(d.authUrl, '_blank')
            msg.textContent = '✅ Authorize in the popup. You\'ll be redirected back automatically.'
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
      document.getElementById('cloudAccessToken').value = ''
      document.getElementById('cloudRefreshToken').value = ''
    } catch { msg.textContent = 'Connection failed' }
  })

  /* Check URL params for OAuth callback result */
  const params = new URLSearchParams(window.location.search)
  if (params.get('oauth_success')) {
    const cloudMsg = document.getElementById('cloudMsg')
    if (cloudMsg) cloudMsg.textContent = '✅ Connected to ' + params.get('oauth_success').replace('_', ' ') + ' via OAuth!'
    const u = new URL(window.location); u.search = ''; window.history.replaceState({}, '', u)
  }
  if (params.get('oauth_error')) {
    const cloudMsg = document.getElementById('cloudMsg')
    if (cloudMsg) cloudMsg.textContent = '❌ OAuth error: ' + decodeURIComponent(params.get('oauth_error'))
    const u = new URL(window.location); u.search = ''; window.history.replaceState({}, '', u)
  }
})()
