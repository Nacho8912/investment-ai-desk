import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('foroAPI', {
  get: (key: string) => ipcRenderer.invoke('store:get', key),
  set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
  getAll: () => ipcRenderer.invoke('store:getAll'),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getQuotes: (symbols: string[]) => ipcRenderer.invoke('market:quotes', symbols),
  auth: {
    hasUsers: () => ipcRenderer.invoke('auth:hasUsers'),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
    register: (username: string, password: string) =>
      ipcRenderer.invoke('auth:register', { username, password }),
    login: (username: string, password: string, remember?: boolean) =>
      ipcRenderer.invoke('auth:login', { username, password, remember }),
    logout: () => ipcRenderer.invoke('auth:logout'),
  },
})
