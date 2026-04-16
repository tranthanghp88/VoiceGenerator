const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  platform: process.platform,

  selectFolder: () => ipcRenderer.invoke("dialog:select-folder"),
  selectAudioFile: () => ipcRenderer.invoke("dialog:select-audio-file"),
  selectAudioFiles: () => ipcRenderer.invoke("dialog:select-audio-files"),
  selectImageFile: () => ipcRenderer.invoke("dialog:select-image-file"),

  readAudioFile: (payload) => ipcRenderer.invoke("file:read-audio-file", payload),
  saveAudioFile: (payload) => ipcRenderer.invoke("file:save-audio", payload),
  listAudioFiles: (payload) => ipcRenderer.invoke("file:list-audio-files", payload),
  openFolderPath: (payload) => ipcRenderer.invoke("file:open-folder-path", payload),
  listBgmAssets: () => ipcRenderer.invoke("file:list-bgm-assets"),
  importBgmAssets: (payload) => ipcRenderer.invoke("file:import-bgm-assets", payload),
  deleteBgmAsset: (payload) => ipcRenderer.invoke("file:delete-bgm-asset", payload),

  convertWaveformVideo: (payload) => ipcRenderer.invoke("file:convert-waveform-video", payload),
  composeFinalMedia: (payload) => ipcRenderer.invoke("file:compose-final-media", payload),

  getVersion: () => ipcRenderer.invoke("app:get-version"),
  getUpdateStatus: () => ipcRenderer.invoke("app:get-update-status"),
  checkForUpdates: () => ipcRenderer.invoke("app:check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("app:download-update"),
  quitAndInstallUpdate: () => ipcRenderer.invoke("app:quit-and-install-update"),
  onUpdateStatus: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("update-status", handler);
    return () => ipcRenderer.removeListener("update-status", handler);
  }
});
