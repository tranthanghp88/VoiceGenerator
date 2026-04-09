import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  listAudioFilesFromFolder,
  readAudioFileAsObjectUrl,
  type FolderAudioItem
} from "../utils/audioUtils";

type ElectronFolderAudioItem = Omit<FolderAudioItem, "handle"> & {
  handle: FileSystemFileHandle;
  path?: string;
  source?: "electron" | "browser";
};

type UseAudioHistoryArgs = {
  setAudioUrl: Dispatch<SetStateAction<string | null>>;
};

function isRealDirectoryHandle(handle: any) {
  return !!handle && typeof handle.values === "function";
}

function makeObjectUrlFromBase64(base64: string, mimeType = "audio/wav") {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export function useAudioHistory({ setAudioUrl }: UseAudioHistoryArgs) {
  const [generatedAudioFiles, setGeneratedAudioFiles] = useState<ElectronFolderAudioItem[]>([]);
  const [generatedAudioMessage, setGeneratedAudioMessage] = useState("");
  const [selectedHistoryFile, setSelectedHistoryFile] = useState("");
  const [showHistoryAudio, setShowHistoryAudio] = useState(false);

  const historyAudioUrlRef = useRef<string>("");

  useEffect(() => {
    return () => {
      if (historyAudioUrlRef.current) {
        URL.revokeObjectURL(historyAudioUrlRef.current);
        historyAudioUrlRef.current = "";
      }
    };
  }, []);

  async function scanGeneratedAudioFiles(directoryHandle: any | null, directoryName?: string) {
    // Electron native folder path mode
    if ((!directoryHandle || !isRealDirectoryHandle(directoryHandle)) && directoryName && window.electronAPI?.listAudioFiles) {
      try {
        const result = await window.electronAPI.listAudioFiles({
          folderPath: directoryName
        });

        if (!result?.ok) {
          throw new Error(result?.error || "Không thể quét file audio.");
        }

        const items: ElectronFolderAudioItem[] = (result.files || []).map((item) => ({
  name: item.name,
  size: item.size,
  lastModified: item.modifiedAt ? new Date(item.modifiedAt).getTime() : Date.now(),
  handle: undefined as unknown as FileSystemFileHandle,
  path: item.path,
  source: "electron"
}));

        setGeneratedAudioFiles(items);

        if (!items.length) {
          setGeneratedAudioMessage("Không tìm thấy file audio nào trong thư mục đã chọn.");
          return;
        }

        const first = items[0]?.name || "";
        const last = items[items.length - 1]?.name || "";

        setGeneratedAudioMessage(`Đã quét ${items.length} file audio | từ ${first} -> ${last}`);
        return;
      } catch (error: any) {
        console.error(error);
        setGeneratedAudioFiles([]);
        setGeneratedAudioMessage(error?.message || "Không thể quét file audio.");
        return;
      }
    }

    // Browser File System Access mode
    if (!directoryHandle || !isRealDirectoryHandle(directoryHandle)) {
      setGeneratedAudioFiles([]);
      setGeneratedAudioMessage("Bạn chưa chọn thư mục.");
      return;
    }

    try {
      const items = await listAudioFilesFromFolder(directoryHandle);
      setGeneratedAudioFiles(items);

      if (!items.length) {
        setGeneratedAudioMessage("Không tìm thấy file audio nào trong thư mục đã chọn.");
        return;
      }

      const first = items[0]?.name || "";
      const last = items[items.length - 1]?.name || "";

      setGeneratedAudioMessage(`Đã quét ${items.length} file audio | từ ${first} -> ${last}`);
    } catch (error: any) {
      console.error(error);
      setGeneratedAudioFiles([]);
      setGeneratedAudioMessage(error?.message || "Không thể quét file audio.");
    }
  }

  async function playGeneratedAudioFile(item: ElectronFolderAudioItem) {
    try {
      if (historyAudioUrlRef.current) {
        URL.revokeObjectURL(historyAudioUrlRef.current);
        historyAudioUrlRef.current = "";
      }

      // Electron native file path mode
      if (item.path && window.electronAPI?.readAudioFile) {
        const result = await window.electronAPI.readAudioFile({
          filePath: item.path
        });

        if (!result?.ok || !result?.data) {
          throw new Error(result?.error || "Không thể đọc file audio.");
        }

        const url = makeObjectUrlFromBase64(result.data, result.mimeType || "audio/wav");

        historyAudioUrlRef.current = url;
        setSelectedHistoryFile(item.name);

        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });

        return;
      }

      // Browser File System Access mode
      if (!item.handle) {
        throw new Error("Không tìm thấy handle file audio.");
      }
      const { url } = await readAudioFileAsObjectUrl(item.handle);

      historyAudioUrlRef.current = url;
      setSelectedHistoryFile(item.name);

      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Không thể phát file audio đã tạo.");
    }
  }

  return {
    generatedAudioFiles,
    generatedAudioMessage,
    selectedHistoryFile,
    showHistoryAudio,
    setShowHistoryAudio,
    scanGeneratedAudioFiles,
    playGeneratedAudioFile
  };
}