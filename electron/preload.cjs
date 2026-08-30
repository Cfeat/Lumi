const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lumi', {
  isDesktop: true,
  getConfig: () => ipcRenderer.invoke('lumi:getConfig'),
  aiChat: (payload) => ipcRenderer.invoke('lumi:aiChat', payload),
  getIdleTime: () => ipcRenderer.invoke('lumi:getIdleTime'),
  setIgnoreMouse: (ignore) => ipcRenderer.send('lumi:setIgnoreMouse', ignore),
  onPowerEvent: (cb) => ipcRenderer.on('lumi:power-event', (_e, evt) => cb(evt)),
  hide: () => ipcRenderer.send('lumi:hide'),
  quit: () => ipcRenderer.send('lumi:quit'),
});
