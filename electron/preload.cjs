const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  platform: process.platform,

  selectFolder: () => ipcRenderer.invoke("dialog:select-folder"),

  saveAudioFile: (payload) => ipcRenderer.invoke("file:saveAudioFile", payload),
  listAudioFiles: (payload) => ipcRenderer.invoke("file:list-audio-files", payload),
  readAudioFile: (payload) => ipcRenderer.invoke("file:read-audio-file", payload),

  getVersion: () => ipcRenderer.invoke("app:get-version"),
  checkForUpdates: () => ipcRenderer.invoke("app:check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("app:download-update"),
  quitAndInstallUpdate: () => ipcRenderer.invoke("app:quit-and-install-update"),
  getUpdateStatus: () => ipcRenderer.invoke("app:get-update-status"),

  onUpdateStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("update-status", handler);
    return () => ipcRenderer.removeListener("update-status", handler);
  }
});
