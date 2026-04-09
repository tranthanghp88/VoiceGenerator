import React from "react";
import { FaEdit, FaSave } from "react-icons/fa";
import { pad3 } from "../services/mergeUtils";

type FileInfoPanelProps = {
  filePrefix: string;
  filePrefixDraft: string;
  setFilePrefixDraft: (value: string) => void;
  setFilePrefix: (value: string) => void;
  isFilePrefixSaved: boolean;
  setIsFilePrefixSaved: (value: boolean) => void;
  sequence: number;
  onSaveFilePrefix: () => void;
  onOpenRenameDialog: () => void;
};

export default function FileInfoPanel({
  filePrefix,
  filePrefixDraft,
  setFilePrefixDraft,
  setFilePrefix,
  isFilePrefixSaved,
  setIsFilePrefixSaved,
  sequence,
  onSaveFilePrefix,
  onOpenRenameDialog
}: FileInfoPanelProps) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-2 text-sm font-semibold text-slate-800">Tên file</div>

      {!isFilePrefixSaved ? (
        <>
          <div className="flex gap-2">
            <input
              value={filePrefixDraft}
              onChange={(e) => {
                setFilePrefixDraft(e.target.value);
                setFilePrefix(e.target.value);
                setIsFilePrefixSaved(false);
              }}
              className="flex-1 rounded-xl border px-3 py-2"
              placeholder="Ví dụ: Ep01"
            />

            <button
              type="button"
              onClick={onSaveFilePrefix}
              disabled={!filePrefixDraft.trim()}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700 disabled:opacity-60"
            >
              <FaSave />
              Save
            </button>
          </div>

          <div className="mt-2 text-xs text-amber-600">Tên file chưa được lưu.</div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500">Tên file hiện tại</div>
            <div className="truncate font-semibold text-slate-800" title={filePrefix}>
              {filePrefix}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenRenameDialog}
            className="flex items-center gap-2 rounded-xl bg-slate-700 px-3 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
          >
            <FaEdit />
            Change
          </button>
        </div>
      )}

      <div className="mt-2 text-xs text-slate-500">
        File sẽ lưu theo dạng:{" "}
        <span className="font-semibold text-slate-700">
          {(filePrefixDraft || filePrefix || "Ep01").trim() || "Ep01"}-{pad3(sequence)}.wav
        </span>
      </div>
    </div>
  );
}