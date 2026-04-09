const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");

const HOST = "127.0.0.1";
const PORT = 3030;
const APP_TITLE = "English Voice Generator";

let mainWindow = null;
let backendProcess = null;
let backendStartingPromise = null;
let installTriggered = false;
let updateState = {
  checking: false,
  available: false,
  downloading: false,
  downloaded: false,
  percent: 0,
  version: "",
  error: "",
  message: ""
};

function sendUpdateStatus(extra = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("update-status", { ...updateState, ...extra });
}

function getLogFilePath() {
  try {
    return path.join(app.getPath("userData"), "main.log");
  } catch {
    return path.join(process.cwd(), "main.log");
  }
}

function log(message) {
  const line = `[${new Date().toISOString()}] [main] ${message}`;
  console.log(line);

  try {
    fs.mkdirSync(path.dirname(getLogFilePath()), { recursive: true });
    fs.appendFileSync(getLogFilePath(), `${line}\n`, "utf8");
  } catch {}
}

function logServer(message, isError = false) {
  const line = `[${new Date().toISOString()}] [server${isError ? ":error" : ""}] ${message}`;
  console.log(line);

  try {
    fs.mkdirSync(path.dirname(getLogFilePath()), { recursive: true });
    fs.appendFileSync(getLogFilePath(), `${line}\n`, "utf8");
  } catch {}
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDevMode() {
  return !app.isPackaged;
}

function getRendererEntry() {
  if (isDevMode()) {
    return process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  }

  return path.join(app.getAppPath(), "dist", "index.html");
}

function getBackendEntry() {
  if (isDevMode()) {
    return path.join(app.getAppPath(), "server", "index.mjs");
  }

  return path.join(process.resourcesPath, "app.asar", "server", "index.mjs");
}

function isProcessAlive(proc) {
  return !!proc && !proc.killed && proc.exitCode === null;
}

function checkPortOpen(host, port, timeoutMs = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {}
      resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));

    try {
      socket.connect(port, host);
    } catch {
      finish(false);
    }
  });
}

async function waitForServer(host, port, timeoutMs = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const open = await checkPortOpen(host, port, 700);
    if (open) return true;
    await sleep(250);
  }

  return false;
}

async function waitForUrl(url, timeoutMs = 20000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const target = new URL(url);
      const open = await checkPortOpen(
        target.hostname,
        Number(target.port || 80),
        700
      );

      if (open) return true;
    } catch {}

    await sleep(300);
  }

  return false;
}

async function waitForRendererReady() {
  if (!isDevMode()) return true;
  const rendererUrl = getRendererEntry();
  return waitForUrl(rendererUrl, 20000);
}

function killBackend() {
  if (!backendProcess) return;

  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(backendProcess.pid), "/f", "/t"], {
        windowsHide: true
      });
    } else {
      backendProcess.kill("SIGTERM");
    }
  } catch (error) {
    log(`killBackend error: ${error?.message || String(error)}`);
  }

  backendProcess = null;
}

