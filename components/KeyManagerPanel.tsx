import React from "react";
import {
  FaChartBar,
  FaChevronLeft,
  FaChevronRight,
  FaDownload,
  FaFileImport,
  FaKey,
  FaListUl,
  FaSearch,
  FaSortAmountDown,
  FaSpinner,
  FaStethoscope,
  FaSyncAlt,
  FaTimes,
  FaTrash
} from "react-icons/fa";

const KEY_PAGE_SIZES = [10, 25, 50, 100];

type KeyStat = {
  keyId: string;
  maskedKey: string;
  rawKey?: string;
  isActive: boolean;
  lastStatus: string;
  totalSuccess: number;
  totalFail: number;
  totalChars: number;
  lastUsedAt: string | null;
  lastError: string;
  updatedAt: string | null;
  quotaExceededCount?: number;
};

type KeySummary = {
  totalKeys: number;
  activeKeys: number;
  limitedKeys: number;
  invalidKeys: number;
  errorKeys: number;
  totalChars: number;
  totalSuccess: number;
  totalFail: number;
  keys: KeyStat[];
};

type LogItem = {
  id: string;
  time: string;
  type: string;
  keyLabel: string;
  status: string;
  chars: number;
  message: string;
};

type ManagerTab = "summary" | "keys" | "logs";

