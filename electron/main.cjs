const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const net = require("net");
const http = require("http");

const APP_TITLE = "English Voice Generator";
const isDev = !app.isPackaged;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let backendProcess = null;
let installTriggered = false;
let backendStartingPromise = null;

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

function logUpdater(message) {
  log(`[updater] ${message}`);
}


function log(message) {
  const line = `[${new Date().toISOString()}] [main] ${message}`;
  console.log(line);
  try {
    const dir = path.join(os.homedir(), "AppData", "Roaming", "English Voice Generator");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "main.log"), line + "\n", "utf8");
  } catch {}
}

function getProjectRoot() {
  return path.resolve(__dirname, "..");
}

function getPreloadPath() {
  const appPath = typeof app.getAppPath === "function" ? app.getAppPath() : "";
  const candidates = [
    path.join(__dirname, "preload.cjs"),
    path.join(appPath, "electron", "preload.cjs"),
    path.join(process.resourcesPath || "", "app.asar.unpacked", "electron", "preload.cjs"),
    path.join(process.resourcesPath || "", "electron", "preload.cjs")
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

function getRendererUrl() {
  return process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
}

function getRendererFile() {
  const appPath = typeof app.getAppPath === "function" ? app.getAppPath() : "";
  const candidates = [
    path.join(getProjectRoot(), "dist", "index.html"),
    path.join(appPath, "dist", "index.html"),
    path.join(process.resourcesPath || "", "app.asar.unpacked", "dist", "index.html"),
    path.join(process.resourcesPath || "", "dist", "index.html")
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

function getServerEntry() {
  const appPath = typeof app.getAppPath === "function" ? app.getAppPath() : "";
  const candidates = [
    path.join(getProjectRoot(), "server", "index.mjs"),
    path.join(appPath, "server", "index.mjs"),
    path.join(process.resourcesPath || "", "app.asar.unpacked", "server", "index.mjs"),
    path.join(process.resourcesPath || "", "server", "index.mjs")
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

function ensureNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeText(value) {
  return String(value || "").trim();
}

function quoteFilterPath(filePath) {
  return safeText(filePath)
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}

function getOutputBase(inputPath) {
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, parsed.name);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeFilterPath(filePath) {
  return safeText(filePath)
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}

function isPortInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const done = (value) => {
      try { socket.destroy(); } catch {}
      resolve(value);
    };

    socket.setTimeout(800);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}


function probeBackendApi(host = "127.0.0.1", port = 3030, endpoint = "/api/key-stats") {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host,
        port,
        path: endpoint,
        timeout: 1200
      },
      (res) => {
        const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 500;
        res.resume();
        resolve(Boolean(ok));
      }
    );

    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.on("error", () => resolve(false));
  });
}

async function waitForBackendApi(host = "127.0.0.1", port = 3030, attempts = 24, delayMs = 250) {
  for (let i = 0; i < attempts; i += 1) {
    const ok = await probeBackendApi(host, port);
    if (ok) return true;
    await wait(delayMs);
  }
  return false;
}

function getUserDataDir() {
  return path.join(app.getPath("userData"), "bgm-library");
}

function getBgmManifestPath() {
  return path.join(getUserDataDir(), "bgm-assets.json");
}

function ensureBgmLibraryDir() {
  const dir = getUserDataDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function normalizeBgmId(value) {
  const raw = safeText(value).toLowerCase();
  const cleaned = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return cleaned || `bgm_${Date.now()}`;
}

function readBgmAssets() {
  try {
    const file = getBgmManifestPath();
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, "utf8") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBgmAssets(assets) {
  ensureBgmLibraryDir();
  fs.writeFileSync(getBgmManifestPath(), JSON.stringify(Array.isArray(assets) ? assets : [], null, 2), "utf8");
}

function normalizeBgmAsset(raw = {}) {
  const fileName = safeText(raw.fileName || path.basename(safeText(raw.filePath || "")));
  const label = safeText(raw.label || raw.id || fileName || "Untitled BGM");
  return {
    id: normalizeBgmId(raw.id || label || fileName),
    label,
    fileName,
    filePath: safeText(raw.filePath),
    category: safeText(raw.category),
    defaultVolume: Number.isFinite(Number(raw.defaultVolume)) ? Number(raw.defaultVolume) : 0.25,
    tags: Array.isArray(raw.tags) ? raw.tags.map((x) => safeText(x).toLowerCase()).filter(Boolean) : [],
    createdAt: safeText(raw.createdAt || new Date().toISOString()),
    updatedAt: safeText(raw.updatedAt || new Date().toISOString())
  };
}

function uniqueFilePath(filePath) {
  const parsed = path.parse(filePath);
  let candidate = filePath;
  let index = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(parsed.dir, `${parsed.name}_${index}${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

function runFfmpeg(args, options = {}) {
  const ffmpeg = "ffmpeg";
  log(`ffmpeg ${args.join(" ")}`);
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (d) => {
      stdout += String(d);
    });

    proc.stderr?.on("data", (d) => {
      stderr += String(d);
    });

    proc.on("error", (err) => {
      reject(new Error(err?.message || String(err)));
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `ffmpeg exited with code ${code}`));
      }
    });
  });
}

function formatSrtTime(seconds) {
  const totalMs = Math.max(0, Math.round(ensureNumber(seconds, 0) * 1000));
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(ms, 3)}`;
}

function buildSrtContent(subtitles = []) {
  return subtitles.map((cue, idx) => {
    const start = formatSrtTime(cue.start);
    const end = formatSrtTime(cue.end);
    const text = safeText(cue.text) || " ";
    return `${idx + 1}\n${start} --> ${end}\n${text}\n`;
  }).join("\n");
}

async function readAudioDuration(filePath) {
  const args = [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath
  ];
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    proc.stdout?.on("data", (d) => out += String(d));
    proc.on("close", () => resolve(ensureNumber(out.trim(), 0)));
    proc.on("error", () => resolve(0));
  });
}


function findWavDataOffset(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44) return -1;
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") return -1;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    if (chunkId === "data") return chunkDataStart;
    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }
  return -1;
}

