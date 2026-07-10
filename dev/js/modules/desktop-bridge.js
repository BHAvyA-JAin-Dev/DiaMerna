/* DiaMerna — Desktop bridge for Electron
   Provides notification API to the web app when running inside Electron.
   Falls back to browser Notification API when not in Electron. */
(function () {
  const isElectron = navigator.userAgent.toLowerCase().includes('electron')
  if (!isElectron) return

  document.addEventListener('DOMContentLoaded', function () {
    /* Add badge to header showing it's the desktop app */
    const header = document.querySelector('.header')
    if (header) {
      const badge = document.createElement('span')
      badge.style.cssText = 'font-size:.6rem;background:rgba(105,240,174,.15);color:#69f0ae;padding:2px 8px;border-radius:10px;margin-left:8px;font-weight:500;letter-spacing:.3px'
      badge.textContent = 'DESKTOP'
      const logo = header.querySelector('.logo')
      if (logo) logo.after(badge)
    }

    /* Expose desktop notifications */
    if (window.diamerna && window.diamerna.notify) {
      const origNotify = window.diamerna.notify
      window.diamerna.notify = function (title, body) {
        origNotify(title, body)
      }
    }
  })
})()
