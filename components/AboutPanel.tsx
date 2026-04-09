import React, { useEffect, useRef, useState } from "react";
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
  const installQueuedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const loadVersion = async () => {
      try {
        const v = await window.electronAPI?.getVersion?.();
        if (mounted && v) setVersion(v);
      } catch {}
    };

    const loadUpdateState = async () => {
      try {
        const p = await window.electronAPI?.getUpdateStatus?.();
        if (!mounted || !p) return;

        if (p.error) {
          setStatus("error");
          setText(`Lỗi: ${p.error}`);
          return;
        }

        if (p.downloaded) {
          setStatus("installing");
          setPercent(100);
          setText("Đang cài đặt và khởi động lại...");
          return;
        }

        if (p.downloading) {
          setStatus("downloading");
          setPercent(p.percent || 0);
          setText(`Đang tải cập nhật... ${Math.round(p.percent || 0)}%`);
          return;
        }

        if (p.checking) {
          setStatus("checking");
          setText("Đang kiểm tra cập nhật...");
          return;
        }
      } catch {}
    };

    loadVersion();
    loadUpdateState();

    const unsubscribe = window.electronAPI?.onUpdateStatus?.((p: any) => {
      if (p?.error) {
        setStatus("error");
        setText(`Lỗi: ${p.error}`);
        return;
      }

      if (p?.checking) {
        installQueuedRef.current = false;
        setPercent(0);
        setStatus("checking");
        setText("Đang kiểm tra cập nhật...");
        return;
      }

      if (p?.downloading) {
        setStatus("downloading");
        setPercent(p.percent || 0);
        setText(`Đang tải cập nhật... ${Math.round(p.percent || 0)}%`);
        return;
      }

      if (p?.downloaded || p?.installNow) {
        setStatus("installing");
        setPercent(100);
        setText("Đang cài đặt và khởi động lại...");

        if (!installQueuedRef.current) {
          installQueuedRef.current = true;
          setTimeout(() => {
            window.electronAPI?.quitAndInstallUpdate?.();
          }, 900);
        }
        return;
      }

      if (p?.available) {
        setStatus("downloading");
        setPercent(0);
        setText("Đã có bản cập nhật mới. Bắt đầu tải...");
        window.electronAPI?.downloadUpdate?.();
        return;
      }

      installQueuedRef.current = false;
      setPercent(0);
      setStatus("latest");
      setText("Không có bản cập nhật mới");
    });

    return () => {
      mounted = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const handleCheck = async () => {
    try {
      installQueuedRef.current = false;
      setPercent(0);
      setStatus("checking");
      setText("Đang kiểm tra cập nhật...");

      const res = await window.electronAPI?.checkForUpdates?.();

      if (res && res.ok === false) {
        const raw = String(res.error || "");
        const msg = raw.toLowerCase();

        if (
          msg.includes("no published versions") ||
          msg.includes("latest version") ||
          msg.includes("update-not-available")
        ) {
          setStatus("latest");
          setText("Không có bản cập nhật mới");
        } else {
          setStatus("error");
          setText(`Lỗi: ${raw || "Không kiểm tra được cập nhật"}`);
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
            <div className="text-xs mt-2">Create by Trần Văn Thắng</div>

            <div className="flex items-center justify-between text-xs mt-2 gap-3">
              <span>Version: {version}</span>

              <button
                type="button"
                onClick={loading ? undefined : handleCheck}
                className={`flex items-center gap-2 font-semibold ${
                  loading ? "text-gray-400 cursor-default" : "text-blue-600 cursor-pointer"
                }`}
              >
                <span className={loading ? "animate-spin" : ""}>
                  <FiRefreshCw className="text-sm" />
                </span>
                Kiểm tra bản cập nhật
              </button>
            </div>

            <div className="mt-3 text-xs bg-gray-100 p-2 rounded">{text}</div>

            {(status === "downloading" || status === "installing") && (
              <div className="mt-2 h-2 bg-gray-200 rounded overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
