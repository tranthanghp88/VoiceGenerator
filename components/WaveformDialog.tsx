import React from "react";
import { FaTimes } from "react-icons/fa";

type WaveformDialogProps = {
  show: boolean;
  onClose: () => void;
  waveAudioPath: string;
  waveBackgroundImagePath: string;
  waveStatus: string;
  waveDuration: number;
  waveError: string;
  waveAudioUrl?: string | null;
  waveAudioPreviewRef: React.RefObject<HTMLAudioElement | null>;
  waveContainerRef: React.RefObject<HTMLDivElement | null>;
  isExportingFinalMedia: boolean;
  isWaveReady: boolean;
  videoRenderProgress: number;
  onSelectAudio: () => void;
  onSelectBackgroundImage: () => void;
  onOpenFolder: () => void;
  onExportFinalMedia: () => void;
};

export default function WaveformDialog({
  show,
  onClose,
  waveAudioPath,
  waveBackgroundImagePath,
  waveStatus,
  waveDuration,
  waveError,
  waveAudioUrl,
  waveAudioPreviewRef,
  waveContainerRef,
  isExportingFinalMedia,
  isWaveReady,
  videoRenderProgress,
  onSelectAudio,
  onSelectBackgroundImage,
  onOpenFolder,
  onExportFinalMedia
}: WaveformDialogProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">Dựng Video</div>
            
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <FaTimes />
          </button>
        </div>

        <div className="space-y-4 overflow-auto p-5">
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
            <button
              type="button"
              onClick={onSelectAudio}
              disabled={isExportingFinalMedia}
              className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:opacity-60"
            >
              Chọn audio
            </button>

            <button
              type="button"
              onClick={onSelectBackgroundImage}
              disabled={isExportingFinalMedia}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 disabled:opacity-60"
            >
              Chọn ảnh nền
            </button>

            <button
              type="button"
              onClick={onOpenFolder}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700"
            >
              Mở thư mục
            </button>

            <button
              type="button"
              onClick={onExportFinalMedia}
              disabled={!waveAudioPath || !waveBackgroundImagePath || !isWaveReady || isExportingFinalMedia}
              className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-purple-700 disabled:opacity-60"
            >
              {isExportingFinalMedia ? "Đang xuất media cuối..." : "Xuất audio + SRT + video"}
            </button>
          </div>

          <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700 break-all">
            {waveAudioPath || "Chưa chọn file audio"}
          </div>

          <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700 break-all">
            {waveBackgroundImagePath || "Chưa chọn ảnh nền"}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <div className="text-xs uppercase tracking-wide text-slate-500">Trạng thái</div>
              <div className="mt-1 font-medium text-slate-800">{waveStatus || "Sẵn sàng"}</div>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <div className="text-xs uppercase tracking-wide text-slate-500">Thời lượng</div>
              <div className="mt-1 font-medium text-slate-800">
                {waveDuration > 0 ? `${waveDuration.toFixed(1)} giây` : "--"}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <div className="text-xs uppercase tracking-wide text-slate-500">Output</div>
              <div className="mt-1 font-medium text-slate-800">*_final.wav / *_final.srt / *_final.mp4</div>
            </div>
          </div>

          {isExportingFinalMedia || videoRenderProgress > 0 ? (
            <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-purple-900">Tiến trình dựng video</span>
                <span className="font-semibold text-purple-700">{Math.round(videoRenderProgress)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-purple-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, videoRenderProgress))}%` }}
                />
              </div>
            </div>
          ) : null}

          {waveError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
              {waveError}
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4">
            <div ref={waveContainerRef} className="min-h-[160px] w-full" />
          </div>

          <audio ref={waveAudioPreviewRef} src={waveAudioUrl || undefined} preload="auto" className="w-full" controls />
        </div>
      </div>
    </div>
  );
}
