const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // File system
  openFileDialog:    () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog:    (name) => ipcRenderer.invoke('dialog:saveFile', name),
  readFile:          (p) => ipcRenderer.invoke('file:read', p),
  writeFile:         (p, d) => ipcRenderer.invoke('file:write', p, d),
  writeText:         (p, t) => ipcRenderer.invoke('file:writeText', p, t),
  saveCSVDialog:     (name) => ipcRenderer.invoke('dialog:saveCSV', name),
  // Recents
  getRecentFiles:    () => ipcRenderer.invoke('store:getRecentFiles'),
  addRecentFile:     (p) => ipcRenderer.invoke('store:addRecentFile', p),
  clearRecentFiles:  () => ipcRenderer.invoke('store:clearRecentFiles'),
  // Window controls
  minimize:          () => ipcRenderer.invoke('window:minimize'),
  maximize:          () => ipcRenderer.invoke('window:maximize'),
  close:             () => ipcRenderer.invoke('window:close'),
  // Invoice (Nota Fiscal)
  openInvoiceDialog: () => ipcRenderer.invoke('dialog:openInvoice'),
  copyInvoice:       (src, dbPath) => ipcRenderer.invoke('file:copyInvoice', src, dbPath),
  openExternal:      (p) => ipcRenderer.invoke('file:openExternal', p),
  // OFX
  openOFXDialog:     () => ipcRenderer.invoke('dialog:openOFX'),
  readOFX:           (p) => ipcRenderer.invoke('file:readOFX', p),
});
