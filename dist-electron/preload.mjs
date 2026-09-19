"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("foroAPI", {
  get: (key) => electron.ipcRenderer.invoke("store:get", key),
  set: (key, value) => electron.ipcRenderer.invoke("store:set", key, value),
  getAll: () => electron.ipcRenderer.invoke("store:getAll"),
  getVersion: () => electron.ipcRenderer.invoke("app:getVersion"),
  getQuotes: (symbols) => electron.ipcRenderer.invoke("market:quotes", symbols),
  auth: {
    hasUsers: () => electron.ipcRenderer.invoke("auth:hasUsers"),
    getSession: () => electron.ipcRenderer.invoke("auth:getSession"),
    register: (username, password) => electron.ipcRenderer.invoke("auth:register", { username, password }),
    login: (username, password, remember) => electron.ipcRenderer.invoke("auth:login", { username, password, remember }),
    logout: () => electron.ipcRenderer.invoke("auth:logout")
  }
});
