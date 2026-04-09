export type MergePreviewItem = {
  name: string;
  seq: number | null;
  size: number;
  valid: boolean;
  reason: string;
  sampleRate: number | null;
  channels: number | null;
  bitsPerSample: number | null;
  dataBytes: number;
  handle: any;
  path?: string;
};

export type MergePreview = {
  files: MergePreviewItem[];
  validFiles: MergePreviewItem[];
  warnings: string[];
  missingSequences: number[];
};

type BrowserFileEntry = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
};

type ElectronFileEntry = {
  kind: "file";
  name: string;
  path: string;
  size: number;
  getFile: () => Promise<File>;
};

type MergeSource = any | string | null;

export function pad3(num: number) {
  return String(num).padStart(3, "0");
}

export function parseSequenceFromName(name: string) {
  const match = name.match(/-(\d{3,})\.wav$/i);
  return match ? Number(match[1]) : null;
}

export function compareFileNames(a: string, b: string) {
  const aSeq = parseSequenceFromName(a);
  const bSeq = parseSequenceFromName(b);

  if (aSeq != null && bSeq != null && aSeq !== bSeq) {
    return aSeq - bSeq;
  }

  if (aSeq != null && bSeq == null) return -1;
  if (aSeq == null && bSeq != null) return 1;

  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function createWavBlobFromPcm(
  pcmData: Uint8Array,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16
) {
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, pcmData.length, true);

  new Uint8Array(buffer, 44).set(pcmData);
  return new Blob([buffer], { type: "audio/wav" });
}

function isRealDirectoryHandle(handle: any) {
  return !!handle && typeof handle.values === "function";
}

function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function createElectronFileFromPath(
  filePath: string,
  fileName: string,
  size = 0
): Promise<File> {
  if (!window.electronAPI?.readAudioFile) {
    throw new Error("Electron API readAudioFile chưa sẵn sàng");
  }

  const result = await window.electronAPI.readAudioFile({ filePath });

  if (!result?.ok || !result?.data) {
    throw new Error(result?.error || `Không thể đọc file ${fileName}`);
  }

  const bytes = base64ToUint8Array(result.data);
  return new File([bytes], fileName, {
    type: result.mimeType || "audio/wav",
    lastModified: Date.now()
  });
}

async function listMergeEntries(source: MergeSource): Promise<Array<BrowserFileEntry | ElectronFileEntry>> {
  if (!source) return [];

  // Browser FileSystemDirectoryHandle
  if (isRealDirectoryHandle(source)) {
    const entries: BrowserFileEntry[] = [];

    for await (const entry of source.values()) {
      if (
        entry.kind === "file" &&
        String(entry.name || "").toLowerCase().endsWith(".wav") &&
        !String(entry.name || "").toLowerCase().endsWith("-final.wav")
      ) {
        entries.push({
          kind: "file",
          name: entry.name,
          getFile: () => entry.getFile()
        });
      }
    }

    return entries.sort((a, b) => compareFileNames(a.name, b.name));
  }

  // Electron folder path
  if (typeof source === "string" && source.trim() && window.electronAPI?.listAudioFiles) {
    const result = await window.electronAPI.listAudioFiles({
      folderPath: source
    });

    if (!result?.ok) {
      throw new Error(result?.error || "Không thể quét thư mục audio");
    }

    const entries: ElectronFileEntry[] = (result.files || [])
      .filter((item) => !item.name.toLowerCase().endsWith("-final.wav"))
      .map((item) => ({
        kind: "file",
        name: item.name,
        path: item.path,
        size: item.size,
        getFile: () => createElectronFileFromPath(item.path, item.name, item.size)
      }));

    return entries.sort((a, b) => compareFileNames(a.name, b.name));
  }

  return [];
}

