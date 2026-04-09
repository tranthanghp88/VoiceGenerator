import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  createJobPoller,
  fallbackDownload,
  saveBlobToDirectory,
  startTtsJob
} from "../services/ttsPipeline";
import { pad3 } from "../services/mergeUtils";

export type ScriptLine = {
  role: "A" | "R" | "BOTH";
  text: string;
  blockId?: number;
};

export type SpeakerPreset = {
  speed: number;
  pitch: number;
  pause: number;
  style: string;
};

export type SpeakerSettings = {
  A: SpeakerPreset;
  R: SpeakerPreset;
  blockPause: number;
};

export type Stage = "idle" | "processing" | "saving" | "done" | "error";

export type TtsJobStatus = {
  jobId: string;
  status: "queued" | "processing" | "saving" | "done" | "error";
  stage: "queued" | "processing" | "saving" | "done" | "error";
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

export type VoiceGenerateOptions = {
  voiceMode?: "podcast" | "single";
  voiceType?:
    | "podcast"
    | "englishMale"
    | "englishFemale"
    | "vietnameseMale"
    | "vietnameseFemale";
  voiceName?: string;
  isPreview?: boolean;
  skipSaveToFile?: boolean;
  skipHistoryRefresh?: boolean;
};

function formatDurationMs(ms: number | null | undefined) {
  if (!ms || ms < 0) return "0s";
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function estimateChunks(script: ScriptLine[]) {
  return Math.max(
    1,
    script.reduce((sum, item) => {
      const textLen = (item?.text || "").length;
      return sum + Math.max(1, Math.ceil(textLen / 900));
    }, 0)
  );
}

type UseTtsJobArgs = {
  filePrefix: string;
  sequence: number;
  audioUrl: string | null;
  setAudioUrl: Dispatch<SetStateAction<string | null>>;
  directoryHandle: any | null;
  directoryName: string;
  showHistoryAudio: boolean;
  fetchDashboardData: () => Promise<void>;
  setCurrentKey: Dispatch<SetStateAction<string>>;
  setSequence: Dispatch<SetStateAction<number>>;
  refreshMergePreview: () => Promise<void>;
  scanGeneratedAudioFiles: () => Promise<void>;
};

export function useTtsJob({
  filePrefix,
  sequence,
  audioUrl,
  setAudioUrl,
  directoryHandle,
  directoryName,
  showHistoryAudio,
  fetchDashboardData,
  setCurrentKey,
  setSequence,
  refreshMergePreview,
  scanGeneratedAudioFiles
}: UseTtsJobArgs) {
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [chunkInfo, setChunkInfo] = useState({
    done: 0,
    total: 0,
    eta: "",
    elapsed: "0s"
  });

  const [currentJobId, setCurrentJobId] = useState("");
  const [jobStatus, setJobStatus] = useState<TtsJobStatus | null>(null);
  const [jobStartedAt, setJobStartedAt] = useState<number | null>(null);
  const [liveElapsedMs, setLiveElapsedMs] = useState(0);

  const startedAtRef = useRef<number | null>(null);
  const downloadedJobRef = useRef<string>("");
  const pollerRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  useEffect(() => {
    if (!currentJobId || !jobStartedAt) return;

    const timer = window.setInterval(() => {
      const startedAt = startedAtRef.current;
      if (!startedAt) return;

      const elapsed = Date.now() - startedAt;

      setLiveElapsedMs(elapsed);
      setChunkInfo((prev) => ({
        ...prev,
        elapsed: formatDurationMs(elapsed)
      }));
    }, 300);

    return () => window.clearInterval(timer);
  }, [currentJobId, jobStartedAt]);

  useEffect(() => {
    return () => {
      pollerRef.current?.stop();
      pollerRef.current = null;
    };
  }, []);

  function stopGeneration() {
    pollerRef.current?.stop();
    pollerRef.current = null;
    setCurrentJobId("");
    setJobStartedAt(null);
    startedAtRef.current = null;
    setLiveElapsedMs(0);
    setStage("idle");
    setProgress(0);
    setJobStatus(null);
    setChunkInfo({
      done: 0,
      total: 0,
      eta: "",
      elapsed: "0s"
    });
  }

  async function handleGenerate(
    text: string,
    script: ScriptLine[],
    speakerSettings?: SpeakerSettings,
    voiceOptions?: VoiceGenerateOptions
  ) {
    if (!text.trim()) {
      alert("Bạn chưa nhập nội dung.");
      return;
    }

    if (script.length === 0) {
      alert("Nội dung phải có dạng A: ..., R: ... hoặc A+R: ...");
      return;
    }

    const isPreview = !!voiceOptions?.isPreview;
    const skipSaveToFile = !!voiceOptions?.skipSaveToFile;
    const skipHistoryRefresh = !!voiceOptions?.skipHistoryRefresh;
    const hasSelectedFolder = !!directoryHandle || !!directoryName;

    const finalPrefix = filePrefix.trim() || "Ep01";
    const safeSeq = sequence > 0 ? sequence : 1;
    const fileName = isPreview ? `${finalPrefix}-preview.wav` : `${finalPrefix}-${pad3(safeSeq)}.wav`;

    pollerRef.current?.stop();
    pollerRef.current = null;

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    const startedAt = Date.now();
    startedAtRef.current = startedAt;

    setStage("processing");
    setProgress(0);
    setChunkInfo({
      done: 0,
      total: estimateChunks(script),
      eta: "",
      elapsed: "0s"
    });
    setJobStatus(null);
    setJobStartedAt(startedAt);
    setLiveElapsedMs(0);
    downloadedJobRef.current = "";

    try {
      const voiceMode = voiceOptions?.voiceMode || "podcast";
      const voiceType = voiceOptions?.voiceType || "podcast";
      const voiceName = voiceOptions?.voiceName || "";

      const payload: any = {
        script,
        fileName,
        speakerSettings,
        voiceMode,
        voiceType,
        voiceName
      };

      if (voiceMode === "podcast" && !voiceName) {
        payload.voiceMap = {
          A: "Puck",
          R: "Kore"
        };
      }

      const data = await startTtsJob(payload);

      setCurrentJobId(data.jobId || "");
      const startedJobId = data.jobId || "";

      pollerRef.current = createJobPoller(startedJobId, {
        intervalMs: 1000,
        onLog: (...args) => console.log(...args),

        onStatus: (jobData: TtsJobStatus) => {
          setJobStatus(jobData);

          if (jobData.currentKeyLabel) {
            setCurrentKey(jobData.currentKeyLabel);
          }

          setProgress(jobData.progressPercent || 0);

          const etaText =
            typeof jobData.etaMs === "number" && jobData.etaMs > 0
              ? formatDurationMs(jobData.etaMs)
              : "";

          setChunkInfo((prev) => ({
            ...prev,
            done: jobData.completedChunks || 0,
            total: jobData.totalChunks || prev.total || 0,
            eta: etaText
          }));

          if (jobData.stage === "processing") setStage("processing");
          if (jobData.stage === "saving") setStage("saving");
          if (jobData.stage === "done") setStage("done");
          if (jobData.stage === "error") setStage("error");
        },

        onDone: async (jobData: TtsJobStatus, blob: Blob, objectUrl: string) => {
          if (downloadedJobRef.current === startedJobId) {
            URL.revokeObjectURL(objectUrl);
            return;
          }

          downloadedJobRef.current = startedJobId;

          setAudioUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return objectUrl;
          });

          if (!skipSaveToFile) {
            let saved = false;

            try {
              saved = await saveBlobToDirectory(
                directoryHandle,
                blob,
                jobData.fileName,
                directoryName || undefined
              );
            } catch (error) {
              console.error("save audio failed:", error);
              saved = false;
            }

            if (!saved) {
              fallbackDownload(blob, jobData.fileName);
            }
          }

          if (!isPreview) {
            setSequence((prev) => prev + 1);
          }

          setCurrentJobId("");
          setJobStartedAt(null);
          startedAtRef.current = null;
          setLiveElapsedMs(0);
          setStage("done");
          setChunkInfo((prev) => ({
            ...prev,
            done: jobData.completedChunks || prev.done,
            total: jobData.totalChunks || prev.total,
            eta: ""
          }));

          await fetchDashboardData();

          if (!isPreview && hasSelectedFolder) {
            await refreshMergePreview();
          }

          if (!skipHistoryRefresh && hasSelectedFolder) {
            await scanGeneratedAudioFiles();
          }
        },

        onError: async (message: string, jobData?: any) => {
          console.error("JOB ERROR:", message, jobData);
          setStage("error");
          setCurrentJobId("");
          setJobStartedAt(null);
          startedAtRef.current = null;
          setLiveElapsedMs(0);
          setJobStatus((jobData as TtsJobStatus) || null);
          await fetchDashboardData();
        }
      });

      pollerRef.current.start();
    } catch (error: any) {
      console.error(error);
      setStage("error");
      setProgress(0);
      setJobStartedAt(null);
      startedAtRef.current = null;
      setLiveElapsedMs(0);
      alert(error.message || "Có lỗi xảy ra khi tạo audio");
    }
  }

  return {
    stage,
    setStage,
    progress,
    setProgress,
    chunkInfo,
    setChunkInfo,
    currentJobId,
    setCurrentJobId,
    jobStatus,
    setJobStatus,
    jobStartedAt,
    setJobStartedAt,
    liveElapsedMs,
    stageText:
      stage === "processing"
        ? "Đang xử lý"
        : stage === "saving"
          ? "Đang lưu file"
          : stage === "done"
            ? "Hoàn thành"
            : stage === "error"
              ? "Lỗi"
              : "Tạo giọng",
    isBusy: currentJobId.length > 0,
    stopGeneration,
    handleGenerate
  };
}