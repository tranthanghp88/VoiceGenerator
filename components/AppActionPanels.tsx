import React from "react";
import {
  FaFolderOpen,
  FaKey,
  FaLayerGroup,
  FaPlay,
  FaSpinner
} from "react-icons/fa";

type AppActionPanelsProps = {
  isBusy: boolean;
  hasSelectedFolder: boolean;
  scanningMerge: boolean;
  showMergePanel: boolean;
  adminVisible: boolean;
  showHistoryAudio: boolean;
  generateButtonIcon: React.ReactNode;
  generateButtonText: string;
  onToggleMergePanel: () => void;
  onToggleKeyManager: () => void;
  onToggleHistoryAudio: () => void;
  onGenerate: () => void;
  mergePanel: React.ReactNode;
  keyManagerPanel: React.ReactNode;
  historyAudioPanel: React.ReactNode;
  onOpenWaveform: () => void;
};

export default function AppActionPanels({
  isBusy,
  hasSelectedFolder,
  scanningMerge,
  showMergePanel,
  adminVisible,
  showHistoryAudio,
  generateButtonIcon,
  generateButtonText,
  onToggleMergePanel,
  onToggleKeyManager,
  onToggleHistoryAudio,
  onGenerate,
  mergePanel,
  keyManagerPanel,
  historyAudioPanel,
  onOpenWaveform
}: AppActionPanelsProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onToggleMergePanel}
          type="button"
          disabled={isBusy || !hasSelectedFolder || scanningMerge}
          className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-white shadow disabled:opacity-60"
        >
          {scanningMerge ? (
            <span className="animate-spin">
              <FaSpinner />
            </span>
          ) : (
            <FaLayerGroup />
          )}
          {showMergePanel ? "Đóng gộp file" : "Gộp file"}
        </button>

        <button
          onClick={onToggleKeyManager}
          type="button"
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-white shadow"
        >
          <FaKey />
          {adminVisible ? "Ẩn Key Manager" : "Key Manager"}
        </button>

        <button
          type="button"
          onClick={onToggleHistoryAudio}
          className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-white shadow"
        >
          <FaFolderOpen />
          {showHistoryAudio ? "Ẩn lịch sử audio" : "Lịch sử audio"}
        </button>


        <button
          type="button"
          onClick={onOpenWaveform}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-white shadow"
        >
          <FaPlay />
          Dựng Video
        </button>
        <button
          onClick={onGenerate}
          disabled={isBusy}
          className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-white shadow disabled:opacity-60"
        >
          {generateButtonIcon ?? <FaPlay />}
          {generateButtonText}
        </button>
      </div>

      {showMergePanel ? mergePanel : null}
      {adminVisible ? keyManagerPanel : null}
      {showHistoryAudio ? historyAudioPanel : null}
    </div>
  );
}