function readMono16WavSamples(filePath) {
  const buffer = fs.readFileSync(filePath);
  const dataOffset = findWavDataOffset(buffer);
  if (dataOffset < 0) throw new Error("WAV không hợp lệ.");
  const sampleRate = buffer.readUInt32LE(24);
  const channels = buffer.readUInt16LE(22);
  const bitsPerSample = buffer.readUInt16LE(34);
  if (bitsPerSample !== 16) throw new Error("Chỉ hỗ trợ WAV 16-bit PCM.");
  const bytesPerSample = bitsPerSample / 8;
  const frameSize = channels * bytesPerSample;
  const sampleCount = Math.floor((buffer.length - dataOffset) / frameSize);
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    const base = dataOffset + i * frameSize;
    samples[i] = buffer.readInt16LE(base);
  }
  return { samples, sampleRate };
}

function drawRoundedRectRgb(frame, width, height, x, y, w, h, radius = 9999, rgb = [255, 255, 255]) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const rectW = Math.max(1, Math.floor(w));
  const rectH = Math.max(1, Math.floor(h));
  const x1 = Math.min(width, x0 + rectW);
  const y1 = Math.min(height, y0 + rectH);
  const r = Math.max(0, Math.min(Math.floor(radius), Math.floor(rectW / 2), Math.floor(rectH / 2)));

  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) {
      let inside = false;

      if (r <= 0) {
        inside = true;
      } else if (xx >= x0 + r && xx < x1 - r) {
        inside = true;
      } else if (yy >= y0 + r && yy < y1 - r) {
        inside = true;
      } else {
        const cx = xx < x0 + r ? x0 + r - 1 : x1 - r;
        const cy = yy < y0 + r ? y0 + r - 1 : y1 - r;
        const dx = xx - cx;
        const dy = yy - cy;
        inside = (dx * dx + dy * dy) <= (r * r);
      }

      if (inside) {
        const idx = (yy * width + xx) * 3;
        frame[idx] = rgb[0];
        frame[idx + 1] = rgb[1];
        frame[idx + 2] = rgb[2];
      }
    }
  }
}

