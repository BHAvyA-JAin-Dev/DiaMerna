const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('diamerna', {
  /* Show desktop notification */
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),

  /* Platform info */
  platform: process.platform,

  /* Version */
  version: '1.0.0'
})