export async function inspectWavFile(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 44) {
    return {
      valid: false,
      reason: "File quá ngắn / header không hợp lệ",
      sampleRate: null,
      channels: null,
      bitsPerSample: null,
      dataBytes: 0
    };
  }

  const view = new DataView(buffer);

  const readString = (offset: number, len: number) => {
    let out = "";
    for (let i = 0; i < len; i++) {
      out += String.fromCharCode(view.getUint8(offset + i));
    }
    return out;
  };

  const riff = readString(0, 4);
  const wave = readString(8, 4);
  const fmt = readString(12, 4);
  const data = readString(36, 4);

  if (riff !== "RIFF" || wave !== "WAVE" || fmt !== "fmt " || data !== "data") {
    return {
      valid: false,
      reason: "Không phải WAV PCM chuẩn 44-byte header",
      sampleRate: null,
      channels: null,
      bitsPerSample: null,
      dataBytes: 0
    };
  }

  const audioFormat = view.getUint16(20, true);
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);
  const dataBytes = view.getUint32(40, true);

  if (audioFormat !== 1) {
    return {
      valid: false,
      reason: "Chỉ hỗ trợ WAV PCM",
      sampleRate,
      channels,
      bitsPerSample,
      dataBytes
    };
  }

  if (channels !== 1) {
    return {
      valid: false,
      reason: "Chỉ hỗ trợ file mono để merge",
      sampleRate,
      channels,
      bitsPerSample,
      dataBytes
    };
  }

  if (bitsPerSample !== 16) {
    return {
      valid: false,
      reason: "Chỉ hỗ trợ 16-bit PCM",
      sampleRate,
      channels,
      bitsPerSample,
      dataBytes
    };
  }

  if (!dataBytes || dataBytes <= 0 || bytes.length <= 44) {
    return {
      valid: false,
      reason: "File rỗng / không có data PCM",
      sampleRate,
      channels,
      bitsPerSample,
      dataBytes
    };
  }

  return {
    valid: true,
    reason: "",
    sampleRate,
    channels,
    bitsPerSample,
    dataBytes
  };
}

export async function findNextSequence(prefix: string, source: MergeSource) {
  if (!source) return 1;

  let maxSeq = 0;
  const entries = await listMergeEntries(source);

  for (const entry of entries) {
    const name = String(entry.name || "");
    const match = name.match(new RegExp(`^${escapeRegExp(prefix)}-(\\d{3,})\\.wav$`, "i"));
    if (!match) continue;

    const seq = Number(match[1]);
    if (Number.isFinite(seq)) {
      maxSeq = Math.max(maxSeq, seq);
    }
  }

  return maxSeq + 1;
}

export async function buildMergePreview(source: MergeSource): Promise<MergePreview> {
  const items: MergePreviewItem[] = [];
  const entries = await listMergeEntries(source);

  for (const entry of entries) {
    const file = await entry.getFile();
    const meta = await inspectWavFile(file);

    items.push({
      name: entry.name,
      seq: parseSequenceFromName(entry.name),
      size: file.size,
      valid: meta.valid,
      reason: meta.reason,
      sampleRate: meta.sampleRate,
      channels: meta.channels,
      bitsPerSample: meta.bitsPerSample,
      dataBytes: meta.dataBytes,
      handle: entry,
      path: "path" in entry ? entry.path : undefined
    });
  }

  items.sort((a, b) => compareFileNames(a.name, b.name));

  const warnings: string[] = [];
  const valid = items.filter((item) => item.valid);

  if (!items.length) {
    warnings.push("Không tìm thấy file WAV nào để merge.");
  }

  const reference = valid[0];
  const normalizedValid = valid.filter((item) => {
    if (!reference) return true;

    const sameFormat =
      item.sampleRate === reference.sampleRate &&
      item.channels === reference.channels &&
      item.bitsPerSample === reference.bitsPerSample;

    if (!sameFormat) {
      item.valid = false;
      item.reason = "Không cùng format với file chuẩn đầu tiên";
      return false;
    }

    return true;
  });

  const invalidCount = items.length - normalizedValid.length;
  if (invalidCount > 0) {
    warnings.push(`Có ${invalidCount} file bị bỏ qua vì lỗi / rỗng / sai format.`);
  }

  const sequences = normalizedValid
    .map((item) => item.seq)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);

  const missing: number[] = [];
  if (sequences.length >= 2) {
    for (let i = sequences[0]; i <= sequences[sequences.length - 1]; i++) {
      if (!sequences.includes(i)) missing.push(i);
    }
  }

  if (missing.length) {
    warnings.push(`Thiếu số thứ tự: ${missing.map((n) => pad3(n)).join(", ")}`);
  }

  return {
    files: items,
    validFiles: normalizedValid,
    warnings,
    missingSequences: missing
  };
}

export async function scanMergePreview(prefix: string, source: MergeSource) {
  const nextSequence = await findNextSequence(prefix, source);
  const preview = await buildMergePreview(source);

  if (!preview.files.length) {
    return {
      nextSequence,
      preview,
      message: "Không tìm thấy file WAV nào trong thư mục đã chọn."
    };
  }

  const firstSeq = preview.validFiles.length
    ? preview.validFiles.find((item) => item.seq != null)?.seq
    : null;

  const lastSeq = preview.validFiles.length
    ? [...preview.validFiles].reverse().find((item) => item.seq != null)?.seq
    : null;

  const message = [
    `Đã quét ${preview.files.length} file`,
    `hợp lệ ${preview.validFiles.length} file`,
    firstSeq != null && lastSeq != null ? `dải số: ${pad3(firstSeq)} -> ${pad3(lastSeq)}` : ""
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    nextSequence,
    preview,
    message
  };
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}