async function renderCustomBarsVideo(wavPath, outPath, durationSeconds, options = {}) {
  const { samples, sampleRate } = readMono16WavSamples(wavPath);
  const width = Math.max(120, ensureNumber(options.width, 860));
  const height = Math.max(60, ensureNumber(options.height, 140));
  const fps = Math.max(12, ensureNumber(options.fps, 24));
  const barCount = Math.max(24, ensureNumber(options.barCount, 72));
  const barWidth = Math.max(2, ensureNumber(options.barWidth, 4));
  const gap = Math.max(0, ensureNumber(options.gap, 1));
  const bottomPadding = Math.max(1, ensureNumber(options.bottomPadding, 3));
  const minBarHeight = Math.max(2, ensureNumber(options.minBarHeight, 3));
  const maxBarHeight = Math.max(minBarHeight + 2, ensureNumber(options.maxBarHeight, 26));
  const historySeconds = Math.max(0.6, ensureNumber(options.historySeconds, 2.2));
  const smoothWindowMs = Math.max(20, ensureNumber(options.smoothWindowMs, 96));
  const idleMin = Math.max(1, ensureNumber(options.idleMin, 3));
  const idleMax = Math.max(idleMin + 1, ensureNumber(options.idleMax, 8));
  const speakingBoost = Math.max(0.5, ensureNumber(options.speakingBoost, 3.2));
  const activeSpan = Math.max(1, ensureNumber(options.activeSpan, 7));
  const spreadBias = Math.max(0.1, Math.min(2, ensureNumber(options.spreadBias, 0.85)));
  const smoothingUp = Math.max(0.01, Math.min(1, ensureNumber(options.smoothingUp, 0.28)));
  const smoothingDown = Math.max(0.01, Math.min(1, ensureNumber(options.smoothingDown, 0.22)));
  const borderRadius = Math.max(0, ensureNumber(options.borderRadius, 9999));

  const sampleWindow = Math.max(64, Math.round(sampleRate * (smoothWindowMs / 1000)));
  const historySamples = Math.max(sampleWindow * 2, Math.round(sampleRate * historySeconds));
  const totalFrames = Math.max(1, Math.ceil(durationSeconds * fps));

  await new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-f", "rawvideo",
      "-pix_fmt", "rgb24",
      "-s", `${width}x${height}`,
      "-r", String(fps),
      "-i", "-",
      "-an",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "18",
      "-pix_fmt", "yuv420p",
      outPath
    ];

    const proc = spawn("ffmpeg", args, {
      windowsHide: true,
      stdio: ["pipe", "ignore", "pipe"]
    });

    let stderr = "";
    proc.stderr?.on("data", (d) => { stderr += String(d); });
    proc.on("error", (err) => reject(new Error(err?.message || String(err))));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });

    const maxAmp = 32768;
    const usableWidth = barCount * barWidth + (barCount - 1) * gap;
    const startX = Math.max(0, Math.floor((width - usableWidth) / 2));
    const targets = new Array(barCount).fill(idleMin);
    const currents = new Array(barCount).fill(idleMin);

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      const frame = Buffer.alloc(width * height * 3, 0);
      const t = frameIndex / fps;
      const center = Math.floor(t * sampleRate);

      let strongestIndex = Math.floor(barCount / 2);
      let strongestEnergy = 0;

      for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
        const rel = barCount === 1 ? 0 : barIndex / (barCount - 1);
        const historyOffset = Math.floor((rel - 0.5) * historySamples);
        const windowCenter = Math.max(0, Math.min(samples.length - 1, center + historyOffset));
        const start = Math.max(0, windowCenter - Math.floor(sampleWindow / 2));
        const end = Math.min(samples.length, start + sampleWindow);

        let sum = 0;
        let count = 0;
        for (let i = start; i < end; i += 1) {
          const v = samples[i] / maxAmp;
          sum += v * v;
          count += 1;
        }

        const rms = count > 0 ? Math.sqrt(sum / count) : 0;
        const centerBias = 1 - Math.abs((barIndex - (barCount - 1) / 2) / Math.max(1, barCount / 2));
        const shaped = rms * (0.72 + centerBias * 0.28);
        if (shaped > strongestEnergy) {
          strongestEnergy = shaped;
          strongestIndex = barIndex;
        }

        const idleNoise = (Math.sin((frameIndex * 0.11) + (barIndex * 0.42)) + 1) * 0.5;
        targets[barIndex] = idleMin + idleNoise * Math.max(0, idleMax - idleMin);
      }

      const speakingCenter = strongestIndex;
      const speakingStrength = Math.pow(Math.min(1, strongestEnergy * speakingBoost), 1.05);
      for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
        const dist = Math.abs(barIndex - speakingCenter);
        const spread = Math.max(0, 1 - (dist / activeSpan));
        const spreadShaped = Math.pow(spread, spreadBias);
        if (spreadShaped > 0) {
          const lift = speakingStrength * spreadShaped * (maxBarHeight - idleMin);
          targets[barIndex] = Math.max(targets[barIndex], idleMin + lift);
        }
      }

      for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
        const current = currents[barIndex];
        const target = Math.max(minBarHeight, Math.min(maxBarHeight, targets[barIndex]));
        const factor = target > current ? smoothingUp : smoothingDown;
        const next = current + (target - current) * factor;
        currents[barIndex] = next;

        const barHeight = Math.max(minBarHeight, Math.round(next));
        const x = startX + barIndex * (barWidth + gap);
        const y = Math.max(0, height - bottomPadding - barHeight);
        drawRoundedRectRgb(frame, width, height, x, y, barWidth, barHeight, borderRadius, [255, 255, 255]);
      }

      proc.stdin.write(frame);
    }

    proc.stdin.end();
  });
}


