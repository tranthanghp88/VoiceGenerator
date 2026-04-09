import React from "react";
import { FaStop } from "react-icons/fa";
import StageSteps from "./StageSteps";

type AudioProgressPanelProps = {
  stage: string;
  progress: number;
  chunkInfo: {
    done: number;
    total: number;
    elapsed: string;
    eta?: string;
  };
  jobStatus: {
    currentKeyLabel?: string;
    error?: string;
  } | null;
  currentKey: string;
  isBusy: boolean;
  onStopGeneration: () => void;
};

export default function AudioProgressPanel({
  stage,
  progress,
  chunkInfo,
  jobStatus,
  currentKey,
  isBusy,
  onStopGeneration
}: AudioProgressPanelProps) {
  return (
    <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-700">Tiến trình xử lý audio</div>

        <div className="flex items-center gap-2">
          {isBusy ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-700"
            >
              <FaStop />
              Dừng Tạo giọng
            </button>
          ) : null}

          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500" />
            {Math.round(progress)}%
          </div>
        </div>
      </div>

      <StageSteps stage={stage as any} />

      <div className="relative h-5 overflow-hidden rounded-full bg-slate-200 shadow-inner">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-fuchsia-500 via-sky-500 to-emerald-400 transition-all duration-500 shadow-lg"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white opacity-40"
          style={{
            width: `${progress}%`,
            background:
              "linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.75) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "shine 1.8s linear infinite"
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <span className="text-gray-500">Chunk:</span>{" "}
          <span className="font-semibold">
            {chunkInfo.done}/{chunkInfo.total}
          </span>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <span className="text-gray-500">Thời gian xử lý:</span>{" "}
          <span className="font-semibold">{chunkInfo.elapsed}</span>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <span className="text-gray-500">Key:</span>{" "}
          <span className="font-semibold">
            {jobStatus?.currentKeyLabel || currentKey || "-"}
          </span>
        </div>
      </div>

      {chunkInfo.eta ? (
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="text-gray-500">Ước tính còn lại:</span>{" "}
          <span className="font-semibold">{chunkInfo.eta}</span>
        </div>
      ) : null}

      {jobStatus?.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {jobStatus.error}
        </div>
      ) : null}
    </div>
  );
}