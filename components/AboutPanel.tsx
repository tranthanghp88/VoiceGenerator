import React, { useEffect, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";

type AboutPanelProps = {
  showAbout: boolean;
  setShowAbout: (value: boolean) => void;
};

type UpdateStatus =
  | "idle"
  | "checking"
  | "latest"
  | "available"
  | "downloading"
  | "installing"
  | "error";

export default function AboutPanel({ showAbout, setShowAbout }: AboutPanelProps) {
  const [version, setVersion] = useState("...");
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [text, setText] = useState("Nhấn kiểm tra cập nhật");
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadVersion = async () => {
      try {
        const v = await window.electronAPI?.getVersion?.();
        if (mounted && v) setVersion(v);
      } catch {}
    };

    loadVersion();

    const unsubscribe = window.electronAPI?.onUpdateStatus?.((p: any) => {
      if (p?.error) {
        setStatus("error");
        setText(`Lỗi: ${p.error}`);
        return;
      }

      if (p?.checking) {
        setStatus("checking");
        setText("Đang kiểm tra...");
        return;
      }

      if (p?.downloading) {
        setStatus("downloading");
        setPercent(p.percent || 0);
        setText(`Đang tải... ${Math.round(p.percent || 0)}%`);
        return;
      }

      if (p?.downloaded) {
        setStatus("installing");
        setText("Đang cài đặt...");
        setTimeout(() => {
          window.electronAPI?.quitAndInstallUpdate?.();
        }, 800);
        return;
      }

      if (p?.available) {
        setStatus("downloading");
        setText("Đang tải...");
        window.electronAPI?.downloadUpdate?.();
        return;
      }

      setStatus("latest");
      setText("Không có bản cập nhật mới");
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const handleCheck = async () => {
    try {
      setStatus("checking");
      setText("Đang kiểm tra...");

      const res = await window.electronAPI?.checkForUpdates?.();

      if (res && res.ok === false) {
        const msg = String(res.error || "").toLowerCase();

        if (msg.includes("no published versions")) {
          setStatus("latest");
          setText("Không có bản cập nhật mới");
        } else {
          setStatus("error");
          setText("Lỗi kiểm tra cập nhật");
        }
      }
    } catch {
      setStatus("error");
      setText("Không kiểm tra được cập nhật");
    }
  };

  const loading =
    status === "checking" ||
    status === "downloading" ||
    status === "installing";

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className="relative">
        <button
          onClick={() => setShowAbout(!showAbout)}
          className="border px-3 py-1 text-xs rounded"
        >
          About
        </button>

        {showAbout && (
          <div className="absolute bottom-10 right-0 w-96 bg-white border p-4 rounded-xl shadow-xl">
            <div className="font-semibold">Voice Generator</div>
            <div className="text-xs mt-2">
              Create by Trần Văn Thắng
            </div>
            <div className="flex items-center justify-between text-xs mt-2">
              <span>Version: {version}</span>
            
              <div
                onClick={loading ? undefined : handleCheck}
                className={`flex items-center gap-2 font-semibold ${
                  loading ? "text-gray-400" : "text-blue-600 cursor-pointer"
                }`}
              >
                <FiRefreshCw className={`${loading ? "animate-spin" : ""} text-sm`} />
                Kiểm tra bản cập nhật
              </div>
            </div>

            <div className="mt-3 text-xs bg-gray-100 p-2 rounded">
              {text}
            </div>

            {status === "downloading" && (
              <div className="mt-2 h-2 bg-gray-200 rounded">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}