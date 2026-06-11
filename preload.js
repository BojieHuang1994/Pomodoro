const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getStats: () => ipcRenderer.invoke('stats:get'),
  recordFocus: (minutes) => ipcRenderer.invoke('stats:record', minutes),
  sendNotification: (title, body) => ipcRenderer.send('notify', { title, body })
});
