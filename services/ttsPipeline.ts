// services/ttsPipeline.ts

export type ScriptLine = {
  role: "A" | "R" | "BOTH";
  text: string;
  blockId?: number;
  pauseSeconds?: number;
  bgm?: {
    id: string;
    duration?: number;
    volume?: number;
    mode?: "once" | "loop";
    raw: string;
  } | null;
  markerLines?: string[];
};

export type SpeakerPreset = {
  speed: number;
  pitch: number;
  pause: number;
  style: string;
};

export type AutoBlockPauseRule = {
  id: string;
  text: string;
  pause: string;
};

export type SpeakerSettings = {
  A: SpeakerPreset;
  R: SpeakerPreset;
  blockPause: number;
  autoBlockPause?: boolean;
  autoBlockPauseRules?: AutoBlockPauseRule[];
};

export type TtsStage = "queued" | "processing" | "saving" | "done" | "error";

export type TtsJobStatus = {
  jobId: string;
  status: TtsStage;
  stage: TtsStage;
  progressPercent: number;
  totalChunks: number;
  completedChunks: number;
  currentChunk: number;
  elapsedMs: number;
  etaMs: number | null;
  fileName: string;
  currentKeyLabel: string;
  error: string;
  createdAt: string;
};

export type StartTtsJobPayload = {
  script: ScriptLine[];
  fileName: string;
  voiceMap?: Record<string, string>;
  speakerSettings?: SpeakerSettings;
  voiceMode?: string;
  voiceType?: string;
  voiceName?: string;
};

export type StartTtsJobResult = {
  jobId: string;
  [key: string]: any;
};

export type PollJobCallbacks = {
  onStatus?: (data: TtsJobStatus) => void;
  onDone?: (data: TtsJobStatus, blob: Blob, objectUrl: string) => Promise<void> | void;
  onError?: (message: string, data?: any) => void;
  onLog?: (...args: any[]) => void;
};

type PollJobOptions = PollJobCallbacks & {
  intervalMs?: number;
};

const isDesktop = !!window?.electronAPI?.isDesktop;
const API_BASE = isDesktop ? "http://127.0.0.1:3030" : "";

function apiFetch(url: string, options?: RequestInit) {
  return fetch(`${API_BASE}${url}`, options);
}

function logWith(cb: PollJobCallbacks["onLog"], ...args: any[]) {
  console.log(...args);
  cb?.(...args);
}

async function readJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function isRealDirectoryHandle(handle: any) {
  return !!handle && typeof handle.getFileHandle === "function";
}

function normalizeScriptForBackend(script: ScriptLine[]): ScriptLine[] {
  return (script || [])
    .map((line) => ({
      ...line,
      text: String(line?.text || "").normalize("NFC").trim()
    }))
    .filter((line) => !!line.text);
}

export async function startTtsJob(
  payload: StartTtsJobPayload
): Promise<StartTtsJobResult> {
  const normalizedScript = normalizeScriptForBackend(payload.script);

  const requestBody = {
    script: normalizedScript,
    fileName: payload.fileName,
    speakerSettings: payload.speakerSettings,
    voiceMode: payload.voiceMode || "",
    voiceType: payload.voiceType || "",
    voiceName: payload.voiceName || "",
    voiceMap: payload.voiceMap
  };

  console.log("startTtsJob REQUEST BODY:", requestBody);

  const res = await apiFetch("/api/tts/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const data = await readJsonSafe(res);

  if (!res.ok) {
    throw new Error(data?.error || "Không thể bắt đầu job TTS");
  }

  if (!data?.jobId) {
    throw new Error("API không trả về jobId");
  }

  return data;
}

export async function getTtsJob(jobId: string): Promise<TtsJobStatus> {
  const res = await apiFetch(`/api/tts/jobs/${jobId}`);

  if (!res.ok) {
    throw new Error(`Không lấy được trạng thái job ${jobId}`);
  }

  return res.json();
}

export async function getTtsJobAudio(jobId: string): Promise<Blob> {
  const res = await apiFetch(`/api/tts/jobs/${jobId}/audio`);

  if (!res.ok) {
    throw new Error("Không tải được audio final");
  }

  const blob = await res.blob();

  if (!blob || blob.size <= 0) {
    throw new Error("Audio blob rỗng");
  }

  return blob;
}

export async function saveBlobToDirectory(
  directoryHandle: any | null,
  blob: Blob,
  fileName: string,
  folderPath?: string
) {
  if (folderPath && window.electronAPI?.saveAudioFile) {
    try {
      const arrayBuffer = await blob.arrayBuffer();

      const result = await window.electronAPI.saveAudioFile({
        folderPath,
        fileName,
        arrayBuffer
      });

      if (!result?.ok) {
        console.error("electron saveAudioFile failed:", result?.error || "unknown error");
        return false;
      }

      return true;
    } catch (error) {
      console.error("electron saveAudioFile failed:", error);
      return false;
    }
  }

  if (!directoryHandle || !isRealDirectoryHandle(directoryHandle)) return false;

  try {
    const currentPermission = await directoryHandle.queryPermission?.({
      mode: "readwrite"
    });

    if (currentPermission !== "granted") {
      const requestedPermission = await directoryHandle.requestPermission?.({
        mode: "readwrite"
      });

      if (requestedPermission !== "granted") {
        return false;
      }
    }

    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    return true;
  } catch (error) {
    console.error("saveBlobToDirectory failed:", error);
    return false;
  }
}

export function fallbackDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  return url;
}

export function createJobPoller(jobId: string, options: PollJobOptions = {}) {
  const { intervalMs = 1000, onStatus, onDone, onError, onLog } = options;

  let timer: number | null = null;
  let stopped = false;
  let downloaded = false;

  async function runOnce() {
    if (stopped || !jobId) return;

    try {
      const data = await getTtsJob(jobId);

      onStatus?.(data);

      if (data.status === "done") {
        if (downloaded) return;
        downloaded = true;

        logWith(onLog, "DONE DETECTED, START DOWNLOAD FOR:", jobId);

        const blob = await getTtsJobAudio(jobId);
        logWith(onLog, "AUDIO BLOB SIZE:", blob.size, "FILE:", data.fileName);

        const objectUrl = URL.createObjectURL(blob);

        stop();

        await onDone?.(data, blob, objectUrl);
        return;
      }

      if (data.status === "error") {
        stop();
        onError?.(data?.error || "Job thất bại", data);
      }
    } catch (error: any) {
      console.error(error);
      onError?.(error?.message || "Poll job thất bại");
    }
  }

  function start() {
    if (timer || stopped) return;

    void runOnce();

    timer = window.setInterval(() => {
      void runOnce();
    }, intervalMs);
  }

  function stop() {
    stopped = true;

    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  return {
    start,
    stop
  };
}