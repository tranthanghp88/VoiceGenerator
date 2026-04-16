import React from "react";
import { FaMusic, FaPlus, FaSearch, FaTimes, FaTrash, FaVolumeUp } from "react-icons/fa";
import type { BgmAsset } from "../services/bgmStorage";

type BgmManagerDialogProps = {
  show: boolean;
  onClose: () => void;
  assets: BgmAsset[];
  loading: boolean;
  message: string;
  search: string;
  setSearch: (value: string) => void;
  onImport: () => void;
  onDelete: (assetId: string) => void;
  onInsertTag: (asset: BgmAsset) => void;
  insertVolume: string;
  setInsertVolume: (value: string) => void;
  insertDuration: string;
  setInsertDuration: (value: string) => void;
  insertMode: "once" | "loop";
  setInsertMode: (value: "once" | "loop") => void;
  onPreview: (asset: BgmAsset) => void;
  previewAssetId?: string;
  previewAudioUrl?: string | null;
};

export default function BgmManagerDialog({
  show,
  onClose,
  assets,
  loading,
  message,
  search,
  setSearch,
  onImport,
  onDelete,
  onInsertTag,
  insertVolume,
  setInsertVolume,
  insertDuration,
  setInsertDuration,
  insertMode,
  setInsertMode,
  onPreview,
  previewAssetId,
  previewAudioUrl
}: BgmManagerDialogProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">BGM Manager</div>
            <div className="text-sm text-slate-500">Import nhạc nền và chèn tag #BGM vào script.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <FaTimes />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onImport}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              <FaPlus />
              Import BGM
            </button>

            <div className="relative min-w-[240px] flex-1">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên, id, category, tag..."
                className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Volume khi chèn tag</span>
              <input
                value={insertVolume}
                onChange={(e) => setInsertVolume(e.target.value)}
                placeholder="0.25"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Duration (để trống = full file)</span>
              <input
                value={insertDuration}
                onChange={(e) => setInsertDuration(e.target.value)}
                placeholder="vd: 8"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Mode</span>
              <select
                value={insertMode}
                onChange={(e) => setInsertMode((e.target.value === "loop" ? "loop" : "once") as "once" | "loop")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="once">once</option>
                <option value="loop">loop</option>
              </select>
            </label>
          </div>

          {message ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {message}
            </div>
          ) : null}

          <div className="max-h-[56vh] space-y-3 overflow-auto pr-1">
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Đang tải thư viện BGM...
              </div>
            ) : assets.length ? (
              assets.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <FaMusic />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{asset.label}</div>
                          <div className="truncate text-xs text-slate-500">#{asset.id}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {asset.category ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                            {asset.category}
                          </span>
                        ) : null}
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
                          <FaVolumeUp className="mr-1 inline-block" />
                          Vol {Number(asset.defaultVolume ?? 0.25).toFixed(2)}
                        </span>
                        {(asset.tags || []).map((tag) => (
                          <span key={tag} className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="mt-2 break-all text-xs text-slate-400">{asset.fileName}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onPreview(asset)}
                        className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => onInsertTag(asset)}
                        className="rounded-xl bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
                      >
                        Chèn tag
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(asset.id)}
                        className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>

                  {previewAudioUrl && previewAssetId === asset.id ? (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      <audio controls src={previewAudioUrl} className="w-full" />
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                Chưa có asset BGM nào. Hãy import file mp3/wav để bắt đầu.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
