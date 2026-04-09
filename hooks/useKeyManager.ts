import { useCallback, useEffect, useMemo, useState } from "react";

export type KeyStat = {
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

export type KeySummary = {
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

export type LogItem = {
  id: string;
  time: string;
  type: string;
  keyLabel: string;
  status: string;
  chars: number;
  message: string;
};

export type ManagerTab = "summary" | "keys" | "logs";

const isDesktop = !!window?.electronAPI?.isDesktop;
const API_BASE = isDesktop ? "http://127.0.0.1:3030" : "";

function apiFetch(path: string, options?: RequestInit) {
  return fetch(`${API_BASE}${path}`, options);
}

export function useKeyManager() {
  const [managerTab, setManagerTab] = useState<ManagerTab>("summary");

  const [keySummary, setKeySummary] = useState<KeySummary | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [testingKeys, setTestingKeys] = useState(false);
  const [currentKey, setCurrentKey] = useState("");
  const [recentLogs, setRecentLogs] = useState<LogItem[]>([]);
  const [removingBadKeys, setRemovingBadKeys] = useState(false);
  const [clearingKeys, setClearingKeys] = useState(false);
  const [normalizingKeys, setNormalizingKeys] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  const [keySearch, setKeySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyPage, setKeyPage] = useState(1);
  const [keyPageSize, setKeyPageSize] = useState(10);

    const fetchDashboardData = useCallback(async () => {
    try {
      setLoadingStats(true);

      const [statsRes, logsRes] = await Promise.all([
        apiFetch("/api/key-stats"),
        apiFetch("/api/logs/recent")
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setKeySummary((prev) => {
          const prevJson = JSON.stringify(prev);
          const nextJson = JSON.stringify(statsData);
          return prevJson === nextJson ? prev : statsData;
        });
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        const nextLogs = Array.isArray(logsData.logs) ? logsData.logs : [];
        setRecentLogs((prev) => {
          const prevJson = JSON.stringify(prev);
          const nextJson = JSON.stringify(nextLogs);
          return prevJson === nextJson ? prev : nextLogs;
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    const t = window.setInterval(() => {
      fetchDashboardData();
    }, 4000);

    return () => window.clearInterval(t);
  }, [fetchDashboardData]);

  useEffect(() => {
    const bad =
      keySummary?.keys
        ?.filter((k) => k.lastStatus === "error" || k.lastStatus === "invalid")
        .map((k) => k.keyId) || [];

    setSelectedKeys((prev) => {
      const validLabels = new Set((keySummary?.keys || []).map((k) => k.keyId));
      const preservedManual = prev.filter((label) => validLabels.has(label));
      const merged = Array.from(new Set([...preservedManual, ...bad]));
      const sameLength = merged.length === prev.length;
      const sameItems = sameLength && merged.every((item, index) => item === prev[index]);
      return sameItems ? prev : merged;
    });
  }, [keySummary]);

  useEffect(() => {
    setKeyPage((prev) => (prev === 1 ? prev : 1));
  }, [keySearch, statusFilter, keyPageSize]);

  const filteredKeys = useMemo(() => {
    const all = keySummary?.keys || [];

    return all.filter((item) => {
      const q = keySearch.trim().toLowerCase();

      const matchesSearch =
        !q ||
        item.maskedKey.toLowerCase().includes(q) ||
        item.keyId.toLowerCase().includes(q) ||
        item.lastError.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.lastStatus === "active") ||
        (statusFilter === "limited" && item.lastStatus === "limited") ||
        (statusFilter === "invalid" && item.lastStatus === "invalid") ||
        (statusFilter === "error" && item.lastStatus === "error");

      return matchesSearch && matchesStatus;
    });
  }, [keySummary, keySearch, statusFilter]);

  const totalKeyPages = Math.max(1, Math.ceil(filteredKeys.length / keyPageSize));
  const currentKeyPage = Math.min(keyPage, totalKeyPages);

  const pagedKeys = useMemo(() => {
    const start = (currentKeyPage - 1) * keyPageSize;
    return filteredKeys.slice(start, start + keyPageSize);
  }, [filteredKeys, currentKeyPage, keyPageSize]);

  const selectedKeyIdsOnPage =
    pagedKeys.length > 0 && pagedKeys.every((item) => selectedKeys.includes(item.keyId));



  async function handleImportKeys(file: File) {
    const text = await file.text();

    const res = await apiFetch("/api/import-keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        mode: "replace"
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Import keys thất bại");
    }

    await fetchDashboardData();
    return data;
  }

  async function handleTestAllKeys() {
    setTestingKeys(true);

    try {
      const res = await apiFetch("/api/test-all-keys", {
        method: "POST"
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Test keys thất bại");
      }

      setKeySummary(data.summary);
      await fetchDashboardData();
      return data;
    } finally {
      setTestingKeys(false);
    }
  }

  async function handleRemoveBadKeys() {
    setRemovingBadKeys(true);

    try {
      const res = await apiFetch("/api/keys/remove-bad", {
        method: "POST"
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Xóa key hỏng thất bại");
      }

      await fetchDashboardData();
      return data;
    } finally {
      setRemovingBadKeys(false);
    }
  }

  async function handleDeleteSelectedKeys(labels: string[]) {
    setRemovingBadKeys(true);

    try {
      const res = await apiFetch("/api/keys/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ labels })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Xóa key đã chọn thất bại");
      }

      setSelectedKeys([]);
      await fetchDashboardData();
      return data;
    } finally {
      setRemovingBadKeys(false);
    }
  }

  async function handleClearAllKeys() {
    setClearingKeys(true);

    try {
      const res = await apiFetch("/api/keys/clear", {
        method: "POST"
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Xóa toàn bộ key thất bại");
      }

      setKeySummary(null);
      setCurrentKey("");
      await fetchDashboardData();
      return data;
    } finally {
      setClearingKeys(false);
    }
  }

  async function handleNormalizeKeys() {
    setNormalizingKeys(true);

    try {
      const res = await apiFetch("/api/keys/normalize", {
        method: "POST"
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Chuẩn hóa key thất bại");
      }

      await fetchDashboardData();
      return data;
    } finally {
      setNormalizingKeys(false);
    }
  }

  async function handleClearLogs() {
    setClearingLogs(true);

    try {
      const res = await apiFetch("/api/logs", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Clear log thất bại");
      }

      setRecentLogs([]);
      await fetchDashboardData();
      return data;
    } finally {
      setClearingLogs(false);
    }
  }

  async function handleDownloadLogs() {
    const res = await apiFetch("/api/logs/download");
    const blob = await res.blob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "key-logs.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    managerTab,
    setManagerTab,
    keySummary,
    selectedKeys,
    setSelectedKeys,
    loadingStats,
    testingKeys,
    currentKey,
    setCurrentKey,
    recentLogs,
    removingBadKeys,
    clearingKeys,
    normalizingKeys,
    clearingLogs,
    keySearch,
    setKeySearch,
    statusFilter,
    setStatusFilter,
    keyPage,
    setKeyPage,
    keyPageSize,
    setKeyPageSize,
    filteredKeys,
    totalKeyPages,
    currentKeyPage,
    pagedKeys,
    selectedKeyIdsOnPage,
    fetchDashboardData,
    handleImportKeys,
    handleTestAllKeys,
    handleRemoveBadKeys,
    handleDeleteSelectedKeys,
    handleClearAllKeys,
    handleNormalizeKeys,
    handleClearLogs,
    handleDownloadLogs
  };
}