async function startBackend() {
  if (backendStartingPromise) return backendStartingPromise;
  if (backendProcess && !backendProcess.killed) return;

  backendStartingPromise = (async () => {
    const host = process.env.HOST || "127.0.0.1";
    const port = Number(process.env.PORT || 3030);

    const alreadyHealthy = await probeBackendApi(host, port);
    if (alreadyHealthy) {
      log(`Backend API already responding at http://${host}:${port}, skip spawn.`);
      return;
    }

    const alreadyRunning = await isPortInUse(port, host);
    if (alreadyRunning) {
      log(`Port ${host}:${port} is already in use but backend API is not responding. Skip spawn to avoid duplicate/conflict.`);
      return;
    }

    const serverEntry = getServerEntry();
    log(`resolved serverEntry = ${serverEntry}`);
    log(`serverEntry exists = ${String(!!serverEntry && fs.existsSync(serverEntry))}`);
    if (!serverEntry || !fs.existsSync(serverEntry)) {
      log(`server entry not found: ${serverEntry}`);
      return;
    }

    log("APP STARTING...");
    log("startBackend()");
    log(`isDev = ${String(isDev)}`);
    log(`command = ${process.execPath}`);
    log(`serverEntry = ${serverEntry}`);

    backendProcess = spawn(process.execPath, [serverEntry], {
      cwd: path.dirname(serverEntry),
      env: {
        ...process.env,
        PORT: process.env.PORT || "3030",
        HOST: process.env.HOST || "127.0.0.1",
        ELECTRON_RUN_AS_NODE: "1"
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    backendProcess.stdout?.on("data", (d) => {
      const msg = String(d).trim();
      if (msg) log(`[server] ${msg}`);
    });

    backendProcess.stderr?.on("data", (d) => {
      const msg = String(d).trim();
      if (msg) log(`[server:error] ${msg}`);
    });

    backendProcess.on("error", (error) => {
      const message = error?.message || String(error || "Unknown backend spawn error");
      log(`backend spawn error: ${message}`);
      backendProcess = null;
    });

    backendProcess.on("exit", (code, signal) => {
      log(`backend exited code=${code} signal=${signal}`);
      backendProcess = null;
    });

    const ready = await waitForBackendApi(host, port, 40, 250);
    if (ready) {
      log(`Backend ready at http://${host}:${port}`);
      return;
    }

    log(`Backend failed to become ready at http://${host}:${port}`);
  })();

  try {
    await backendStartingPromise;
  } finally {
    backendStartingPromise = null;
  }
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    try { backendProcess.kill(); } catch {}
  }
  backendProcess = null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    mainWindow.loadURL(getRendererUrl());
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(getRendererFile());
  }

    mainWindow.webContents.on("did-finish-load", () => {
    sendUpdateStatus();
  });

mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function composeFinalMediaFiles(payload = {}) {
  const sourceAudioPath = safeText(payload.sourceAudioPath);
  const backgroundImagePath = safeText(payload.backgroundImagePath);
  const plan = payload.plan || {};

  if (!sourceAudioPath || !fs.existsSync(sourceAudioPath)) {
    throw new Error("Không tìm thấy source audio.");
  }
  if (!backgroundImagePath || !fs.existsSync(backgroundImagePath)) {
    throw new Error("Không tìm thấy ảnh nền.");
  }

  const musicBeds = Array.isArray(plan.musicBeds) ? plan.musicBeds : [];
  const subtitles = Array.isArray(plan.subtitles) ? plan.subtitles : [];

  const base = getOutputBase(sourceAudioPath);
  const finalAudioPath = `${base}_final.wav`;
  const finalSrtPath = `${base}_final.srt`;
  const finalVideoPath = `${base}_final.mp4`;
  const tempVideo = `${base}_temp_no_sub.mp4`;
  const barsVideo = `${base}_bars_overlay.mp4`;

  if (!musicBeds.length) {
    fs.copyFileSync(sourceAudioPath, finalAudioPath);
  } else {
    const audioDuration = await readAudioDuration(sourceAudioPath) || ensureNumber(plan.estimatedDuration, 0);
    const validBeds = musicBeds.filter((bed) => {
      const bgmPath = safeText(bed.filePath);
      return bgmPath && fs.existsSync(bgmPath);
    });

    if (!validBeds.length) {
      fs.copyFileSync(sourceAudioPath, finalAudioPath);
    } else {
      const audioArgs = ["-y", "-i", sourceAudioPath];
      const filterParts = [
        `[0:a]aformat=sample_fmts=fltp:sample_rates=24000:channel_layouts=mono[voicebase]`
      ];

      validBeds.forEach((bed) => {
        audioArgs.push("-stream_loop", "-1", "-i", safeText(bed.filePath));
      });

      validBeds.forEach((bed, idx) => {
        const inputIndex = idx + 1;
        const start = Math.max(0, ensureNumber(bed.start, 0));
        const volume = Math.max(0, ensureNumber(bed.volume, 0.25));
        const duration = Math.max(0.1, ensureNumber(bed.duration, 0) || Math.max(0.1, audioDuration - start));
        filterParts.push(
          `[${inputIndex}:a]aformat=sample_fmts=fltp:sample_rates=24000:channel_layouts=mono,atrim=0:${duration.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${Math.round(start * 1000)}|${Math.round(start * 1000)},volume=${volume.toFixed(3)}[bgm${idx}]`
        );
      });

      const bgmLabels = validBeds.map((_, idx) => `[bgm${idx}]`).join("");
      if (validBeds.length === 1) {
        filterParts.push(`${bgmLabels}anull[bgmfull]`);
      } else {
        filterParts.push(`${bgmLabels}amix=inputs=${validBeds.length}:normalize=0:dropout_transition=0[bgmfull]`);
      }

      filterParts.push(`[bgmfull][voicebase]sidechaincompress=threshold=0.03:ratio=10:attack=20:release=300:makeup=1[bgmduck]`);
      filterParts.push(`[voicebase][bgmduck]amix=inputs=2:normalize=0:dropout_transition=0[aout]`);

      audioArgs.push(
        "-filter_complex", filterParts.join(";"),
        "-map", "[aout]",
        "-c:a", "pcm_s16le",
        finalAudioPath
      );

      await runFfmpeg(audioArgs);
    }
  }

  fs.writeFileSync(finalSrtPath, buildSrtContent(subtitles), "utf8");

  const audioDuration = await readAudioDuration(finalAudioPath) || ensureNumber(plan.estimatedDuration, 0);
  await renderCustomBarsVideo(finalAudioPath, barsVideo, audioDuration, {
    width: 560,
    height: 44,
    fps: 24,
    barCount: 72,
    barWidth: 4,
    gap: 1,
    bottomPadding: 3,
    minBarHeight: 3,
    maxBarHeight: 26,
    idleMin: 3,
    idleMax: 8,
    speakingBoost: 3.2,
    activeSpan: 7,
    spreadBias: 0.85,
    smoothingUp: 0.28,
    smoothingDown: 0.22,
    borderRadius: 9999,
    historySeconds: 2.2,
    smoothWindowMs: 96
  });

  const step1 = [
    "-y",
    "-loop", "1",
    "-i", backgroundImagePath,
    "-i", finalAudioPath,
    "-i", barsVideo,
    "-filter_complex",
    `[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720[bg];` +
    `[2:v]colorkey=0x000000:0.12:0.02[wave];` +
    `[bg][wave]overlay=x=(W-w)/2+20:y=590:format=auto[vout]`,
    "-map", "[vout]",
    "-map", "1:a",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-profile:v", "high",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    tempVideo
  ];
  await runFfmpeg(step1);

  const step2 = [
    "-y",
    "-i", tempVideo,
    "-vf", `subtitles=filename='${normalizeFilterPath(finalSrtPath)}':charenc=UTF-8:force_style='FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00111111,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=8'`,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-profile:v", "high",
    "-c:a", "copy",
    finalVideoPath
  ];
  await runFfmpeg(step2);

  try { fs.unlinkSync(tempVideo); } catch {}
  try { fs.unlinkSync(barsVideo); } catch {}

  return {
    finalAudioPath,
    finalSrtPath,
    finalVideoPath
  };
}

ipcMain.handle("app:get-version", async () => {
  return app.getVersion();
});

ipcMain.handle("app:get-update-status", async () => {
  return { ...updateState };
});

ipcMain.handle("app:check-for-updates", async () => {
  try {
    installTriggered = false;
    logUpdater("checkForUpdates() called from renderer");
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    const message = error?.message || String(error || "Check update failed");
    updateState = {
      ...updateState,
      checking: false,
      error: message,
      message
    };
    logUpdater(`checkForUpdates failed: ${message}`);
    sendUpdateStatus();
    return { ok: false, error: message };
  }
});

ipcMain.handle("app:download-update", async () => {
  try {
    logUpdater("downloadUpdate() called from renderer");
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (error) {
    const message = error?.message || String(error || "Download update failed");
    updateState = {
      ...updateState,
      downloading: false,
      error: message,
      message
    };
    logUpdater(`downloadUpdate failed: ${message}`);
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
    logUpdater("quitAndInstall() requested");
    sendUpdateStatus();
    setTimeout(() => {
      try {
        autoUpdater.quitAndInstall(false, true);
      } catch (error) {
        logUpdater(`quitAndInstall failed: ${error?.message || String(error)}`);
      }
    }, 500);
    return { ok: true };
  } catch (error) {
    const message = error?.message || String(error || "Quit and install failed");
    logUpdater(`quit-and-install-update failed: ${message}`);
    return { ok: false, error: message };
  }
});

ipcMain.handle("dialog:select-folder", async () => {
  const result = await dialog.showOpenDialog({
    title: APP_TITLE,
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || !result.filePaths?.length) return { canceled: true, path: "" };
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle("dialog:select-audio-file", async () => {
  const result = await dialog.showOpenDialog({
    title: APP_TITLE,
    properties: ["openFile"],
    filters: [{ name: "Audio", extensions: ["wav", "mp3", "m4a", "aac", "ogg", "flac"] }]
  });
  if (result.canceled || !result.filePaths?.length) return { canceled: true, path: "" };
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle("dialog:select-audio-files", async () => {
  const result = await dialog.showOpenDialog({
    title: APP_TITLE,
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Audio", extensions: ["wav", "mp3", "m4a", "aac", "ogg", "flac"] }]
  });
  if (result.canceled || !result.filePaths?.length) return { canceled: true, paths: [] };
  return { canceled: false, paths: result.filePaths };
});

ipcMain.handle("dialog:select-image-file", async () => {
  const result = await dialog.showOpenDialog({
    title: APP_TITLE,
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }]
  });
  if (result.canceled || !result.filePaths?.length) return { canceled: true, path: "" };
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle("file:read-audio-file", async (_event, payload = {}) => {
  try {
    const filePath = safeText(payload.filePath);
    if (!filePath || !fs.existsSync(filePath)) return { ok: false, error: "Không tìm thấy file audio." };
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      ".wav": "audio/wav",
      ".mp3": "audio/mpeg",
      ".m4a": "audio/mp4",
      ".aac": "audio/aac",
      ".ogg": "audio/ogg",
      ".flac": "audio/flac"
    };
    const uint8 = Uint8Array.from(buf);
    return { ok: true, data: buf.toString("base64"), arrayBuffer: uint8.buffer, mimeType: mimeMap[ext] || "audio/wav" };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
});

ipcMain.handle("file:save-audio", async (_event, payload = {}) => {
  try {
    const folderPath = safeText(payload.folderPath);
    const fileName = safeText(payload.fileName || "output.wav");
    const arrayBuffer = payload.arrayBuffer;
    if (!folderPath || !fileName || !arrayBuffer) return { ok: false, error: "Thiếu dữ liệu để lưu audio." };
    fs.mkdirSync(folderPath, { recursive: true });
    const targetPath = path.join(folderPath, fileName);
    fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
    return { ok: true, path: targetPath };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
});

ipcMain.handle("file:open-folder-path", async (_event, payload = {}) => {
  try {
    const targetPath = safeText(payload.path);
    if (!targetPath) return { ok: false, error: "Thiếu đường dẫn để mở." };

    let folderPath = targetPath;
    if (fs.existsSync(targetPath)) {
      try {
        const stat = fs.statSync(targetPath);
        if (stat.isFile()) {
          folderPath = path.dirname(targetPath);
        }
      } catch {}
    } else {
      folderPath = path.dirname(targetPath);
    }

    if (!folderPath || !fs.existsSync(folderPath)) {
      return { ok: false, error: "Không tìm thấy thư mục cần mở." };
    }

    const result = await shell.openPath(folderPath);
    if (result) {
      return { ok: false, error: result };
    }

    return { ok: true, path: folderPath };
  } catch (error) {
    return { ok: false, error: error?.message || String(error || "Không thể mở thư mục") };
  }
});

ipcMain.handle("file:list-audio-files", async (_event, payload = {}) => {
  try {
    const folderPath = safeText(payload.folderPath);
    if (!folderPath || !fs.existsSync(folderPath)) return { ok: true, files: [] };
    const files = fs.readdirSync(folderPath)
      .filter((name) => /\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(name))
      .map((name) => ({ name, path: path.join(folderPath, name) }));
    return { ok: true, files };
  } catch (error) {
    return { ok: false, error: error?.message || String(error), files: [] };
  }
});

ipcMain.handle("file:convert-waveform-video", async (_event, payload = {}) => {
  try {
    const sourceFilePath = safeText(payload.sourceFilePath);
    if (!sourceFilePath || !fs.existsSync(sourceFilePath)) return { ok: false, error: "Không tìm thấy source audio." };
    const base = getOutputBase(sourceFilePath);
    const out = `${base}_waveform.mp4`;
    const args = [
      "-y",
      "-f", "lavfi",
      "-i", "color=c=black:s=1280x720:d=1",
      "-i", sourceFilePath,
      "-filter_complex",
`[1:a]showfreqs=s=140x180:mode=bar:ascale=sqrt:fscale=log:win_size=4096:colors=white,format=rgba,crop=140:90:0:0,scale=760:120:flags=neighbor[sw];[0:v][sw]overlay=x=360:y=500[vout]`,
      "-map", "[vout]",
      "-map", "1:a",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-c:a", "aac",
      "-shortest",
      out
    ];
    await runFfmpeg(args);
    return { ok: true, path: out };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
});

ipcMain.handle("file:compose-final-media", async (_event, payload = {}) => {
  try {
    const result = await composeFinalMediaFiles(payload);
    return { ok: true, ...result };
  } catch (error) {
    const message = error?.message || String(error || "Xuất media cuối thất bại");
    log(`compose-final-media failed: ${message}`);
    return { ok: false, error: message };
  }
});

ipcMain.handle("file:list-bgm-assets", async () => {
  try {
    const assets = readBgmAssets()
      .map(normalizeBgmAsset)
      .filter((item) => item.filePath && fs.existsSync(item.filePath));
    writeBgmAssets(assets);
    return { ok: true, assets, libraryDir: ensureBgmLibraryDir() };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
});

ipcMain.handle("file:import-bgm-assets", async (_event, payload = {}) => {
  try {
    const files = Array.isArray(payload.files) ? payload.files.map((x) => safeText(x)).filter(Boolean) : [];
    if (!files.length) return { ok: false, error: "Không có file BGM để import." };

    const libraryDir = ensureBgmLibraryDir();
    const assets = readBgmAssets().map(normalizeBgmAsset);
    let importedCount = 0;

    for (const src of files) {
      if (!fs.existsSync(src)) continue;
      const fileName = path.basename(src);
      const targetPath = uniqueFilePath(path.join(libraryDir, fileName));
      fs.copyFileSync(src, targetPath);

      const nextAsset = normalizeBgmAsset({
        id: path.parse(fileName).name,
        label: path.parse(fileName).name,
        fileName: path.basename(targetPath),
        filePath: targetPath,
        updatedAt: new Date().toISOString()
      });

      const existingIndex = assets.findIndex((item) => item.id === nextAsset.id);
      if (existingIndex >= 0) {
        assets[existingIndex] = { ...assets[existingIndex], ...nextAsset, createdAt: assets[existingIndex].createdAt || nextAsset.createdAt };
      } else {
        assets.push(nextAsset);
      }
      importedCount += 1;
    }

    assets.sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id), undefined, { sensitivity: "base" }));
    writeBgmAssets(assets);
    return { ok: true, assets, importedCount, libraryDir };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
});

ipcMain.handle("file:delete-bgm-asset", async (_event, payload = {}) => {
  try {
    const assetId = normalizeBgmId(payload.assetId);
    const assets = readBgmAssets().map(normalizeBgmAsset);
    const found = assets.find((item) => item.id === assetId);
    if (found?.filePath && fs.existsSync(found.filePath)) {
      try { fs.unlinkSync(found.filePath); } catch {}
    }
    const next = assets.filter((item) => item.id !== assetId);
    writeBgmAssets(next);
    return { ok: true, assets: next };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
});


autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

autoUpdater.on("checking-for-update", () => {
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
  logUpdater("checking-for-update");
  sendUpdateStatus();
});

autoUpdater.on("update-available", (info) => {
  const version = String(info?.version || "");
  updateState = {
    ...updateState,
    checking: false,
    available: true,
    downloading: false,
    downloaded: false,
    percent: 0,
    version,
    error: "",
    message: `Đã có bản cập nhật mới${version ? ` (${version})` : ""}`
  };
  logUpdater(`update-available version=${version}`);
  sendUpdateStatus();
});

autoUpdater.on("update-not-available", (info) => {
  const version = String(info?.version || app.getVersion() || "");
  updateState = {
    ...updateState,
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    percent: 0,
    version,
    error: "",
    message: "Không có bản cập nhật mới"
  };
  logUpdater(`update-not-available version=${version}`);
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
  logUpdater(`download-progress percent=${percent.toFixed(2)}`);
  sendUpdateStatus();
});

autoUpdater.on("update-downloaded", (info) => {
  const version = String(info?.version || updateState.version || "");
  updateState = {
    ...updateState,
    checking: false,
    available: true,
    downloading: false,
    downloaded: true,
    percent: 100,
    version,
    error: "",
    message: "Tải xong. Đang cài đặt và khởi động lại..."
  };
  logUpdater(`update-downloaded version=${version}`);
  sendUpdateStatus({ installNow: true });
});

autoUpdater.on("error", (error) => {
  const message = error?.message || String(error || "Update error");
  updateState = {
    ...updateState,
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    error: message,
    message
  };
  logUpdater(`error ${message}`);
  sendUpdateStatus();
});


app.on("second-instance", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  await startBackend();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopBackend();
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
});
