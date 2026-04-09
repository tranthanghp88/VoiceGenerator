import React from "react";
import { FaExclamationTriangle, FaLayerGroup } from "react-icons/fa";
import {
  formatBytes,
  formatDurationSec,
  getAudioDurationFromMeta
} from "../utils/audioUtils";

type MergePreviewItem = {
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
};

type MergePreview = {
  files: MergePreviewItem[];
  validFiles: MergePreviewItem[];
  warnings: string[];
  missingSequences: number[];
};

type MergePreviewPanelProps = {
  show: boolean;
  mergePreview: MergePreview;
  mergeScanMessage: string;
  isBusy: boolean;
  directoryHandle: any | null;
  directoryName?: string;
  onClose: () => void;
  onMerge: () => void;
};

function pad3(num: number) {
  return String(num).padStart(3, "0");
}

export default function MergePreviewPanel({
  show,
  mergePreview,
  mergeScanMessage,
  isBusy,
  directoryHandle,
  directoryName = "",
  onClose,
  onMerge
}: MergePreviewPanelProps) {
  if (!show) return null;

  const hasSelectedFolder = !!directoryHandle || !!String(directoryName).trim();

  return (
    <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Danh sách file sẽ gộp</div>
          <div className="text-sm text-gray-500">
            Hợp lệ: {mergePreview.validFiles.length} / Tổng: {mergePreview.files.length}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={onMerge}
            disabled={isBusy || !hasSelectedFolder || !mergePreview.validFiles.length}
            className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-white shadow disabled:opacity-60"
          >
            <FaLayerGroup />
            Gộp
          </button>
        </div>
      </div>

      {mergeScanMessage ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
          {mergeScanMessage}
        </div>
      ) : null}

      {mergePreview.warnings.length > 0 && (
        <div className="space-y-2">
          {mergePreview.warnings.map((warning, index) => (
            <div
              key={index}
              className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              <span className="mt-0.5">
                <FaExclamationTriangle />
              </span>
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      <div className="max-h-[300px] overflow-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">File</th>
              <th className="px-3 py-2 text-right">Số thứ tự</th>
              <th className="px-3 py-2 text-right">Tần số (Hz)</th>
              <th className="px-3 py-2 text-right">Thời lượng</th>
              <th className="px-3 py-2 text-right">Dung lượng</th>
              <th className="px-3 py-2 text-left">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {mergePreview.files.length ? (
              mergePreview.files.map((item) => (
                <tr
                  key={item.name}
                  className={`border-t ${item.valid ? "bg-white" : "bg-red-50"}`}
                >
                  <td className="px-3 py-2 font-mono">{item.name}</td>

                  <td className="px-3 py-2 text-right">
                    {item.seq != null ? pad3(item.seq) : "-"}
                  </td>

                  <td className="px-3 py-2 text-right">{item.sampleRate || "-"}</td>

                  <td className="px-3 py-2 text-right">
                    {item.dataBytes && item.sampleRate && item.channels && item.bitsPerSample
                      ? formatDurationSec(
                          getAudioDurationFromMeta(
                            item.dataBytes,
                            item.sampleRate,
                            item.channels,
                            item.bitsPerSample
                          )
                        )
                      : "-"}
                  </td>

                  <td className="px-3 py-2 text-right">
                    {formatBytes(item.dataBytes || 0)}
                  </td>

                  <td className="px-3 py-2">
                    {item.valid ? (
                      <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        Hợp lệ
                      </span>
                    ) : (
                      <span
                        className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                        title={item.reason}
                      >
                        {item.reason || "Lỗi"}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-4 text-gray-500" colSpan={6}>
                  Chưa có dữ liệu. Hãy chọn thư mục rồi bấm Gộp file.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}