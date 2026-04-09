import React, { useEffect, useMemo, useRef, useState } from "react";
import MergePreviewPanel from "./components/MergePreviewPanel";
import HistoryAudioPanel from "./components/HistoryAudioPanel";
import KeyManagerPanel from "./components/KeyManagerPanel";
import PresetPanel from "./components/PresetPanel";
import AppActionPanels from "./components/AppActionPanels";
import AudioProgressPanel from "./components/AudioProgressPanel";
import VoiceManagerDialog from "./components/VoiceManagerDialog";
import ScriptEditorPanel from "./components/ScriptEditorPanel";
import AudioPlayerPanel from "./components/AudioPlayerPanel";
import AboutPanel from "./components/AboutPanel";
import {
  FaCheck,
  FaChevronDown,
  FaChevronUp,
  FaMicrophone,
  FaPlay,
  FaSpinner
} from "react-icons/fa";
import { useKeyManager } from "./hooks/useKeyManager";
import { useTtsJob, type ScriptLine } from "./hooks/useTtsJob";
import { useAudioHistory } from "./hooks/useAudioHistory";
import { useFolderMerge } from "./hooks/useFolderMerge";
import { useKeyManagerActions } from "./hooks/useKeyManagerActions";
import { useVoiceManager } from "./hooks/useVoiceManager";
import { useSpeakerPresetManager } from "./hooks/useSpeakerPresetManager";
import { usePresetPanelBridge } from "./hooks/usePresetPanelBridge";
import { getVoiceModeFromType } from "./services/voiceUtils";
import { getTextPlaceholder } from "./services/speakerPresets";

const MAX_CHARS = 12000;
const PREVIEW_COOLDOWN_MS = 3000;
const LAST_FILE_PREFIX_KEY = "easy-english-voice-generator-last-file-prefix";
const LAST_DIRECTORY_NAME_KEY = "easy-english-voice-generator-last-directory-name";

