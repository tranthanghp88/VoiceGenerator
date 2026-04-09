import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  buildMergePreview,
  createWavBlobFromPcm,
  scanMergePreview,
  type MergePreview
} from "../services/mergeUtils";
import { fallbackDownload } from "../services/ttsPipeline";

type UseFolderMergeArgs = {
  filePrefix: string;
  directoryHandle: any | null;
  directoryName: string;
  setDirectoryHandle: Dispatch<SetStateAction<any | null>>;
  setDirectoryName: Dispatch<SetStateAction<string>>;
  setAudioUrl: Dispatch<SetStateAction<string | null>>;
  setSequence: Dispatch<SetStateAction<number>>;
  showHistoryAudio: boolean;
  scanGeneratedAudioFiles: () => Promise<void>;
};

function isRealDirectoryHandle(handle: any) {
  return !!handle && typeof handle.values === "function";
}

function getFolderNameFromPath(fullPath: string) {
  const normalized = String(fullPath || "").replace(/[\\/]+$/, "");
  const parts = normalized.split(/[\\/]/);
  return parts[parts.length - 1] || normalized;
}

function getMergeSource(directoryHandle: any | null, directoryName: string) {
  if (isRealDirectoryHandle(directoryHandle)) return directoryHandle;
  if (directoryName && window.electronAPI?.listAudioFiles) return directoryName;
  return null;
}

