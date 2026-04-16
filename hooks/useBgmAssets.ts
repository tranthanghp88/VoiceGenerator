import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildBgmTag,
  type BgmAsset,
  loadBgmAssetsLocal,
  normalizeBgmAsset,
  saveBgmAssetsLocal
} from "../services/bgmStorage";

export function useBgmAssets() {
  const [bgmAssets, setBgmAssets] = useState<BgmAsset[]>([]);
  const [loadingBgmAssets, setLoadingBgmAssets] = useState(false);
  const [bgmMessage, setBgmMessage] = useState("");
  const [bgmSearch, setBgmSearch] = useState("");
  const [previewAssetId, setPreviewAssetId] = useState("");
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);

  const revokePreviewUrl = useCallback(() => {
    setPreviewAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const loadBgmAssets = useCallback(async () => {
    setLoadingBgmAssets(true);
    try {
      if (window.electronAPI?.listBgmAssets) {
        const result = await window.electronAPI.listBgmAssets();
        if (result?.ok) {
          const next = Array.isArray(result.assets) ? result.assets.map(normalizeBgmAsset) : [];
          setBgmAssets(next);
          saveBgmAssetsLocal(next);
          return next;
        }
      }

      const fallback = loadBgmAssetsLocal();
      setBgmAssets(fallback);
      return fallback;
    } catch (error: any) {
      const fallback = loadBgmAssetsLocal();
      setBgmAssets(fallback);
      setBgmMessage(error?.message || "Không tải được thư viện BGM.");
      return fallback;
    } finally {
      setLoadingBgmAssets(false);
    }
  }, []);

  useEffect(() => {
    void loadBgmAssets();
    return () => {
      revokePreviewUrl();
    };
  }, [loadBgmAssets, revokePreviewUrl]);

  const importBgmAssets = useCallback(async () => {
    try {
      if (!window.electronAPI?.selectAudioFiles || !window.electronAPI?.importBgmAssets) {
        setBgmMessage("Tính năng import BGM chỉ hỗ trợ trong app desktop.");
        return;
      }

      const picker = await window.electronAPI.selectAudioFiles();
      if (picker?.canceled || !picker?.paths?.length) return;

      const result = await window.electronAPI.importBgmAssets({ files: picker.paths });
      if (!result?.ok) {
        setBgmMessage(result?.error || "Import BGM thất bại.");
        return;
      }

      const next = Array.isArray(result.assets) ? result.assets.map(normalizeBgmAsset) : [];
      setBgmAssets(next);
      saveBgmAssetsLocal(next);
      setBgmMessage(`Đã import ${Number(result.importedCount || 0)} file BGM.`);
    } catch (error: any) {
      setBgmMessage(error?.message || "Import BGM thất bại.");
    }
  }, []);

  const deleteBgmAsset = useCallback(async (assetId: string) => {
    try {
      if (window.electronAPI?.deleteBgmAsset) {
        const result = await window.electronAPI.deleteBgmAsset({ assetId });
        if (!result?.ok) {
          setBgmMessage(result?.error || "Xóa BGM thất bại.");
          return false;
        }

        const next = Array.isArray(result.assets) ? result.assets.map(normalizeBgmAsset) : [];
        setBgmAssets(next);
        saveBgmAssetsLocal(next);
        setBgmMessage("Đã xóa BGM.");
        if (previewAssetId === assetId) {
          setPreviewAssetId("");
          revokePreviewUrl();
        }
        return true;
      }

      const next = bgmAssets.filter((item) => item.id !== assetId);
      setBgmAssets(next);
      saveBgmAssetsLocal(next);
      return true;
    } catch (error: any) {
      setBgmMessage(error?.message || "Xóa BGM thất bại.");
      return false;
    }
  }, [bgmAssets, previewAssetId, revokePreviewUrl]);

  const previewBgmAsset = useCallback(async (asset: BgmAsset | null | undefined) => {
    if (!asset?.filePath || !window.electronAPI?.readAudioFile) return null;

    revokePreviewUrl();
    const result = await window.electronAPI.readAudioFile({ filePath: asset.filePath });
    if (!result?.ok || !result?.arrayBuffer) {
      setBgmMessage(result?.error || "Không đọc được file BGM.");
      return null;
    }

    const blob = new Blob([result.arrayBuffer], { type: result.mimeType || "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    setPreviewAssetId(asset.id);
    setPreviewAudioUrl(url);
    return url;
  }, [revokePreviewUrl]);

  const filteredBgmAssets = useMemo(() => {
    const keyword = bgmSearch.trim().toLowerCase();
    if (!keyword) return bgmAssets;

    return bgmAssets.filter((item) => {
      const haystack = [item.id, item.label, item.category, ...(item.tags || [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [bgmAssets, bgmSearch]);

  return {
    bgmAssets,
    filteredBgmAssets,
    loadingBgmAssets,
    bgmMessage,
    setBgmMessage,
    bgmSearch,
    setBgmSearch,
    previewAssetId,
    previewAudioUrl,
    loadBgmAssets,
    importBgmAssets,
    deleteBgmAsset,
    previewBgmAsset,
    revokePreviewUrl,
    buildBgmTag
  };
}
