const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dt', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  pickFolder: () => ipcRenderer.invoke('dialog:folder'),
  loadBase: () => ipcRenderer.invoke('base:load'),
  bookPage: (id, page) => ipcRenderer.invoke('book:page', id, page),
  saveAnalysis: (name, content, overwrite) => ipcRenderer.invoke('analysis:save', name, content, overwrite),
  deleteAnalysis: (name) => ipcRenderer.invoke('analysis:delete', name),
  analysisMeta: (name, patch) => ipcRenderer.invoke('analysis:meta', name, patch),
  ai: {
    config: () => ipcRenderer.invoke('ai:config'),
    save: (provider, key) => ipcRenderer.invoke('ai:save', provider, key),
    remove: (id) => ipcRenderer.invoke('ai:remove', id),
    setActive: (id) => ipcRenderer.invoke('ai:active', id),
    test: (id) => ipcRenderer.invoke('ai:test', id),
    plan: (ctx) => ipcRenderer.invoke('ai:plan', ctx),
  },
  pull: () => ipcRenderer.invoke('git:pull'),
  pushAnalyses: (msg) => ipcRenderer.invoke('git:push-analyses', msg),
  setup: (dir, branch) => ipcRenderer.invoke('git:setup', dir, branch),
  open: (p) => ipcRenderer.invoke('shell:open', p),
});