type KeyManagerPanelProps = {
  show: boolean;
  onClose: () => void;
  currentKey: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImportKeys: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleTestAllKeys: () => Promise<void>;
  handleNormalizeKeys: () => Promise<void>;
  handleRemoveBadKeys: () => Promise<void>;
  handleClearAllKeys: () => Promise<void>;
  handleDeleteSelectedKeys: () => Promise<void>;
  handleDownloadLogs: () => Promise<void>;
  fetchDashboardData: () => Promise<void>;
  testingKeys: boolean;
  normalizingKeys: boolean;
  removingBadKeys: boolean;
  clearingKeys: boolean;
  loadingStats: boolean;
  selectedKeys: string[];
  managerTab: ManagerTab;
  setManagerTab: React.Dispatch<React.SetStateAction<ManagerTab>>;
  keySummary: KeySummary | null;
  recentLogs: LogItem[];
  keySearch: string;
  setKeySearch: React.Dispatch<React.SetStateAction<string>>;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  keyPageSize: number;
  setKeyPageSize: React.Dispatch<React.SetStateAction<number>>;
  pagedKeys: KeyStat[];
  filteredKeys: KeyStat[];
  currentKeyPage: number;
  totalKeyPages: number;
  setKeyPage: React.Dispatch<React.SetStateAction<number>>;
  selectedKeyIdsOnPage: boolean;
  setSelectedKeys: React.Dispatch<React.SetStateAction<string[]>>;
  handleClearLogs: () => Promise<void>;
  clearingLogs: boolean;
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function getStatusBadgeClass(key: KeyStat) {
  if (!key.isActive || key.lastStatus === "invalid") {
    return "bg-red-100 text-red-700 border border-red-200";
  }
  if (key.lastStatus === "limited") {
    return "bg-amber-100 text-amber-700 border border-amber-200";
  }
  if (key.lastStatus === "active" || key.lastStatus === "unknown") {
    return "bg-green-100 text-green-700 border border-green-200";
  }
  return "bg-slate-100 text-slate-700 border border-slate-200";
}

function getRowClass(key: KeyStat, currentKey: string) {
  if (key.keyId === currentKey) return "bg-blue-50";
  if (!key.isActive || key.lastStatus === "invalid") return "bg-red-50";
  if (key.lastStatus === "limited" || key.totalFail > 0) return "bg-amber-50";
  if (key.totalSuccess > 0) return "bg-green-50";
  return "";
}

function UsageChart({ logs }: { logs: LogItem[] }) {
  const bars = React.useMemo(() => {
    const map = new Map<string, number>();

    const recent = [...logs]
      .filter((item) => item.type === "request_success")
      .slice(0, 60)
      .reverse();

    for (const item of recent) {
      const d = new Date(item.time);
      const label = `${String(d.getHours()).padStart(2, "0")}:${String(
        d.getMinutes()
      ).padStart(2, "0")}`;
      map.set(label, (map.get(label) || 0) + 1);
    }

    return Array.from(map.entries()).slice(-12);
  }, [logs]);

  const max = Math.max(1, ...bars.map(([, value]) => value));

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-3 font-semibold">Mức sử dụng theo thời gian</div>

      {!bars.length ? (
        <div className="text-sm text-gray-500">Chưa có dữ liệu.</div>
      ) : (
        <div className="flex h-44 items-end gap-2">
          {bars.map(([label, value]) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-blue-600 via-cyan-500 to-sky-300 shadow"
                style={{ height: `${Math.max(14, (value / max) * 130)}px` }}
                title={`${label}: ${value}`}
              />
              <div className="text-[11px] text-gray-500">{label}</div>
              <div className="text-xs font-semibold">{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  icon
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-2 rounded-xl border px-4 py-2 transition-all",
        active
          ? "border-purple-600 bg-purple-600 text-white shadow"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      ].join(" ")}
    >
      {icon}
      {children}
    </button>
  );
}

export default function KeyManagerPanel({
  show,
  onClose,
  currentKey,
  fileInputRef,
  handleImportKeys,
  handleTestAllKeys,
  handleNormalizeKeys,
  handleRemoveBadKeys,
  handleClearAllKeys,
  handleDeleteSelectedKeys,
  handleDownloadLogs,
  fetchDashboardData,
  testingKeys,
  normalizingKeys,
  removingBadKeys,
  clearingKeys,
  loadingStats,
  selectedKeys,
  managerTab,
  setManagerTab,
  keySummary,
  recentLogs,
  keySearch,
  setKeySearch,
  statusFilter,
  setStatusFilter,
  keyPageSize,
  setKeyPageSize,
  pagedKeys,
  filteredKeys,
  currentKeyPage,
  totalKeyPages,
  setKeyPage,
  selectedKeyIdsOnPage,
  setSelectedKeys,
  handleClearLogs,
  clearingLogs
}: KeyManagerPanelProps) {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  if (!show) return null;

  const badKeyIds = (keySummary?.keys || [])
    .filter((item) => item.lastStatus === "error" || item.lastStatus === "invalid")
    .map((item) => item.keyId);
  const allKeyIds = filteredKeys.map((item) => item.keyId);

  const handleExportKeys = () => {
    const lines = (keySummary?.keys || [])
      .map((item, index) => {
        const label = String(item.keyId || `KEY_${index + 1}`).trim() || `KEY_${index + 1}`;
        const rawKey = String(item.rawKey || "").trim();
        return rawKey ? `${label}=${rawKey}` : "";
      })
      .filter(Boolean);

    if (!lines.length) {
      return;
    }

    const content = lines.join("\n");
    const blob = new Blob(["\uFEFF", content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "keys_export.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const summaryCards = [
    {
      label: "Tổng key",
      value: keySummary?.totalKeys ?? 0,
      className: "border-slate-200 bg-slate-50"
    },
    {
      label: "Active",
      value: keySummary?.activeKeys ?? 0,
      className: "border-green-200 bg-green-50"
    },
    {
      label: "Limited",
      value: keySummary?.limitedKeys ?? 0,
      className: "border-amber-200 bg-amber-50"
    },
    {
      label: "Invalid",
      value: keySummary?.invalidKeys ?? 0,
      className: "border-red-200 bg-red-50"
    },
    {
      label: "Error",
      value: keySummary?.errorKeys ?? 0,
      className: "border-rose-200 bg-rose-50"
    },
    {
      label: "Tổng ký tự",
      value: keySummary?.totalChars ?? 0,
      className: "border-blue-200 bg-blue-50"
    }
  ];

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-lg font-semibold text-slate-800">Key Manager</div>

        <div className="flex items-center gap-2">
          <div className="min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
            <div className="text-xs text-gray-500">Key đang dùng gần nhất</div>
            <div className="text-lg font-bold text-slate-800">{currentKey || "..."}</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-700 shadow-sm hover:bg-slate-50"
            title="Đóng Key Manager"
          >
            <FaTimes />
            Đóng
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          className="hidden"
          onChange={handleImportKeys}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-white shadow hover:bg-slate-800"
        >
          <FaFileImport />
          Import keys.txt
        </button>

        <button
          type="button"
          onClick={handleExportKeys}
          className="flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-white shadow hover:bg-slate-800"
        >
          <FaDownload />
          Export Keys
        </button>

        <button
          type="button"
          onClick={handleTestAllKeys}
          disabled={testingKeys}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-white shadow disabled:opacity-60"
        >
          {testingKeys ? (
            <span className="animate-spin">
              <FaSpinner />
            </span>
          ) : (
            <FaStethoscope />
          )}
          {testingKeys ? "Đang test..." : "Test all keys"}
        </button>

        <button
          type="button"
          onClick={handleNormalizeKeys}
          disabled={normalizingKeys}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-white shadow disabled:opacity-60"
        >
          {normalizingKeys ? (
            <span className="animate-spin">
              <FaSpinner />
            </span>
          ) : (
            <FaSortAmountDown />
          )}
          {normalizingKeys ? "Đang chuẩn hóa..." : "Chuẩn hóa key"}
        </button>
        <button
          type="button"
          onClick={() => setShowDeleteDialog(true)}
          className="flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-white shadow"
        >
          <FaTrash />
          Xóa key
        </button>

        <button
          type="button"
          onClick={handleDownloadLogs}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white shadow"
        >
          <FaDownload />
          Tải log
        </button>

        <button
          type="button"
          onClick={fetchDashboardData}
          className="flex items-center gap-2 rounded-xl bg-slate-600 px-4 py-2 text-white shadow"
        >
          <FaSyncAlt />
          {loadingStats ? "Đang tải..." : "Làm mới trạng thái"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton
          active={managerTab === "summary"}
          onClick={() => setManagerTab("summary")}
          icon={<FaChartBar />}
        >
          Tổng quan
        </TabButton>

        <TabButton
          active={managerTab === "keys"}
          onClick={() => setManagerTab("keys")}
          icon={<FaKey />}
        >
          Keys
        </TabButton>

        <TabButton
          active={managerTab === "logs"}
          onClick={() => setManagerTab("logs")}
          icon={<FaListUl />}
        >
          Logs
        </TabButton>
      </div>

      {managerTab === "summary" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {summaryCards.map((item) => (
              <div
                key={item.label}
                className={`rounded-xl border p-3 shadow-sm ${item.className}`}
              >
                <div className="text-xs text-gray-500">{item.label}</div>
                <div className="text-lg font-bold">{item.value}</div>
              </div>
            ))}
          </div>

          <UsageChart logs={recentLogs} />

          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-2 font-semibold">Tóm tắt nhanh</div>
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-gray-500">Key đang dùng gần nhất</div>
                <div className="mt-1 font-bold text-blue-700">{currentKey || "..."}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-gray-500">Tổng success</div>
                <div className="mt-1 font-bold">{keySummary?.totalSuccess ?? 0}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-gray-500">Tổng fail</div>
                <div className="mt-1 font-bold">{keySummary?.totalFail ?? 0}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {managerTab === "keys" && (
        <div className="space-y-3 rounded-xl border bg-white p-3 shadow-sm">
          <div className="font-semibold">Danh sách key</div>
          <div className="text-sm text-gray-500">
            Mặc định đã chọn sẵn key lỗi, bạn có thể bỏ tích những key không muốn xóa.
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <span className="absolute left-3 top-3 text-gray-400">
                <FaSearch />
              </span>
              <input
                value={keySearch}
                onChange={(e) => setKeySearch(e.target.value)}
                placeholder="Tìm theo KEY_01, lỗi, status..."
                className="w-full rounded-xl border py-2 pl-9 pr-3"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border px-3 py-2"
            >
              <option value="all">Tất cả</option>
              <option value="active">Active</option>
              <option value="limited">Limited</option>
              <option value="invalid">Invalid</option>
              <option value="error">Error</option>
            </select>

            <select
              value={keyPageSize}
              onChange={(e) => setKeyPageSize(Number(e.target.value))}
              className="rounded-xl border px-3 py-2"
            >
              {KEY_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}/trang
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-[460px] overflow-auto rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedKeyIdsOnPage}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedKeys((prev) =>
                            Array.from(
                              new Set([...prev, ...pagedKeys.map((item) => item.keyId)])
                            )
                          );
                        } else {
                          const pageIds = new Set(pagedKeys.map((item) => item.keyId));
                          setSelectedKeys((prev) => prev.filter((id) => !pageIds.has(id)));
                        }
                      }}
                    />
                  </th>
                  <th className="px-3 py-2 text-left">Key</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Success</th>
                  <th className="px-3 py-2 text-right">Fail</th>
                  <th className="px-3 py-2 text-right">Quota hit</th>
                  <th className="px-3 py-2 text-right">Chars</th>
                  <th className="px-3 py-2 text-left">Last used</th>
                  <th className="px-3 py-2 text-left">Last error</th>
                </tr>
              </thead>
              <tbody>
                {pagedKeys.length ? (
                  pagedKeys.map((key) => (
                    <tr
                      key={key.keyId}
                      className={`border-t ${getRowClass(key, currentKey)} ${
                        key.lastStatus === "error" || key.lastStatus === "invalid"
                          ? "ring-1 ring-inset ring-red-200"
                          : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedKeys.includes(key.keyId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedKeys((prev) =>
                                Array.from(new Set([...prev, key.keyId]))
                              );
                            } else {
                              setSelectedKeys((prev) =>
                                prev.filter((id) => id !== key.keyId)
                              );
                            }
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold">
                        {key.maskedKey}
                        {key.keyId === currentKey && (
                          <span className="ml-2 text-xs font-normal text-blue-700">
                            đang dùng
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded px-2 py-1 text-xs font-medium ${getStatusBadgeClass(
                            key
                          )}`}
                        >
                          {key.lastStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{key.totalSuccess}</td>
                      <td className="px-3 py-2 text-right">{key.totalFail}</td>
                      <td className="px-3 py-2 text-right">{key.quotaExceededCount || 0}</td>
                      <td className="px-3 py-2 text-right">{key.totalChars}</td>
                      <td className="px-3 py-2">{formatDateTime(key.lastUsedAt)}</td>
                      <td
                        className="max-w-[260px] truncate px-3 py-2"
                        title={key.lastError || ""}
                      >
                        {key.lastError || "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-4 text-gray-500" colSpan={9}>
                      Không có key phù hợp bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-500">
              Tổng {filteredKeys.length} key • Trang {currentKeyPage}/{totalKeyPages}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setKeyPage((p) => Math.max(1, p - 1))}
                disabled={currentKeyPage <= 1}
                className="flex items-center gap-2 rounded-xl border px-3 py-2 disabled:opacity-50"
              >
                <FaChevronLeft />
                Prev
              </button>

              <button
                type="button"
                onClick={() => setKeyPage((p) => Math.min(totalKeyPages, p + 1))}
                disabled={currentKeyPage >= totalKeyPages}
                className="flex items-center gap-2 rounded-xl border px-3 py-2 disabled:opacity-50"
              >
                Next
                <FaChevronRight />
              </button>
            </div>
          </div>
        </div>
      )}

      {managerTab === "logs" && (
        <div className="space-y-3 rounded-xl border bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-semibold">Log realtime</div>

            <button
              type="button"
              onClick={handleClearLogs}
              disabled={clearingLogs}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-white shadow disabled:opacity-60"
            >
              {clearingLogs ? (
                <span className="animate-spin">
                  <FaSpinner />
                </span>
              ) : (
                <FaTrash />
              )}
              {clearingLogs ? "Đang xóa..." : "Clear log"}
            </button>
          </div>

          <div className="max-h-[460px] space-y-2 overflow-auto rounded-xl border bg-slate-950 p-3 font-mono text-xs text-green-300">
            {recentLogs.length ? (
              recentLogs.map((item) => (
                <div key={item.id} className="border-b border-slate-800 pb-2">
                  <div className="text-slate-400">
                    {formatDateTime(item.time)} | {item.type}
                  </div>
                  <div>
                    KEY [{item.keyLabel}] | STATUS [{item.status}] | chars={item.chars || 0}
                  </div>
                  <div className="text-slate-300">{item.message || "-"}</div>
                </div>
              ))
            ) : (
              <div className="text-slate-400">Chưa có log.</div>
            )}
          </div>
        </div>
      )}
      {showDeleteDialog ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="border-b px-5 py-4">
              <div className="text-lg font-semibold text-slate-800">Xóa key</div>
              <div className="mt-1 text-sm text-slate-500">Chọn key cần xóa.</div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={badKeyIds.length > 0 && badKeyIds.every((id) => selectedKeys.includes(id))} onChange={(e) => {
                  if (e.target.checked) setSelectedKeys(Array.from(new Set([...selectedKeys, ...badKeyIds])));
                  else setSelectedKeys(selectedKeys.filter((id) => !badKeyIds.includes(id)));
                }} />
                Chọn key lỗi
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={allKeyIds.length > 0 && allKeyIds.every((id) => selectedKeys.includes(id))} onChange={(e) => {
                  if (e.target.checked) setSelectedKeys(Array.from(new Set([...selectedKeys, ...allKeyIds])));
                  else setSelectedKeys(selectedKeys.filter((id) => !allKeyIds.includes(id)));
                }} />
                Chọn tất cả
              </label>
              <div className="text-sm text-slate-500">Đã chọn: {selectedKeys.length}</div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-3">
                {filteredKeys.map((key) => (
                  <label key={key.keyId} className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 hover:bg-slate-50">
                    <input type="checkbox" className="mt-1" checked={selectedKeys.includes(key.keyId)} onChange={(e) => {
                      if (e.target.checked) setSelectedKeys((prev) => Array.from(new Set([...prev, key.keyId])));
                      else setSelectedKeys((prev) => prev.filter((id) => id !== key.keyId));
                    }} />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">{key.keyId}</div>
                      <div className="mt-1 text-sm text-slate-500">{key.maskedKey}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-4">
              <button type="button" onClick={() => setShowDeleteDialog(false)} className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800">Đóng</button>
              <button type="button" onClick={async () => { await handleDeleteSelectedKeys(); setShowDeleteDialog(false); }} disabled={!selectedKeys.length} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Xóa ({selectedKeys.length})</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
