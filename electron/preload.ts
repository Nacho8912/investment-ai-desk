import { contextBridge, ipcRenderer } from 'electron'

/** Only purpose-specific operations cross the renderer/main boundary. Never expose ipcRenderer. */
contextBridge.exposeInMainWorld('foroAPI', {
  getAll: () => ipcRenderer.invoke('data:getAll'),
  setData: (key: string, value: unknown) => ipcRenderer.invoke('data:set', key, value),
  updateSettings: (settings: unknown, newApiKey?: string) =>
    ipcRenderer.invoke('settings:update', settings, newApiKey),
  clearApiKey: () => ipcRenderer.invoke('settings:clearKey'),
  llmComplete: (system: string, user: string) => ipcRenderer.invoke('llm:complete', system, user),
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
