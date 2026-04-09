import fs from "fs";
import path from "path";
import os from "os";

const APP_FOLDER_NAME = "Easy English Channel Voice Generator";

function getPersistentDataDir() {
  const appData =
    process.env.APPDATA ||
    process.env.LOCALAPPDATA ||
    path.join(os.homedir(), "AppData", "Roaming");

  return path.join(appData, APP_FOLDER_NAME);
}

const DATA_DIR = getPersistentDataDir();
const KEY_FILE = path.join(DATA_DIR, "keys.txt");

let keys = [];
let queue = [];
let index = 0;
let disabledMap = {};

const DEFAULT_COOLDOWN_MS = 90 * 1000;
const LIMITED_COOLDOWN_MS = 2 * 60 * 1000;
const INVALID_COOLDOWN_MS = 30 * 60 * 1000;

function pad2(num) {
  return String(num).padStart(2, "0");
}

function ensureKeyFileDir() {
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
}

function parseKeys(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));

  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("=")) {
      const eqIndex = line.indexOf("=");
      const label = line.slice(0, eqIndex).trim();
      const key = line.slice(eqIndex + 1).trim();

      if (!key) continue;

      result.push({
        label: label || `KEY_${pad2(i + 1)}`,
        key
      });
    } else {
      result.push({
        label: `KEY_${pad2(i + 1)}`,
        key: line
      });
    }
  }

  return result;
}

function stringifyKeys(list) {
  return list.map((item) => `${item.label}=${item.key}`).join("\n");
}

function syncQueue() {
  queue = keys.map((item) => ({ ...item }));
  index = 0;
}

function normalizeDisabledEntry(entry) {
  if (!entry) return null;

  if (typeof entry === "number") {
    return {
      disabledAt: entry,
      disabledUntil: entry + DEFAULT_COOLDOWN_MS,
      reason: "cooldown"
    };
  }

  const disabledAt = Number(entry.disabledAt || Date.now());
  const disabledUntil = Number(entry.disabledUntil || disabledAt + DEFAULT_COOLDOWN_MS);

  return {
    disabledAt,
    disabledUntil,
    reason: String(entry.reason || "cooldown")
  };
}

function isDisabledInternal(label) {
  const entry = normalizeDisabledEntry(disabledMap[label]);

  if (!entry) return false;

  if (Date.now() >= entry.disabledUntil) {
    delete disabledMap[label];
    return false;
  }

  disabledMap[label] = entry;
  return true;
}

function getDisabledMeta(label) {
  const entry = normalizeDisabledEntry(disabledMap[label]);
  if (!entry) return null;
  if (!isDisabledInternal(label)) return null;
  return normalizeDisabledEntry(disabledMap[label]);
}

export function loadKeys() {
  ensureKeyFileDir();

  if (!fs.existsSync(KEY_FILE)) {
    fs.writeFileSync(KEY_FILE, "", "utf8");
  }

  const raw = fs.readFileSync(KEY_FILE, "utf8");
  keys = parseKeys(raw);
  syncQueue();
}

export function getAllKeys() {
  return keys.map((item) => {
    const disabled = isDisabledInternal(item.label);
    const meta = disabled ? getDisabledMeta(item.label) : null;

    return {
      ...item,
      disabled,
      disabledReason: meta?.reason || "",
      disabledUntil: meta?.disabledUntil ? new Date(meta.disabledUntil).toISOString() : null
    };
  });
}

export function getNextKey() {
  if (queue.length === 0) return null;

  let attempts = 0;

  while (attempts < queue.length) {
    const item = queue[index % queue.length];
    index++;

    if (!isDisabledInternal(item.label)) {
      return item;
    }

    attempts++;
  }

  return null;
}

export function disableKey(label, options = {}) {
  const reason = String(options.reason || "cooldown");
  let cooldownMs = Number(options.cooldownMs);

  if (!Number.isFinite(cooldownMs) || cooldownMs <= 0) {
    cooldownMs =
      reason === "invalid"
        ? INVALID_COOLDOWN_MS
        : reason === "limited"
          ? LIMITED_COOLDOWN_MS
          : DEFAULT_COOLDOWN_MS;
  }

  const now = Date.now();
  disabledMap[label] = {
    disabledAt: now,
    disabledUntil: now + cooldownMs,
    reason
  };
}

export function enableKey(label) {
  delete disabledMap[label];
}

export function resetDisabledKeys() {
  disabledMap = {};
}

export function moveKeyToEnd(label) {
  const idx = queue.findIndex((item) => item.label === label);
  if (idx === -1) return;

  const picked = queue.splice(idx, 1)[0];
  queue.push(picked);

  if (queue.length > 0) {
    index = index % queue.length;
  } else {
    index = 0;
  }
}

export function replaceKeys(newRaw) {
  ensureKeyFileDir();
  fs.writeFileSync(KEY_FILE, newRaw, "utf8");
  loadKeys();
  disabledMap = {};
}

export function clearAllKeys() {
  ensureKeyFileDir();
  fs.writeFileSync(KEY_FILE, "", "utf8");
  keys = [];
  queue = [];
  index = 0;
  disabledMap = {};
}

export function removeKeysByLabels(labels) {
  const set = new Set(labels || []);

  keys = keys.filter((item) => !set.has(item.label));

  for (const label of set) {
    delete disabledMap[label];
  }

  ensureKeyFileDir();
  fs.writeFileSync(KEY_FILE, stringifyKeys(keys), "utf8");
  syncQueue();
}

export function normalizeKeys() {
  const seen = new Set();
  const unique = [];

  for (const item of keys) {
    const realKey = (item.key || "").trim();
    if (!realKey) continue;
    if (seen.has(realKey)) continue;

    seen.add(realKey);
    unique.push({
      label: item.label,
      key: realKey
    });
  }

  unique.sort((a, b) => {
    const aNumMatch = a.label.match(/\d+/);
    const bNumMatch = b.label.match(/\d+/);

    const aNum = aNumMatch ? Number(aNumMatch[0]) : 0;
    const bNum = bNumMatch ? Number(bNumMatch[0]) : 0;

    if (aNum !== bNum) return aNum - bNum;

    return a.label.localeCompare(b.label, undefined, {
      numeric: true,
      sensitivity: "base"
    });
  });

  keys = unique.map((item, idx) => ({
    label: `KEY_${pad2(idx + 1)}`,
    key: item.key
  }));

  disabledMap = {};
  ensureKeyFileDir();
  fs.writeFileSync(KEY_FILE, stringifyKeys(keys), "utf8");
  syncQueue();

  return {
    totalKeys: keys.length
  };
}

export function getKeyStatsTemplate() {
  const stats = {};

  for (const item of keys) {
    stats[item.label] = {
      success: 0,
      fail: 0,
      lastUsed: null
    };
  }

  return stats;
}
