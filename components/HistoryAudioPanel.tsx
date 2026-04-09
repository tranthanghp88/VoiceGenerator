import React from "react";
import { FaFolderOpen, FaPlay, FaSpinner, FaTimes } from "react-icons/fa";
import { formatBytes, type FolderAudioItem } from "../utils/audioUtils";

type HistoryAudioPanelProps = {
  show: boolean;
  generatedAudioFiles: FolderAudioItem[];
  generatedAudioMessage: string;
  selectedHistoryFile: string;
  directoryHandle: any | null;
  directoryName?: string;
  scanning?: boolean;
  onClose: () => void;
  onScan: () => void | Promise<void>;
  onPlay: (item: FolderAudioItem) => void | Promise<void>;
};

export default function HistoryAudioPanel({
  show,
  generatedAudioFiles,
  generatedAudioMessage,
  selectedHistoryFile,
  directoryHandle,
  directoryName = "",
  scanning = false,
  onClose,
  onScan,
  onPlay
}: HistoryAudioPanelProps) {
  if (!show) return null;

  const hasSelectedFolder = !!directoryHandle || !!String(directoryName).trim();

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-semibold text-slate-800">Lịch sử audio</div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 shadow-sm hover:bg-slate-50"
            title="Đóng"
          >
            <span className="inline-flex items-center gap-2">
              <FaTimes />
              Đóng
            </span>
          </button>

          <button
            type="button"
            onClick={onScan}
            disabled={!hasSelectedFolder || scanning}
            className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-white shadow disabled:opacity-60"
          >
            {scanning ? (
              <span className="animate-spin">
                <FaSpinner />
              </span>
            ) : (
              <FaFolderOpen />
            )}
            {scanning ? "Đang quét..." : "Quét file audio"}
          </button>
        </div>
      </div>

      {generatedAudioMessage ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {generatedAudioMessage}
        </div>
      ) : null}

      <div className="max-h-[280px] space-y-2 overflow-auto rounded-xl border bg-slate-50 p-2">
        {generatedAudioFiles.length ? (
          generatedAudioFiles.map((item) => {
            const active = selectedHistoryFile === item.name;

            return (
              <div
                key={item.name}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 transition ${
                  active
                    ? "border-sky-300 bg-sky-50"
                    : "border-white bg-white hover:bg-slate-100"
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm text-slate-800">{item.name}</div>
                  <div className="text-xs text-slate-500">{formatBytes(item.size)}</div>
                </div>

                <button
                  type="button"
                  onClick={() => onPlay(item)}
                  className="ml-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 text-white shadow hover:bg-sky-700"
                  title="Phát audio"
                >
                  <FaPlay />
                </button>
              </div>
            );
          })
        ) : (
          <div className="px-3 py-6 text-sm text-gray-500">
            Chưa có danh sách file. Hãy chọn thư mục rồi bấm “Quét file audio”.
          </div>
        )}
      </div>
    </div>
  );
}