import React from "react";

type FolderPanelProps = {
  directoryName: string;
  onChooseFolder: () => void;
};

export default function FolderPanel({
  directoryName,
  onChooseFolder
}: FolderPanelProps) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-2 text-sm font-semibold text-slate-800">Thư mục lưu</div>

      <div className="rounded-xl bg-slate-50 break-all px-3 py-3 text-sm text-slate-700">
        {directoryName ? (
          <span title={directoryName}>{directoryName}</span>
        ) : (
          <span className="text-slate-500">Chưa chọn thư mục</span>
        )}
      </div>

      <div className="mt-3">
        <button
          onClick={onChooseFolder}
          type="button"
          className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
        >
          {directoryName ? "Đổi thư mục" : "Chọn thư mục"}
        </button>
      </div>
    </div>
  );
}
0