function loadLocalText(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  try {
    const value = String(window.localStorage.getItem(key) || "").trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

function parseScript(raw: string): ScriptLine[] {
  const blocks = raw
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const lines: ScriptLine[] = [];

  blocks.forEach((block, blockIndex) => {
    const blockLines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    let pendingMarkers: string[] = [];

    blockLines.forEach((line) => {
      if (line.startsWith("#")) {
        pendingMarkers.push(line);
        return;
      }

      const bothPrefix = line.match(/^(A\+R|BOTH):\s*/i);
      if (bothPrefix) {
        const text = line.slice(bothPrefix[0].length).trim();
        const mergedText = [...pendingMarkers, text].filter(Boolean).join(" ").trim();

        lines.push({
          role: "BOTH" as const,
          text: mergedText,
          blockId: blockIndex + 1
        } as ScriptLine);

        pendingMarkers = [];
        return;
      }

      if (line.startsWith("A:")) {
        const text = line.slice(2).trim();
        const mergedText = [...pendingMarkers, text].filter(Boolean).join(" ").trim();

        lines.push({
          role: "A" as const,
          text: mergedText,
          blockId: blockIndex + 1
        } as ScriptLine);

        pendingMarkers = [];
        return;
      }

      if (line.startsWith("R:")) {
        const text = line.slice(2).trim();
        const mergedText = [...pendingMarkers, text].filter(Boolean).join(" ").trim();

        lines.push({
          role: "R" as const,
          text: mergedText,
          blockId: blockIndex + 1
        } as ScriptLine);

        pendingMarkers = [];
      }
    });
  });

  return lines.filter((item) => !!item.text);
}

function buildSingleVoiceScript(raw: string): ScriptLine[] {
  const blocks = raw
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const lines: ScriptLine[] = [];

  blocks.forEach((block, blockIndex) => {
    const blockLines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    let pendingMarkers: string[] = [];
    let textParts: string[] = [];

    blockLines.forEach((line) => {
      if (line.startsWith("#")) {
        pendingMarkers.push(line);
        return;
      }

      if (/^(A\+R|BOTH):/i.test(line)) {
        const normalized = line.replace(/^(A\+R|BOTH):\s*/i, "").trim();
        if (normalized) textParts.push(normalized);
        return;
      }

      if (line.startsWith("A:") || line.startsWith("R:")) {
        const normalized = line.slice(2).trim();
        if (normalized) textParts.push(normalized);
        return;
      }

      textParts.push(line);
    });

    const mergedText = [...pendingMarkers, ...textParts].filter(Boolean).join(" ").trim();

    if (mergedText) {
      lines.push({
        role: "A",
        text: mergedText,
        blockId: blockIndex + 1
      });
    }
  });

  return lines;
}

export default function App() {
  const [text, setText] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [filePrefix, setFilePrefix] = useState(() =>
    loadLocalText(LAST_FILE_PREFIX_KEY, "Ep01")
  );
  const [filePrefixDraft, setFilePrefixDraft] = useState(() =>
    loadLocalText(LAST_FILE_PREFIX_KEY, "Ep01")
  );
  const [isFilePrefixSaved, setIsFilePrefixSaved] = useState(
    () => loadLocalText(LAST_FILE_PREFIX_KEY, "") !== ""
  );
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameDraft, setRenameDraft] = useState("Ep01");

  const [sequence, setSequence] = useState(1);

  const [directoryHandle, setDirectoryHandle] = useState<any | null>(null);
  const [directoryName, setDirectoryName] = useState(() =>
    loadLocalText(LAST_DIRECTORY_NAME_KEY, "")
  );

  const [adminVisible, setAdminVisible] = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(true);
  const [showStoragePanel, setShowStoragePanel] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const {
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
    setKeyPage,
    keyPageSize,
    setKeyPageSize,
    filteredKeys,
    totalKeyPages,
    currentKeyPage,
    pagedKeys,
    selectedKeyIdsOnPage,
    fetchDashboardData,
    handleImportKeys: importKeysFromHook,
    handleTestAllKeys: testAllKeysFromHook,
    handleRemoveBadKeys: removeBadKeysFromHook,
    handleDeleteSelectedKeys: deleteSelectedKeysFromHook,
    handleClearAllKeys: clearAllKeysFromHook,
    handleNormalizeKeys: normalizeKeysFromHook,
    handleClearLogs: clearLogsFromHook,
    handleDownloadLogs
  } = useKeyManager();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const script = useMemo(() => parseScript(text), [text]);

  const {
    generatedAudioFiles,
    generatedAudioMessage,
    selectedHistoryFile,
    showHistoryAudio,
    setShowHistoryAudio,
    scanGeneratedAudioFiles,
    playGeneratedAudioFile
  } = useAudioHistory({
    setAudioUrl
  });

  const scanAudioHistory = () => scanGeneratedAudioFiles(directoryHandle, directoryName);
  const hasSelectedFolder = !!directoryHandle || !!directoryName;

  const {
    mergePreview,
    scanningMerge,
    mergeScanMessage,
    showMergePanel,
    setShowMergePanel,
    chooseFolder,
    handleOpenMergePanel,
    handleMergeFiles,
    refreshMergePreview
  } = useFolderMerge({
    filePrefix,
    directoryHandle,
    directoryName,
    setDirectoryHandle,
    setDirectoryName,
    setAudioUrl,
    setSequence,
    showHistoryAudio,
    scanGeneratedAudioFiles: scanAudioHistory
  });

  const {
    stage,
    setStage,
    progress,
    chunkInfo,
    setProgress,
    setChunkInfo,
    jobStatus,
    stageText,
    isBusy,
    stopGeneration,
    handleGenerate
  } = useTtsJob({
    filePrefix,
    sequence,
    audioUrl,
    setAudioUrl,
    directoryHandle,
    directoryName,
    showHistoryAudio,
    fetchDashboardData,
    setCurrentKey,
    setSequence,
    refreshMergePreview,
    scanGeneratedAudioFiles: scanAudioHistory
  });

  const {
    showPresetPanel,
    setShowPresetPanel,
    format,
    setFormat,
    language,
    setLanguage,
    voiceProfile,
    setVoiceProfile,
    uiProfileDirty,
    speakerSettings,
    setSpeakerSettings,
    voiceType,
    setVoiceType,
    voiceName,
    setVoiceName,
    useVoiceDefaultPreset,
    setUseVoiceDefaultPreset,
    savedPresets,
    selectedPreset,
    selectedPresetId,
    presetMessage,
    setPresetMessage,
    handleSavePreset,
    handleImportPresets,
    handleLoadPreset,
    handleDeletePreset,
    handleDeleteSelectedPresets,
    handleApplyUiProfile,
    getPresetModified,
    defaultSpeakerSettings
  } = useSpeakerPresetManager();

  const {
    voiceCatalog,
    voiceType: vmVoiceType,
    setVoiceType: setVmVoiceType,
    voiceName: vmVoiceName,
    setVoiceName: setVmVoiceName,
    customVoiceItems,
    filteredCustomVoiceItems,
    selectedCustomVoiceIds,
    selectedCustomVoiceSet,
    selectedVoiceId,
    setSelectedVoiceId,
    selectedFormat,
    setSelectedFormat,
    selectedLanguage,
    setSelectedLanguage,
    selectedVoiceType,
    setSelectedVoiceType,
    voiceConfigDraft,
    setVoiceConfigDraft,
    isVoiceConfigDirty,
    handleSaveVoiceConfig,
    formatItems,
    activeManagedVoice,
    showAddVoiceDialog,
    addVoiceError,
    addVoiceForm,
    setAddVoiceForm,
    isPreviewingVoice,
    activeVoiceInfo,
    handleOpenAddVoiceDialog,
    handleCloseAddVoiceDialog,
    handleCreateVoice,
    handleImportVoices,
    handlePreviewVoice,
    handleToggleCustomVoiceSelected,
    handleSelectAllCustomVoices,
    handleClearSelectedCustomVoices,
    handleDeleteSelectedCustomVoices,
    handleAddFormatItem,
    handleUpdateFormatItemLabel,
    handleToggleFormatItemChecked,
    handleDeleteCheckedFormatItems,
    handleSaveFormatItems
  } = useVoiceManager({
    language,
    isBusy,
    speakerSettings,
    parseScript,
    handleGenerate: async (previewText, previewScript, previewSpeakerSettings, options) => {
      return await (handleGenerate as any)(
        previewText,
        previewScript,
        previewSpeakerSettings,
        options
      );
    },
    previewCooldownMs: PREVIEW_COOLDOWN_MS,
    setPresetMessage,
    currentPresets: savedPresets,
    onImportPresets: handleImportPresets,
    onDeleteImportedVoicePresets: (voiceIds: string[]) => {
      const presetIdsToDelete = savedPresets
        .filter(
          (item) =>
            item.importedFromVoice &&
            voiceIds.includes(String(item.voiceName || "").trim())
        )
        .map((item) => item.id);

      if (presetIdsToDelete.length) {
        handleDeleteSelectedPresets(presetIdsToDelete);
      }
    }
  });

  const effectiveFormatItems =
    Array.isArray(formatItems) && formatItems.length
      ? formatItems
      : [
          { id: "podcast", label: "Podcast", checked: false },
          { id: "single", label: "Single", checked: false }
        ];

  const {
    panelVoiceType,
    panelVoiceName,
    panelPresetModified,
    handlePanelVoiceTypeChange,
    handlePanelVoiceNameChange,
    handlePanelSavePreset
  } = usePresetPanelBridge({
    voiceType,
    setVoiceType,
    voiceName,
    setVoiceName,
    vmVoiceType,
    setVmVoiceType,
    vmVoiceName,
    setVmVoiceName,
    getPresetModified,
    handleSavePreset
  });

  const {
    handleImportKeys,
    handleTestAllKeys,
    handleRemoveBadKeys,
    handleDeleteSelectedKeys,
    handleClearAllKeys,
    handleNormalizeKeys,
    handleClearLogs
  } = useKeyManagerActions({
    selectedKeys,
    importKeysFromHook,
    testAllKeysFromHook,
    removeBadKeysFromHook,
    deleteSelectedKeysFromHook,
    clearAllKeysFromHook,
    normalizeKeysFromHook,
    clearLogsFromHook,
    fileInputRef
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAdminVisible((prev) => !prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    try {
      const normalized = String(filePrefix || filePrefixDraft || "Ep01").trim() || "Ep01";
      window.localStorage.setItem(LAST_FILE_PREFIX_KEY, normalized);
    } catch {}
  }, [filePrefix, filePrefixDraft]);

  useEffect(() => {
    try {
      const normalized = String(directoryName || "").trim();
      if (normalized) {
        window.localStorage.setItem(LAST_DIRECTORY_NAME_KEY, normalized);
      } else {
        window.localStorage.removeItem(LAST_DIRECTORY_NAME_KEY);
      }
    } catch {}
  }, [directoryName]);

  useEffect(() => {
    if (!audioUrl || !audioRef.current) return;

    const playNow = async () => {
      try {
        audioRef.current!.currentTime = 0;
        await audioRef.current!.play();
      } catch (error) {
        console.warn("Autoplay blocked:", error);
      }
    };

    playNow();
  }, [audioUrl]);

  const supportsDirectoryPicker =
    typeof window !== "undefined" && "showDirectoryPicker" in window;

  const generateButtonText = isBusy ? stageText : text.trim() ? "Tạo giọng" : stageText;
  const generateButtonIcon = isBusy ? (
    <span className="animate-spin">
      <FaSpinner />
    </span>
  ) : text.trim() ? (
    <FaPlay />
  ) : stage === "done" ? (
    <FaCheck />
  ) : (
    <FaPlay />
  );

  const handleToggleMergePanel = async () => {
    if (showMergePanel) {
      setShowMergePanel(false);
      return;
    }
    await handleOpenMergePanel();
  };

  const handleSaveFilePrefix = () => {
    const normalized = filePrefixDraft.trim();
    if (!normalized) return;
    setFilePrefix(normalized);
    setFilePrefixDraft(normalized);
    setIsFilePrefixSaved(true);
  };

  const handleOpenRenameDialog = () => {
    setRenameDraft(filePrefix);
    setShowRenameDialog(true);
  };

  const handleConfirmRename = () => {
    const normalized = renameDraft.trim();
    if (!normalized) return;
    setFilePrefix(normalized);
    setFilePrefixDraft(normalized);
    setIsFilePrefixSaved(true);
    setShowRenameDialog(false);
  };

  const handleCancelRename = () => {
    setRenameDraft(filePrefix);
    setShowRenameDialog(false);
  };

  const selectedVoiceItem = useMemo(() => {
    return (
      customVoiceItems.find((item) => item.id === selectedVoiceId) ||
      filteredCustomVoiceItems.find((item) => item.id === selectedVoiceId) ||
      activeManagedVoice ||
      null
    );
  }, [activeManagedVoice, customVoiceItems, filteredCustomVoiceItems, selectedVoiceId]);

  const handleVoicePanelFormatChange = (value: string) => {
    setSelectedFormat((prev) => (prev === value ? prev : value));
    if (
      value === "podcast" ||
      value === "single" ||
      value === "teaching" ||
      value === "kids"
    ) {
      if (format !== value) {
        setFormat(value);
      }
    }

    if (value === "podcast") {
      setSelectedVoiceType("podcast");
      if (vmVoiceType !== "podcast") setVmVoiceType("podcast");
      if (voiceType !== "podcast") setVoiceType("podcast");
      return;
    }

    const defaultType = "englishFemale";
    if (selectedVoiceType === "podcast") {
      setSelectedVoiceType(defaultType);
      if (vmVoiceType !== defaultType) setVmVoiceType(defaultType);
      if (voiceType !== defaultType) setVoiceType(defaultType);
    }
  };

  useEffect(() => {
    if (showAddVoiceDialog) return;
    if (!format) return;
    if (selectedFormat === format) return;
    setSelectedFormat(format);
  }, [format, selectedFormat, setSelectedFormat, showAddVoiceDialog]);

  const handleVoicePanelLanguageChange = (value: "en" | "vi") => {
    setSelectedLanguage((prev) => (prev === "en" ? prev : "en"));

    if (selectedFormat === "podcast") {
      return;
    }

    const defaultType = "englishFemale";
    setSelectedVoiceType((prev) => (prev === defaultType ? prev : defaultType));
    if (vmVoiceType !== defaultType) setVmVoiceType(defaultType);
    if (voiceType !== defaultType) setVoiceType(defaultType);

    const nextVoice =
      customVoiceItems.find(
        (item) =>
          item.voiceType === defaultType &&
          String(item.formatId || "single") === String(selectedFormat || "single")
      ) ||
      filteredCustomVoiceItems.find((item) => item.voiceType === defaultType) ||
      null;

    if (nextVoice?.id) {
      setSelectedVoiceId(nextVoice.id);
      if (vmVoiceName !== nextVoice.id) setVmVoiceName(nextVoice.id);
      if (voiceName !== nextVoice.id) setVoiceName(nextVoice.id);
    }
  };

  const handleVoicePanelVoiceTypeChange = (value: any) => {
    setSelectedVoiceType(value);
    if (vmVoiceType !== value) setVmVoiceType(value);
    if (voiceType !== value) setVoiceType(value);

    const nextVoice =
      customVoiceItems.find(
        (item) =>
          item.voiceType === value &&
          (String(item.formatId || "single").trim() || "single") === String(selectedFormat || "single")
      ) ||
      filteredCustomVoiceItems.find((item) => item.voiceType === value) ||
      customVoiceItems.find((item) => item.voiceType === value) ||
      null;

    if (nextVoice?.id) {
      setSelectedVoiceId(nextVoice.id);
      if (vmVoiceName !== nextVoice.id) setVmVoiceName(nextVoice.id);
      if (voiceName !== nextVoice.id) setVoiceName(nextVoice.id);
    }
  };

  const handleVoicePanelVoiceChange = (voiceId: string) => {
    const nextVoice =
      customVoiceItems.find((item) => item.id === voiceId) ||
      filteredCustomVoiceItems.find((item) => item.id === voiceId) ||
      null;

    setSelectedVoiceId(voiceId);
    if (vmVoiceName !== voiceId) setVmVoiceName(voiceId);
    if (voiceName !== voiceId) setVoiceName(voiceId);

    if (nextVoice?.formatId && nextVoice.formatId !== selectedFormat) {
      setSelectedFormat(nextVoice.formatId);
      if (format !== nextVoice.formatId) setFormat(nextVoice.formatId as any);
    }

    if (nextVoice?.voiceType) {
      setSelectedVoiceType(nextVoice.voiceType);
      if (vmVoiceType !== nextVoice.voiceType) setVmVoiceType(nextVoice.voiceType);
      if (voiceType !== nextVoice.voiceType) setVoiceType(nextVoice.voiceType);

      const nextLanguage =
        nextVoice.voiceType === "podcast" ? selectedLanguage : "en";
      if (nextLanguage !== selectedLanguage) {
        setSelectedLanguage(nextLanguage);
      }
    }
  };

  const selectedVoiceTypeValue = String(selectedVoiceType || "");
  const voicePanelVoiceTypeKey =
    selectedVoiceTypeValue === "englishMale"
      ? "male"
      : selectedVoiceTypeValue === "podcast"
        ? "podcast"
        : "female";

  const voicePanelVoiceOptions = useMemo(() => {
    return customVoiceItems.filter((item) => {
      const itemFormatId = String(item.formatId || "single").trim() || "single";
      if (itemFormatId !== String(selectedFormat || "single")) return false;
      if (selectedFormat === "podcast") return item.voiceType === "podcast";
      return voicePanelVoiceTypeKey === "male"
        ? item.voiceType === "englishMale"
        : item.voiceType === "englishFemale";
    });
  }, [customVoiceItems, selectedFormat, voicePanelVoiceTypeKey]);


  const isPodcastGenerate = format === "podcast";

  const buildGenerateScript = () => {
    if (isPodcastGenerate) return script;

    const mode = getVoiceModeFromType(
      selectedVoiceItem?.voiceType || selectedVoiceType || vmVoiceType || voiceType
    );
    return mode === "single" ? buildSingleVoiceScript(text) : script;
  };

  const currentGenerateVoiceType = isPodcastGenerate
    ? "podcast"
    : selectedVoiceItem?.voiceType ||
      activeManagedVoice?.voiceType ||
      selectedVoiceType ||
      vmVoiceType ||
      voiceType ||
      "englishFemale";

  const catalogVoiceMatch =
    (voiceCatalog?.[currentGenerateVoiceType] || []).find(
      (item) => item.id === voiceName || item.apiId === voiceName
    ) || null;

  const currentGenerateVoiceApiId = isPodcastGenerate
    ? ""
    : selectedVoiceItem?.apiId ||
      activeManagedVoice?.apiId ||
      activeVoiceInfo?.apiId ||
      catalogVoiceMatch?.apiId ||
      voiceName ||
      "";

  const currentGenerateVoiceMode = isPodcastGenerate
    ? "podcast"
    : getVoiceModeFromType(currentGenerateVoiceType);

  const finalGenerateSpeakerSettings = useVoiceDefaultPreset
    ? {
        A: {
          speed: Number(voiceConfigDraft?.A?.speed ?? speakerSettings.A.speed),
          pitch: Number(voiceConfigDraft?.A?.pitch ?? speakerSettings.A.pitch),
          pause: Number(voiceConfigDraft?.A?.pause ?? speakerSettings.A.pause),
          style: String(voiceConfigDraft?.A?.style ?? speakerSettings.A.style ?? "")
        },
        R: {
          speed: Number(voiceConfigDraft?.R?.speed ?? speakerSettings.R.speed),
          pitch: Number(voiceConfigDraft?.R?.pitch ?? speakerSettings.R.pitch),
          pause: Number(voiceConfigDraft?.R?.pause ?? speakerSettings.R.pause),
          style: String(voiceConfigDraft?.R?.style ?? speakerSettings.R.style ?? "")
        },
        blockPause: speakerSettings.blockPause
      }
    : {
        A: {
          speed: Number(speakerSettings.A.speed),
          pitch: Number(speakerSettings.A.pitch),
          pause: Number(speakerSettings.A.pause),
          style: String(speakerSettings.A.style ?? "")
        },
        R: {
          speed: Number(speakerSettings.R.speed),
          pitch: Number(speakerSettings.R.pitch),
          pause: Number(speakerSettings.R.pause),
          style: String(speakerSettings.R.style ?? "")
        },
        blockPause: speakerSettings.blockPause
      };

  const currentGenerateVoiceDebug = {
    selectedVoiceId,
    selectedVoiceType,
    vmVoiceType,
    vmVoiceName,
    voiceType,
    voiceName,
    selectedVoiceItemId: selectedVoiceItem?.id || "",
    selectedVoiceItemApiId: selectedVoiceItem?.apiId || "",
    activeManagedVoiceId: activeManagedVoice?.id || "",
    activeManagedVoiceApiId: activeManagedVoice?.apiId || "",
    currentGenerateVoiceType,
    currentGenerateVoiceApiId,
    currentGenerateVoiceMode,
    isPodcastGenerate,
    format,
    selectedFormat,
    finalGenerateSpeakerSettings
  };

  const mergePanelNode = (
    <MergePreviewPanel
      show={showMergePanel}
      mergePreview={mergePreview}
      mergeScanMessage={mergeScanMessage}
      isBusy={isBusy}
      directoryHandle={directoryHandle}
      directoryName={directoryName}
      onClose={() => setShowMergePanel(false)}
      onMerge={() => handleMergeFiles(setStage, setProgress, setChunkInfo)}
    />
  );

  const keyManagerPanelNode = (
    <KeyManagerPanel
      show={adminVisible}
      onClose={() => setAdminVisible(false)}
      currentKey={currentKey}
      fileInputRef={fileInputRef}
      handleImportKeys={handleImportKeys}
      handleTestAllKeys={handleTestAllKeys}
      handleNormalizeKeys={handleNormalizeKeys}
      handleRemoveBadKeys={handleRemoveBadKeys}
      handleClearAllKeys={handleClearAllKeys}
      handleDeleteSelectedKeys={handleDeleteSelectedKeys}
      handleDownloadLogs={handleDownloadLogs}
      fetchDashboardData={fetchDashboardData}
      testingKeys={testingKeys}
      normalizingKeys={normalizingKeys}
      removingBadKeys={removingBadKeys}
      clearingKeys={clearingKeys}
      loadingStats={loadingStats}
      selectedKeys={selectedKeys}
      managerTab={managerTab}
      setManagerTab={setManagerTab}
      keySummary={keySummary}
      recentLogs={recentLogs}
      keySearch={keySearch}
      setKeySearch={setKeySearch}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      keyPageSize={keyPageSize}
      setKeyPageSize={setKeyPageSize}
      pagedKeys={pagedKeys}
      filteredKeys={filteredKeys}
      currentKeyPage={currentKeyPage}
      totalKeyPages={totalKeyPages}
      setKeyPage={setKeyPage}
      selectedKeyIdsOnPage={selectedKeyIdsOnPage}
      setSelectedKeys={setSelectedKeys}
      handleClearLogs={handleClearLogs}
      clearingLogs={clearingLogs}
    />
  );

  const historyAudioPanelNode = (
    <HistoryAudioPanel
      show={showHistoryAudio}
      generatedAudioFiles={generatedAudioFiles}
      generatedAudioMessage={generatedAudioMessage}
      selectedHistoryFile={selectedHistoryFile}
      directoryHandle={directoryHandle}
      directoryName={directoryName}
      onClose={() => setShowHistoryAudio(false)}
      onScan={scanAudioHistory}
      onPlay={playGeneratedAudioFile}
    />
  );

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-5">
      <div className="mb-4 flex justify-center">
        <h1 className="select-none text-center text-2xl font-bold tracking-tight text-slate-800">
          ENGLISH VOICE GENERATOR
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <aside className="space-y-4 xl:col-span-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-800">Tên file & thư mục lưu</div>
                <div className="mt-1 text-xs text-slate-500">
                  {(filePrefixDraft || filePrefix || "Ep01").trim() || "Ep01"}-
                  {String(sequence).padStart(3, "0")}.wav
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowStoragePanel((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-base text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label={showStoragePanel ? "Thu gọn panel lưu file" : "Mở rộng panel lưu file"}
              >
                {showStoragePanel ? <FaChevronUp /> : <FaChevronDown />}
              </button>
            </div>

            {showStoragePanel ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-600">Tên file</div>
                  {!isFilePrefixSaved ? (
                    <>
                      <div className="flex gap-2">
                        <input
                          value={filePrefixDraft}
                          onChange={(e: React.ChangeEvent<any>) => {
                            setFilePrefixDraft(e.target.value);
                            setFilePrefix(e.target.value);
                            setIsFilePrefixSaved(false);
                          }}
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-2"
                          placeholder="Ví dụ: Ep01"
                        />
                        <button
                          type="button"
                          onClick={handleSaveFilePrefix}
                          disabled={!filePrefixDraft.trim()}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700 disabled:opacity-60"
                        >
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
                        onClick={handleOpenRenameDialog}
                        className="rounded-xl bg-slate-700 px-3 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-slate-600">Thư mục lưu</div>
                  <div className="rounded-xl bg-slate-50 break-all px-3 py-3 text-sm text-slate-700">
                    {directoryName ? (
                      <span title={directoryName}>{directoryName}</span>
                    ) : (
                      <span className="text-slate-500">Chưa chọn thư mục</span>
                    )}
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={chooseFolder}
                      type="button"
                      className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
                    >
                      {directoryName ? "Đổi thư mục" : "Chọn thư mục"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="font-semibold text-slate-800">Giọng đọc</div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenAddVoiceDialog}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                >
                  <FaMicrophone />
                  Voice Manager
                </button>

                <button
                  type="button"
                  onClick={() => setShowVoicePanel((prev) => !prev)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-base text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label={showVoicePanel ? "Thu gọn panel giọng đọc" : "Mở rộng panel giọng đọc"}
                >
                  {showVoicePanel ? <FaChevronUp /> : <FaChevronDown />}
                </button>
              </div>
            </div>

            {showVoicePanel ? (
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">Format</span>
                  <select
                    value={selectedFormat}
                    onChange={(e: React.ChangeEvent<any>) =>
                      handleVoicePanelFormatChange(e.target.value)
                    }
                    className="w-full rounded-xl border px-3 py-2"
                  >
                    {effectiveFormatItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedFormat !== "podcast" ? (
                  <>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-600">Loại giọng</span>
                      <select
                        value={voicePanelVoiceTypeKey === "male" ? "male" : "female"}
                        onChange={(e: React.ChangeEvent<any>) =>
                          handleVoicePanelVoiceTypeChange(
                            e.target.value === "male"
                              ? ("englishMale" as any)
                              : ("englishFemale" as any)
                          )
                        }
                        className="w-full rounded-xl border px-3 py-2"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-600">Voice</span>
                      <select
                        value={selectedVoiceId}
                        onChange={(e: React.ChangeEvent<any>) =>
                          handleVoicePanelVoiceChange(e.target.value)
                        }
                        className="w-full rounded-xl border px-3 py-2"
                      >
                        {voicePanelVoiceOptions.length ? (
                          voicePanelVoiceOptions.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                            </option>
                          ))
                        ) : (
                          <option value="">Chưa có voice phù hợp</option>
                        )}
                      </select>
                    </label>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <PresetPanel
            showPresetPanel={showPresetPanel}
            setShowPresetPanel={setShowPresetPanel}
            speakerSettings={speakerSettings}
            setSpeakerSettings={setSpeakerSettings}
            selectedPreset={selectedPreset}
            selectedPresetId={selectedPresetId}
            savedPresets={savedPresets}
            presetModified={panelPresetModified}
            presetMessage={presetMessage}
            defaultSpeakerSettings={defaultSpeakerSettings}
            onSavePreset={handlePanelSavePreset}
            onLoadPreset={handleLoadPreset}
            onDeletePreset={handleDeletePreset}
            onDeleteSelectedPresets={handleDeleteSelectedPresets}
            format={format}
            setFormat={setFormat}
            language={language}
            setLanguage={setLanguage}
            voiceProfile={voiceProfile}
            setVoiceProfile={setVoiceProfile}
            uiProfileDirty={uiProfileDirty}
            onApplyUiProfile={handleApplyUiProfile}
            voiceType={panelVoiceType}
            setVoiceType={handlePanelVoiceTypeChange}
            voiceName={panelVoiceName}
            setVoiceName={handlePanelVoiceNameChange}
            voiceCatalog={voiceCatalog}
            formatOptions={effectiveFormatItems}
            onOpenAddVoice={handleOpenAddVoiceDialog}
            onPreviewVoice={handlePreviewVoice}
            useVoiceDefaultPreset={useVoiceDefaultPreset}
            onToggleUseVoiceDefaultPreset={setUseVoiceDefaultPreset}
          />
        </aside>

        <main className="space-y-4 xl:col-span-8">
          <ScriptEditorPanel
            text={text}
            setText={setText}
            maxChars={MAX_CHARS}
            format={format}
            language={language}
            getTextPlaceholder={getTextPlaceholder}
          />

          <AppActionPanels
            isBusy={isBusy}
            hasSelectedFolder={hasSelectedFolder}
            scanningMerge={scanningMerge}
            showMergePanel={showMergePanel}
            adminVisible={adminVisible}
            showHistoryAudio={showHistoryAudio}
            generateButtonIcon={generateButtonIcon}
            generateButtonText={generateButtonText}
            onToggleMergePanel={handleToggleMergePanel}
            onToggleKeyManager={() => setAdminVisible((prev) => !prev)}
            onToggleHistoryAudio={() => setShowHistoryAudio((prev) => !prev)}
            onGenerate={() => {
              if (!currentGenerateVoiceType) {
                alert("Thiếu voiceType để generate.");
                return;
              }

              if (!isPodcastGenerate && !currentGenerateVoiceApiId) {
                alert("Thiếu apiId của voice để generate.");
                return;
              }

              console.log("GENERATE DEBUG:", currentGenerateVoiceDebug);

              return (handleGenerate as any)(
                text,
                buildGenerateScript(),
                finalGenerateSpeakerSettings,
                {
                  voiceMode: currentGenerateVoiceMode,
                  voiceType: currentGenerateVoiceType,
                  voiceName: isPodcastGenerate ? "" : currentGenerateVoiceApiId
                }
              );
            }}
            mergePanel={mergePanelNode}
            keyManagerPanel={keyManagerPanelNode}
            historyAudioPanel={historyAudioPanelNode}
          />

          {!supportsDirectoryPicker && (
            <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
              Trình duyệt hiện tại không hỗ trợ chọn thư mục trực tiếp. App vẫn chạy bình
              thường, nhưng file sẽ tải xuống theo cách mặc định của trình duyệt.
            </div>
          )}

          <AudioPlayerPanel
            audioUrl={audioUrl}
            isPreviewingVoice={isPreviewingVoice}
            audioRef={audioRef}
          />

          <AudioProgressPanel
            stage={stage}
            progress={progress}
            chunkInfo={chunkInfo}
            jobStatus={jobStatus}
            currentKey={currentKey}
            isBusy={isBusy}
            onStopGeneration={stopGeneration}
          />
        </main>
      </div>

      <VoiceManagerDialog
        show={showAddVoiceDialog}
        form={addVoiceForm}
        error={addVoiceError}
        onClose={handleCloseAddVoiceDialog}
        onSave={handleCreateVoice}
        onPreview={handlePreviewVoice}
        onImport={handleImportVoices}
        isPreviewing={isPreviewingVoice}
        setForm={setAddVoiceForm}
        customVoiceItems={customVoiceItems}
        selectedCustomVoiceIds={selectedCustomVoiceIds}
        selectedCustomVoiceSet={selectedCustomVoiceSet}
        onToggleCustomVoiceSelected={handleToggleCustomVoiceSelected}
        onSelectAllCustomVoices={handleSelectAllCustomVoices}
        onClearSelectedCustomVoices={handleClearSelectedCustomVoices}
        onDeleteSelectedCustomVoices={handleDeleteSelectedCustomVoices}
        selectedFormat={selectedFormat}
        setSelectedFormat={setSelectedFormat}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        selectedVoiceType={selectedVoiceType}
        setSelectedVoiceType={setSelectedVoiceType}
        selectedVoiceId={selectedVoiceId}
        onSelectVoice={setSelectedVoiceId}
        voiceConfigDraft={voiceConfigDraft}
        setVoiceConfigDraft={setVoiceConfigDraft}
        isVoiceConfigDirty={isVoiceConfigDirty}
        onSaveVoiceConfig={handleSaveVoiceConfig}
        formatOptions={effectiveFormatItems}
        onAddFormatItem={handleAddFormatItem}
        onUpdateFormatItemLabel={handleUpdateFormatItemLabel}
        onToggleFormatItemChecked={handleToggleFormatItemChecked}
        onDeleteCheckedFormatItems={handleDeleteCheckedFormatItems}
        onSaveFormatItems={handleSaveFormatItems}
      />

      {showRenameDialog ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="text-lg font-semibold text-slate-800">Đổi tên file</div>
            <div className="mt-1 text-sm text-slate-500">Nhập tên mới rồi bấm Save.</div>

            <input
              type="text"
              value={renameDraft}
              onChange={(e: React.ChangeEvent<any>) => setRenameDraft(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<any>) => {
                if (e.key === "Enter") handleConfirmRename();
                if (e.key === "Escape") handleCancelRename();
              }}
              className="mt-4 w-full rounded-xl border px-3 py-2"
              placeholder="Ví dụ: Ep01"
              autoFocus
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelRename}
                className="rounded-xl bg-slate-200 px-4 py-2 text-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRename}
                disabled={!renameDraft.trim()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-white disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AboutPanel showAbout={showAbout} setShowAbout={setShowAbout} />

      <style>{`
        @keyframes shine {
          0% { transform: translateX(-30%); }
          100% { transform: translateX(130%); }
        }
      `}</style>
    </div>
  );
}