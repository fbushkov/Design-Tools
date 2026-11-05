const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dt', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  pickFolder: () => ipcRenderer.invoke('dialog:folder'),
  loadBase: () => ipcRenderer.invoke('base:load'),
  bookPage: (id, page) => ipcRenderer.invoke('book:page', id, page),
  saveAnalysis: (name, content) => ipcRenderer.invoke('analysis:save', name, content),
  pull: () => ipcRenderer.invoke('git:pull'),
  pushAnalyses: (msg) => ipcRenderer.invoke('git:push-analyses', msg),
  setup: (dir, branch) => ipcRenderer.invoke('git:setup', dir, branch),
  open: (p) => ipcRenderer.invoke('shell:open', p),
});
