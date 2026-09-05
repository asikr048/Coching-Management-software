const { contextBridge, ipcRenderer } = require("electron")

// Expose safe Electron APIs to window
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,

  // Listen for connectivity status change events
  onNetworkStatusChanged: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on("network:status-changed", handler)
    return () => ipcRenderer.removeListener("network:status-changed", handler)
  },

  // Manual connection check
  checkConnection: () => ipcRenderer.invoke("network:check"),

  // Local Vault Operations
  getLocalVault: () => ipcRenderer.invoke("vault:get"),
  saveLocalVault: (data) => ipcRenderer.invoke("vault:save", data),
  getVaultInfo: () => ipcRenderer.invoke("vault:get-info"),

  // Navigation
  loadServer: () => ipcRenderer.invoke("app:load-server"),
  loadOffline: () => ipcRenderer.invoke("app:load-offline"),

  // Native Notifications
  notify: (title, body, silent = false) => ipcRenderer.invoke("app:notify", { title, body, silent }),
})