export function useFolderMerge({
  filePrefix,
  directoryHandle,
  directoryName,
  setDirectoryHandle,
  setDirectoryName,
  setAudioUrl,
  setSequence,
  showHistoryAudio,
  scanGeneratedAudioFiles
}: UseFolderMergeArgs) {
  const [mergePreview, setMergePreview] = useState<MergePreview>({
    files: [],
    validFiles: [],
    warnings: [],
    missingSequences: []
  });
  const [scanningMerge, setScanningMerge] = useState(false);
  const [mergeScanMessage, setMergeScanMessage] = useState("");
  const [showMergePanel, setShowMergePanel] = useState(false);

  useEffect(() => {
    const source = getMergeSource(directoryHandle, directoryName);
    if (!source) return;

    const loadMergePreview = async () => {
      try {
        setScanningMerge(true);
        const result = await scanMergePreview(filePrefix.trim() || "Ep01", source);
        setSequence(result.nextSequence);
        setMergePreview(result.preview);
        setMergeScanMessage(result.message);
      } catch (error) {
        console.error(error);
        setMergeScanMessage("Không thể quét danh sách file WAV.");
      } finally {
        setScanningMerge(false);
      }
    };

    loadMergePreview();
  }, [directoryHandle, directoryName, filePrefix, setSequence]);

  async function chooseFolder() {
    try {
      if (window.electronAPI?.selectFolder) {
        const result = await window.electronAPI.selectFolder();

        if (result?.canceled || !result?.path) {
          return;
        }

        const fullPath = result.path;

        setDirectoryHandle(null);
        setDirectoryName(fullPath);
        setMergePreview({
          files: [],
          validFiles: [],
          warnings: [],
          missingSequences: []
        });
        setMergeScanMessage(`Đã chọn thư mục: ${fullPath}`);
        alert("Đã chọn thư mục thành công.");
        return;
      }

      const picker = window.showDirectoryPicker;
      if (!picker) {
        alert(
          "Trình duyệt này chưa hỗ trợ chọn thư mục trực tiếp. Bạn vẫn có thể tải file bình thường."
        );
        return;
      }

      const handle = await picker({
        id: "tts-output-folder",
        mode: "readwrite",
        startIn: "downloads"
      });

      setDirectoryHandle(handle);
      setDirectoryName(handle.name || "");
      setMergeScanMessage("Đã chọn thư mục thành công.");
      alert("Đã chọn thư mục thành công.");
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error(error);
        alert("Không chọn được thư mục.");
      }
    }
  }

  async function saveBlobToChosenFolder(blob: Blob, fileName: string) {
    if (directoryName && !isRealDirectoryHandle(directoryHandle) && window.electronAPI?.saveAudioFile) {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const result = await window.electronAPI.saveAudioFile({
          folderPath: directoryName,
          fileName,
          arrayBuffer
        });

        if (!result?.ok) {
          console.error("saveAudioFile failed:", result?.error || "unknown error");
          return false;
        }

        return true;
      } catch (error) {
        console.error("saveBlobToChosenFolder failed:", error);
        return false;
      }
    }

    if (!directoryHandle || !isRealDirectoryHandle(directoryHandle)) return false;

    try {
      const currentPermission = await directoryHandle.queryPermission?.({
        mode: "readwrite"
      });

      if (currentPermission !== "granted") {
        const requestedPermission = await directoryHandle.requestPermission?.({
          mode: "readwrite"
        });

        if (requestedPermission !== "granted") {
          return false;
        }
      }

      const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      return true;
    } catch (error) {
      console.error("saveBlobToChosenFolder failed:", error);
      return false;
    }
  }

  async function refreshMergePreview() {
    const source = getMergeSource(directoryHandle, directoryName);

    if (!source) {
      if (directoryName) {
        setMergeScanMessage(`Đã chọn thư mục: ${directoryName}`);
      }
      return;
    }

    try {
      setScanningMerge(true);
      const result = await scanMergePreview(filePrefix.trim() || "Ep01", source);
      setSequence(result.nextSequence);
      setMergePreview(result.preview);
      setMergeScanMessage(result.message);
    } finally {
      setScanningMerge(false);
    }
  }

  async function handleOpenMergePanel() {
    const source = getMergeSource(directoryHandle, directoryName);

    if (!source) {
      alert("Bạn cần chọn thư mục trước.");
      return;
    }

    try {
      setScanningMerge(true);
      setMergeScanMessage("Đang quét file sẽ gộp...");

      const result = await scanMergePreview(filePrefix.trim() || "Ep01", source);
      setSequence(result.nextSequence);
      setMergePreview(result.preview);
      setMergeScanMessage(result.message);
      setShowMergePanel(true);
    } catch (error) {
      console.error(error);
      alert("Không thể quét danh sách file để gộp.");
    } finally {
      setScanningMerge(false);
    }
  }

  async function handleMergeFiles(
    setStage: Dispatch<SetStateAction<"idle" | "processing" | "saving" | "done" | "error">>,
    setProgress: Dispatch<SetStateAction<number>>,
    setChunkInfo: Dispatch<
      SetStateAction<{
        done: number;
        total: number;
        eta: string;
        elapsed: string;
      }>
    >
  ) {
    const source = getMergeSource(directoryHandle, directoryName);

    if (!source) {
      alert("Bạn cần chọn thư mục trước.");
      return;
    }

    try {
      setStage("saving");
      setProgress(10);

      const preview = await buildMergePreview(source);
      setMergePreview(preview);

      if (!preview.validFiles.length) {
        setStage("idle");
        setProgress(0);
        alert("Không có file WAV hợp lệ để merge.");
        return;
      }

      const first = preview.validFiles[0];
      const pcmParts: Uint8Array[] = [];
      let totalLength = 0;

      for (let i = 0; i < preview.validFiles.length; i++) {
        const item = preview.validFiles[i];
        const file = await item.handle.getFile();
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const pcm = bytes.slice(44);

        if (!pcm.length) continue;

        pcmParts.push(pcm);
        totalLength += pcm.length;

        const done = i + 1;
        const total = preview.validFiles.length;

        setProgress(10 + Math.round((done / total) * 80));
        setChunkInfo({
          done,
          total,
          eta: "",
          elapsed: `${done}s`
        });
      }

      const merged = new Uint8Array(totalLength);
      let offset = 0;

      for (const part of pcmParts) {
        merged.set(part, offset);
        offset += part.length;
      }

      const folderLabel = directoryName
        ? getFolderNameFromPath(directoryName)
        : filePrefix || "output";

      const finalBlob = createWavBlobFromPcm(
        merged,
        first.sampleRate || 24000,
        first.channels || 1,
        first.bitsPerSample || 16
      );
      const finalName = `${folderLabel || filePrefix || "output"}-final.wav`;

      const saved = await saveBlobToChosenFolder(finalBlob, finalName);
      if (!saved) {
        fallbackDownload(finalBlob, finalName);
      }

      const url = URL.createObjectURL(finalBlob);
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      setProgress(100);
      setChunkInfo({
        done: preview.validFiles.length,
        total: preview.validFiles.length,
        eta: "",
        elapsed: `${preview.validFiles.length}s`
      });
      setStage("done");

      alert(`Đã gộp xong file: ${finalName}`);

      await refreshMergePreview();
      setShowMergePanel(false);

      if (showHistoryAudio) {
        await scanGeneratedAudioFiles();
      }
    } catch (error) {
      console.error(error);
      setStage("error");
      setProgress(0);
      alert("Gộp file thất bại.");
    }
  }

  return {
    mergePreview,
    scanningMerge,
    mergeScanMessage,
    showMergePanel,
    setShowMergePanel,
    chooseFolder,
    handleOpenMergePanel,
    handleMergeFiles,
    refreshMergePreview
  };
}