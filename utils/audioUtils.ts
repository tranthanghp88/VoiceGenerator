// utils/audioUtils.ts
// @ts-ignore
export type WavInspectResult = {
  ok: boolean;
  reason?: string;
  channels?: number;
  sampleRate?: number;
  bitsPerSample?: number;
  dataSize?: number;
};

export type FolderAudioItem = {
  name: string;
  size: number;
  lastModified: number;
  handle: FileSystemFileHandle;
};

// ============================================================
// WAV create / PCM helpers
// ============================================================

// 👉 Tạo WAV từ PCM 16bit mono
export function createWavBlob(pcmData: Uint8Array, sampleRate = 24000) {
  const buffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate = sampleRate * channels(1) * bytes/sample(2)
  view.setUint16(32, 2, true); // block align = channels(1) * bytes/sample(2)
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, pcmData.length, true);

  // PCM payload
  new Uint8Array(buffer, 44).set(pcmData);

  return new Blob([buffer], { type: "audio/wav" });
}

// 👉 tạo khoảng lặng (ms)
export function createSilence(ms: number, sampleRate = 24000) {
  const samples = Math.floor((ms / 1000) * sampleRate);
  return new Uint8Array(samples * 2); // 16bit mono = 2 bytes / sample
}

// 👉 nối nhiều đoạn PCM
export function concatAudio(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

// ============================================================
// General helpers
// ============================================================

export function formatDurationMs(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "00:00";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }

  return `${pad2(minutes)}:${pad2(seconds)}`;
}

export function pad3(value: number) {
  return String(value).padStart(3, "0");
}

export function parseSequenceFromName(fileName: string) {
  const match = fileName.match(/-(\d+)(\.[a-z0-9]+)?$/i);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

export function compareFileNames(a: string, b: string) {
  const seqA = parseSequenceFromName(a);
  const seqB = parseSequenceFromName(b);

  if (seqA != null && seqB != null && seqA !== seqB) {
    return seqA - seqB;
  }

  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

// ============================================================
// WAV validation / inspection
// ============================================================

export async function inspectWavFile(file: File): Promise<WavInspectResult> {
  try {
    if (!file || file.size < 44) {
      return { ok: false, reason: "File quá nhỏ hoặc rỗng" };
    }

    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    const riff = readString(view, 0, 4);
    const wave = readString(view, 8, 4);

    if (riff !== "RIFF" || wave !== "WAVE") {
      return { ok: false, reason: "Không phải file WAV hợp lệ" };
    }

    let offset = 12;
    let fmtFound = false;
    let dataFound = false;

    let channels = 0;
    let sampleRate = 0;
    let bitsPerSample = 0;
    let dataSize = 0;
    let audioFormat = 0;

    while (offset + 8 <= buffer.byteLength) {
      const chunkId = readString(view, offset, 4);
      const chunkSize = view.getUint32(offset + 4, true);
      const chunkDataOffset = offset + 8;

      if (chunkId === "fmt ") {
        fmtFound = true;

        if (chunkSize < 16 || chunkDataOffset + chunkSize > buffer.byteLength) {
          return { ok: false, reason: "fmt chunk không hợp lệ" };
        }

        audioFormat = view.getUint16(chunkDataOffset + 0, true);
        channels = view.getUint16(chunkDataOffset + 2, true);
        sampleRate = view.getUint32(chunkDataOffset + 4, true);
        bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
      } else if (chunkId === "data") {
        dataFound = true;
        dataSize = chunkSize;
      }

      offset = chunkDataOffset + chunkSize;

      // WAV chunk padding byte
      if (chunkSize % 2 === 1) {
        offset += 1;
      }
    }

    if (!fmtFound) {
      return { ok: false, reason: "Thiếu fmt chunk" };
    }

    if (!dataFound) {
      return { ok: false, reason: "Thiếu data chunk" };
    }

    if (audioFormat !== 1) {
      return { ok: false, reason: "WAV không phải PCM" };
    }

    if (channels !== 1) {
      return { ok: false, reason: `WAV không phải mono (${channels} channels)` };
    }

    if (bitsPerSample !== 16) {
      return { ok: false, reason: `WAV không phải 16-bit (${bitsPerSample}-bit)` };
    }

    if (!dataSize || dataSize <= 0) {
      return { ok: false, reason: "WAV không có dữ liệu audio" };
    }

    return {
      ok: true,
      channels,
      sampleRate,
      bitsPerSample,
      dataSize
    };
  } catch (error: any) {
    return {
      ok: false,
      reason: error?.message || "Không thể đọc file WAV"
    };
  }
}

// ============================================================
// Folder / generated audio helpers
// ============================================================

export function isAudioFileName(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith(".wav") || lower.endsWith(".mp3") || lower.endsWith(".m4a") || lower.endsWith(".ogg");
}

export async function listAudioFilesFromFolder(
  directoryHandle: FileSystemDirectoryHandle | null | undefined
): Promise<FolderAudioItem[]> {
  if (!directoryHandle) return [];

  const items: FolderAudioItem[] = [];

  for await (const entry of (directoryHandle as any).values()) {
    if (entry.kind !== "file") continue;
    if (!isAudioFileName(entry.name)) continue;

    const file = await entry.getFile();

    items.push({
      name: entry.name,
      size: file.size,
      lastModified: file.lastModified,
      handle: entry
    });
  }

  items.sort((a, b) => compareFileNames(a.name, b.name));

  return items;
}

export async function readAudioFileAsObjectUrl(
  handle: FileSystemFileHandle
): Promise<{ file: File; url: string }> {
  const file = await handle.getFile();
  const url = URL.createObjectURL(file);
  return { file, url };
}

// ============================================================
// Internal helpers
// ============================================================

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function readString(view: DataView, offset: number, length: number) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += String.fromCharCode(view.getUint8(offset + i));
  }
  return result;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

// 👉 format dung lượng
export function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 KB";

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

// 👉 tính thời lượng từ WAV data
export function getAudioDurationFromMeta(
  dataBytes: number,
  sampleRate: number,
  channels: number,
  bitsPerSample: number
) {
  if (!dataBytes || !sampleRate || !channels || !bitsPerSample) return 0;

  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = dataBytes / (channels * bytesPerSample);
  const durationSec = totalSamples / sampleRate;

  return durationSec;
}

// 👉 format thời lượng mm:ss
export function formatDurationSec(sec: number) {
  if (!sec || sec <= 0) return "0s";

  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);

  return `${m}:${String(s).padStart(2, "0")}`;
}