async function startBackend() {
  if (backendStartingPromise) {
    return backendStartingPromise;
  }

  backendStartingPromise = (async () => {
    log("APP STARTING...");
    log("startBackend()");

    const alreadyOpen = await checkPortOpen(HOST, PORT, 700);
    if (alreadyOpen) {
      log(`Backend already running at http://${HOST}:${PORT}`);
      return;
    }

    if (isProcessAlive(backendProcess)) {
      log("Backend process already exists, waiting for ready state...");
      const ok = await waitForServer(HOST, PORT, 12000);
      if (ok) {
        log(`Backend ready at http://${HOST}:${PORT}`);
        return;
      }
    }

    const serverEntry = getBackendEntry();
    const command = process.execPath;

    log(`isDev = ${isDevMode()}`);
    log(`command = ${command}`);
    log(`serverEntry = ${serverEntry}`);

    backendProcess = spawn(command, [serverEntry], {
      env: {
        ...process.env,
        HOST,
        PORT: String(PORT),
        ELECTRON_RUN_AS_NODE: "1"
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    backendProcess.stdout?.on("data", (chunk) => {
      const text = String(chunk || "").trim();
      if (text) logServer(text, false);
    });

    backendProcess.stderr?.on("data", (chunk) => {
      const text = String(chunk || "").trim();
      if (text) logServer(text, true);
    });

    backendProcess.on("exit", (code, signal) => {
      log(`Backend exited. code=${code} signal=${signal}`);
      backendProcess = null;
    });

    backendProcess.on("error", (error) => {
      log(`Backend spawn error: ${error?.message || String(error)}`);
    });

    const ok = await waitForServer(HOST, PORT, 15000);
    if (!ok) {
      throw new Error(`Timeout waiting for ${HOST}:${PORT}`);
    }

    log(`Backend ready at http://${HOST}:${PORT}`);
  })();

  try {
    await backendStartingPromise;
  } catch (error) {
    log(`startBackend failed: ${error?.message || String(error)}`);
    throw error;
  } finally {
    backendStartingPromise = null;
  }
}

async function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 760,
    title: APP_TITLE,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const rendererEntry = getRendererEntry();

  if (isDevMode()) {
    const rendererReady = await waitForRendererReady();

    if (!rendererReady) {
      throw new Error(`Vite dev server chưa sẵn sàng: ${rendererEntry}`);
    }

    await mainWindow.loadURL(rendererEntry);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(rendererEntry);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.disableWebInstaller = true;
autoUpdater.allowPrerelease = false;
autoUpdater.allowDowngrade = false;
autoUpdater.logger = {
  info: (message) => log(`[updater] ${message}`),
  warn: (message) => log(`[updater:warn] ${message}`),
  error: (message) => log(`[updater:error] ${message}`),
  debug: (message) => log(`[updater:debug] ${message}`)
};

autoUpdater.on("checking-for-update", () => {
  log("Updater: checking-for-update");
  installTriggered = false;
  updateState = {
    ...updateState,
    checking: true,
    available: false,
    downloading: false,
    downloaded: false,
    percent: 0,
    error: "",
    message: "Đang kiểm tra cập nhật..."
  };
  sendUpdateStatus();
});

autoUpdater.on("update-available", (info) => {
  log(`Updater: update-available version=${String(info?.version || "")}`);
  updateState = {
    ...updateState,
    checking: false,
    available: true,
    downloading: false,
    downloaded: false,
    percent: 0,
    version: String(info?.version || ""),
    error: "",
    message: "Đã có bản cập nhật mới. Bắt đầu tải..."
  };
  sendUpdateStatus();
});

autoUpdater.on("update-not-available", (info) => {
  log(`Updater: update-not-available current=${app.getVersion()} latest=${String(info?.version || "")}`);
  updateState = {
    ...updateState,
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    percent: 0,
    error: "",
    message: "Không có bản cập nhật mới"
  };
  sendUpdateStatus();
});

autoUpdater.on("download-progress", (progressObj) => {
  const percent = Number(progressObj?.percent || 0);
  updateState = {
    ...updateState,
    checking: false,
    available: true,
    downloading: true,
    downloaded: false,
    percent,
    error: "",
    message: `Đang tải cập nhật... ${Math.round(percent)}%`
  };
  sendUpdateStatus();
});

autoUpdater.on("update-downloaded", (info) => {
  log(`Updater: update-downloaded version=${String(info?.version || "")}`);
  updateState = {
    ...updateState,
    checking: false,
    available: true,
    downloading: false,
    downloaded: true,
    percent: 100,
    version: String(info?.version || updateState.version || ""),
    error: "",
    message: "Tải xong. Đang cài đặt và khởi động lại..."
  };
  sendUpdateStatus({ installNow: true });
});

autoUpdater.on("error", (error) => {
  const message = error?.message || String(error || "Update error");
  log(`Updater error: ${message}`);
  updateState = {
    ...updateState,
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    error: message,
    message
  };
  sendUpdateStatus();
});

app.setName(APP_TITLE);
try { app.name = APP_TITLE; } catch {}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      return;
    }

    try {
      await createMainWindow();
    } catch (error) {
      log(`second-instance create window error: ${error?.message || String(error)}`);
    }
  });

  app.whenReady().then(async () => {
    try {
      await startBackend();
      await createMainWindow();
    } catch (error) {
      log(`Startup error: ${error?.message || String(error)}`);

      dialog.showErrorBox(
        APP_TITLE,
        `Không thể khởi động ứng dụng.\n\n${error?.message || String(error)}`
      );

      app.quit();
    }
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      try {
        await createMainWindow();
      } catch (error) {
        log(`activate create window error: ${error?.message || String(error)}`);
      }
    }
  });

  app.on("before-quit", () => {
    killBackend();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

ipcMain.handle("app:get-version", async () => {
  return app.getVersion();
});

ipcMain.handle("app:check-for-updates", async () => {
  try {
    installTriggered = false;
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    const message = error?.message || String(error || "Check update failed");
    log(`checkForUpdates failed: ${message}`);
    updateState = {
      ...updateState,
      checking: false,
      error: message,
      message
    };
    sendUpdateStatus();
    return { ok: false, error: message };
  }
});

ipcMain.handle("app:download-update", async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (error) {
    const message = error?.message || String(error || "Download update failed");
    log(`downloadUpdate failed: ${message}`);
    updateState = {
      ...updateState,
      downloading: false,
      error: message,
      message
    };
    sendUpdateStatus();
    return { ok: false, error: message };
  }
});

ipcMain.handle("app:quit-and-install-update", async () => {
  try {
    if (installTriggered) return { ok: true };

    installTriggered = true;
    updateState = {
      ...updateState,
      checking: false,
      available: true,
      downloading: false,
      downloaded: true,
      percent: 100,
      error: "",
      message: "Đang cài đặt bản cập nhật..."
    };
    sendUpdateStatus();

    setTimeout(() => {
      try {
        autoUpdater.quitAndInstall(true, true);
      } catch (error) {
        log(`quitAndInstall failed: ${error?.message || String(error)}`);
      }
    }, 400);

    return { ok: true };
  } catch (error) {
    const message = error?.message || String(error || "Quit and install failed");
    log(`quit-and-install-update failed: ${message}`);
    return { ok: false, error: message };
  }
});

ipcMain.handle("app:get-update-status", async () => {
  return { ...updateState };
});

ipcMain.handle("app:getPaths", async () => {
  return {
    userData: app.getPath("userData"),
    documents: app.getPath("documents"),
    downloads: app.getPath("downloads")
  };
});

ipcMain.handle("dialog:select-folder", async () => {
  const result = await dialog.showOpenDialog({
    title: APP_TITLE,
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || !result.filePaths?.length) {
    return {
      canceled: true,
      path: ""
    };
  }

  return {
    canceled: false,
    path: result.filePaths[0]
  };
});

ipcMain.handle("file:saveAudioFile", async (_event, payload = {}) => {
  try {
    const fileName = String(payload.fileName || "output.wav");
    const folderPath = String(payload.folderPath || "");
    const arrayBuffer = payload.arrayBuffer;

    if (!folderPath) {
      return { ok: false, error: "Thiếu folderPath" };
    }

    if (!arrayBuffer) {
      return { ok: false, error: "Thiếu arrayBuffer" };
    }

    const buffer = Buffer.from(arrayBuffer);
    fs.mkdirSync(folderPath, { recursive: true });
    const outputPath = path.join(folderPath, fileName);
    fs.writeFileSync(outputPath, buffer);

    return { ok: true, path: outputPath };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
});

ipcMain.handle("file:list-audio-files", async (_event, payload = {}) => {
  try {
    const folderPath = String(payload.folderPath || "");
    if (!folderPath || !fs.existsSync(folderPath)) {
      return { ok: true, files: [] };
    }

    const files = fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);

    return { ok: true, files };
  } catch (error) {
    return { ok: false, error: error?.message || String(error), files: [] };
  }
});

ipcMain.handle("file:read-audio-file", async (_event, payload = {}) => {
  try {
    const filePath = String(payload.filePath || "");
    if (!filePath || !fs.existsSync(filePath)) {
      return { ok: false, error: "Không tìm thấy file" };
    }

    const buffer = fs.readFileSync(filePath);
    return {
      ok: true,
      fileName: path.basename(filePath),
      arrayBuffer: buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      )
    };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
});
