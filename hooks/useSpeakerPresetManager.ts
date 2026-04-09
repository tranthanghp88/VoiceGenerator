import { useEffect, useMemo, useRef, useState } from "react";
import type {
  LanguageOption,
  VoiceFormat,
  VoiceProfileOption,
  VoiceTypeOption
} from "../services/voiceUtils";
import {
  DEFAULT_SPEAKER_SETTINGS,
  applyUiProfileToSpeakerSettings,
  cloneSpeakerSettings,
  getDefaultPresetMeta,
  isSameSettings,
  loadSavedPresets,
  loadUiProfile,
  savePresetsToStorage,
  saveUiProfile,
  type SavedPreset,
  type SpeakerSettings
} from "../services/speakerPresets";

const USE_VOICE_DEFAULT_PRESET_KEY = "easy-english-voice-generator-use-voice-default-preset";

type UseSpeakerPresetManagerParams = {
  setVoiceType?: (value: VoiceTypeOption) => void;
  setVoiceName?: (value: string) => void;
};

export type ManagedSavedPreset = SavedPreset & {
  importedFromVoice?: boolean;
  hiddenInMainDropdown?: boolean;
};

function normalizeManagedPreset(raw: any): ManagedSavedPreset | null {
  const id = String(raw?.id || "").trim();
  const name = String(raw?.name || "").trim();
  if (!id || !name) return null;

  return {
    ...raw,
    id,
    name,
    settings: cloneSpeakerSettings(raw?.settings || DEFAULT_SPEAKER_SETTINGS),
    importedFromVoice: !!raw?.importedFromVoice,
    hiddenInMainDropdown: !!raw?.hiddenInMainDropdown
  };
}

function normalizePresetList(list: any[]): ManagedSavedPreset[] {
  return (Array.isArray(list) ? list : [])
    .map(normalizeManagedPreset)
    .filter(Boolean) as ManagedSavedPreset[];
}

export function useSpeakerPresetManager({
  setVoiceType: syncVoiceType,
  setVoiceName: syncVoiceName
}: UseSpeakerPresetManagerParams = {}) {
  const [showPresetPanel, setShowPresetPanel] = useState(true);

  const [format, setFormatState] = useState<VoiceFormat>("podcast");
  const [language, setLanguageState] = useState<LanguageOption>("en");
  const [voiceProfile, setVoiceProfileState] = useState<VoiceProfileOption>("default");
  const [uiProfileDirty, setUiProfileDirty] = useState(false);

  const [speakerSettings, setSpeakerSettings] = useState<SpeakerSettings>(
    cloneSpeakerSettings(DEFAULT_SPEAKER_SETTINGS)
  );
  const [savedPresets, setSavedPresets] = useState<ManagedSavedPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetMessage, setPresetMessage] = useState("");

  const [voiceType, setVoiceTypeState] = useState<VoiceTypeOption>("podcast");
  const [voiceName, setVoiceNameState] = useState("");
  const [useVoiceDefaultPreset, setUseVoiceDefaultPreset] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = window.localStorage.getItem(USE_VOICE_DEFAULT_PRESET_KEY);
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const initializedRef = useRef(false);

  const setVoiceType = (value: VoiceTypeOption) => {
    setVoiceTypeState((prev) => (prev === value ? prev : value));
    syncVoiceType?.(value);
  };

  const setVoiceName = (value: string) => {
    setVoiceNameState((prev) => (prev === value ? prev : value));
    syncVoiceName?.(value);
  };

  const applyPresetToState = (preset: ManagedSavedPreset) => {
    setSelectedPresetId((prev) => (prev === preset.id ? prev : preset.id));
    setSpeakerSettings((prev) =>
      isSameSettings(prev, preset.settings) ? prev : cloneSpeakerSettings(preset.settings)
    );

    if (preset.format) {
      setFormatState((prev) => (prev === preset.format ? prev : preset.format));
    }
    if (preset.language) {
      setLanguageState((prev) => (prev === preset.language ? prev : preset.language));
    }
    if (preset.voiceProfile) {
      setVoiceProfileState((prev) => (prev === preset.voiceProfile ? prev : preset.voiceProfile));
    }
    if (preset.voiceType) {
      setVoiceType(preset.voiceType);
    }
    if (preset.voiceName) {
      setVoiceName(preset.voiceName);
    }
  };

  const applyDefaultMetaToState = () => {
    const fallback = getDefaultPresetMeta();

    setSelectedPresetId("");
    setSpeakerSettings((prev) =>
      isSameSettings(prev, DEFAULT_SPEAKER_SETTINGS)
        ? prev
        : cloneSpeakerSettings(DEFAULT_SPEAKER_SETTINGS)
    );
    setFormatState((prev) => (prev === fallback.format ? prev : fallback.format));
    setLanguageState((prev) => (prev === fallback.language ? prev : fallback.language));
    setVoiceProfileState((prev) => (prev === fallback.voiceProfile ? prev : fallback.voiceProfile));
    setVoiceType(fallback.voiceType);
    setVoiceName(fallback.voiceName);
  };

  const selectedPreset = useMemo(
    () => savedPresets.find((item) => item.id === selectedPresetId) || null,
    [savedPresets, selectedPresetId]
  );

  const visibleMainDropdownPresets = useMemo(
    () =>
      savedPresets.filter(
        (item) => !item.importedFromVoice && !item.hiddenInMainDropdown && item.format === format
      ),
    [savedPresets, format]
  );

  useEffect(() => {
    if (!selectedPresetId) return;

    const stillVisible = visibleMainDropdownPresets.some((item) => item.id === selectedPresetId);
    if (!stillVisible) {
      setSelectedPresetId("");
    }
  }, [visibleMainDropdownPresets, selectedPresetId]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const presets = normalizePresetList(loadSavedPresets() as any[]);
    setSavedPresets(presets);

    const profile = loadUiProfile();

    if (presets.length) {
      const firstVisible =
        presets.find(
          (item) => !item.importedFromVoice && !item.hiddenInMainDropdown && item.format === profile.format
        ) ||
        presets.find((item) => !item.importedFromVoice && !item.hiddenInMainDropdown) ||
        null;

      if (firstVisible) {
        applyPresetToState(firstVisible);
      } else {
        const fallback = getDefaultPresetMeta();
        setFormatState(profile.format);
        setLanguageState(profile.language);
        setVoiceProfileState(profile.voiceProfile);
        setVoiceType(fallback.voiceType);
        setVoiceName(fallback.voiceName);
      }
    } else {
      const fallback = getDefaultPresetMeta();
      setFormatState(profile.format);
      setLanguageState(profile.language);
      setVoiceProfileState(profile.voiceProfile);
      setVoiceType(fallback.voiceType);
      setVoiceName(fallback.voiceName);
    }
  }, []);

  useEffect(() => {
    if (!presetMessage) return;
    const t = window.setTimeout(() => setPresetMessage(""), 2500);
    return () => window.clearTimeout(t);
  }, [presetMessage]);

  useEffect(() => {
    saveUiProfile({ format, language, voiceProfile });
  }, [format, language, voiceProfile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        USE_VOICE_DEFAULT_PRESET_KEY,
        JSON.stringify(!!useVoiceDefaultPreset)
      );
    } catch {}
  }, [useVoiceDefaultPreset]);

  const setFormat = (value: VoiceFormat) => {
    setFormatState((prev) => (prev === value ? prev : value));
    setUiProfileDirty(true);
  };

  const setLanguage = (value: LanguageOption) => {
    setLanguageState((prev) => (prev === value ? prev : value));
    setUiProfileDirty(true);
  };

  const setVoiceProfile = (value: VoiceProfileOption) => {
    setVoiceProfileState((prev) => (prev === value ? prev : value));
    setUiProfileDirty(true);
  };

  const buildPresetPayload = (
    id: string,
    name: string,
    nextVoiceType: VoiceTypeOption,
    nextVoiceName: string
  ): ManagedSavedPreset => ({
    id,
    name,
    settings: cloneSpeakerSettings(speakerSettings),
    voiceType: nextVoiceType,
    voiceName: nextVoiceName,
    format,
    language,
    voiceProfile,
    importedFromVoice: false,
    hiddenInMainDropdown: false
  });

  const getPresetModified = (
    nextVoiceType: VoiceTypeOption = voiceType,
    nextVoiceName: string = voiceName
  ) => {
    if (!selectedPreset) return false;

    return !(
      isSameSettings(selectedPreset.settings, speakerSettings) &&
      selectedPreset.voiceType === nextVoiceType &&
      selectedPreset.voiceName === nextVoiceName &&
      selectedPreset.format === format &&
      selectedPreset.language === language &&
      selectedPreset.voiceProfile === voiceProfile
    );
  };

  const handleSavePreset = (
    name: string,
    nextVoiceType: VoiceTypeOption = voiceType,
    nextVoiceName: string = voiceName
  ) => {
    const existing = savedPresets.find((item) => item.name.toLowerCase() === name.toLowerCase());

    let nextPresets: ManagedSavedPreset[] = [];

    if (existing) {
      nextPresets = savedPresets.map((item) =>
        item.id === existing.id
          ? {
              ...buildPresetPayload(existing.id, name, nextVoiceType, nextVoiceName),
              importedFromVoice: false,
              hiddenInMainDropdown: false
            }
          : item
      );
      setSelectedPresetId(existing.id);
      setPresetMessage(`Đã cập nhật preset "${name}"`);
    } else {
      const newPreset = buildPresetPayload(
        `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        nextVoiceType,
        nextVoiceName
      );
      nextPresets = [newPreset, ...savedPresets];
      setSelectedPresetId(newPreset.id);
      setPresetMessage(`Đã lưu preset "${name}"`);
    }

    setSavedPresets(nextPresets);
    savePresetsToStorage(nextPresets);
  };

  const handleImportPresets = (
    incomingPresets: SavedPreset[],
    options?: {
      importedFromVoice?: boolean;
      hiddenInMainDropdown?: boolean;
    }
  ) => {
    if (!incomingPresets.length) {
      setPresetMessage("Không có preset mới để import.");
      return;
    }

    const existingIds = new Set(savedPresets.map((item) => item.id));
    const existingNames = new Set(savedPresets.map((item) => item.name.toLowerCase()));

    const dedupedIncoming: ManagedSavedPreset[] = [];
    const seenIncomingIds = new Set<string>();
    const seenIncomingNames = new Set<string>();

    for (const rawPreset of incomingPresets) {
      const preset = normalizeManagedPreset(rawPreset);
      if (!preset) continue;

      const id = preset.id;
      const name = preset.name;
      const lowerName = name.toLowerCase();

      if (existingIds.has(id)) continue;
      if (existingNames.has(lowerName)) continue;
      if (seenIncomingIds.has(id)) continue;
      if (seenIncomingNames.has(lowerName)) continue;

      dedupedIncoming.push({
        ...preset,
        importedFromVoice: !!options?.importedFromVoice,
        hiddenInMainDropdown: !!options?.hiddenInMainDropdown
      });

      seenIncomingIds.add(id);
      seenIncomingNames.add(lowerName);
    }

    if (!dedupedIncoming.length) {
      setPresetMessage("Preset trong file đã tồn tại hết.");
      return;
    }

    const nextPresets = [...dedupedIncoming, ...savedPresets];
    setSavedPresets(nextPresets);
    savePresetsToStorage(nextPresets);

    const firstVisibleImported =
      dedupedIncoming.find((item) => !item.importedFromVoice && !item.hiddenInMainDropdown) ||
      dedupedIncoming[0];

    applyPresetToState(firstVisibleImported);
    setUiProfileDirty(false);
    setPresetMessage(`Đã import ${dedupedIncoming.length} preset.`);
  };

  const handleLoadPreset = (presetId: string) => {
    const preset = savedPresets.find((item) => item.id === presetId);
    if (!preset) return;

    applyPresetToState(preset);
    setUiProfileDirty(false);
    setPresetMessage(`Đã nạp preset "${preset.name}"`);
  };

  const applyPresetAfterDelete = (nextPresets: ManagedSavedPreset[]) => {
    const next =
      nextPresets.find(
        (item) => !item.importedFromVoice && !item.hiddenInMainDropdown && item.format === format
      ) ||
      nextPresets.find((item) => !item.importedFromVoice && !item.hiddenInMainDropdown) ||
      null;

    if (next) {
      applyPresetToState(next);
    } else {
      applyDefaultMetaToState();
    }
  };

  const handleDeleteSelectedPresets = (presetIds: string[]) => {
    const normalizedIds = Array.from(
      new Set((Array.isArray(presetIds) ? presetIds : []).map((item) => String(item || "").trim()))
    ).filter(Boolean);

    if (!normalizedIds.length) return;

    const deletedPresets = savedPresets.filter((item) => normalizedIds.includes(item.id));
    if (!deletedPresets.length) return;

    const nextPresets = savedPresets.filter((item) => !normalizedIds.includes(item.id));

    setSavedPresets(nextPresets);
    savePresetsToStorage(nextPresets);
    applyPresetAfterDelete(nextPresets);
    setUiProfileDirty(false);

    if (deletedPresets.length === 1) {
      setPresetMessage(`Đã xóa preset "${deletedPresets[0].name}"`);
      return;
    }

    setPresetMessage(`Đã xóa ${deletedPresets.length} preset`);
  };

  const handleDeletePreset = () => {
    if (!selectedPreset) return;

    const ok = window.confirm(`Xóa preset "${selectedPreset.name}"?`);
    if (!ok) return;

    handleDeleteSelectedPresets([selectedPreset.id]);
  };

  const handleApplyUiProfile = () => {
    const next = applyUiProfileToSpeakerSettings(speakerSettings, {
      format,
      language,
      voiceProfile
    });
    setSpeakerSettings((prev) => (isSameSettings(prev, next) ? prev : next));
    setUiProfileDirty(false);
    setPresetMessage("Đã áp dụng Voice UI vào Speaker Preset");
  };

  return {
    showPresetPanel,
    setShowPresetPanel,

    format,
    setFormat,
    language,
    setLanguage,
    voiceProfile,
    setVoiceProfile,
    uiProfileDirty,
    setUiProfileDirty,

    speakerSettings,
    setSpeakerSettings,

    voiceType,
    setVoiceType,
    voiceName,
    setVoiceName,
    useVoiceDefaultPreset,
    setUseVoiceDefaultPreset,

    savedPresets,
    visibleMainDropdownPresets,
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

    defaultSpeakerSettings: cloneSpeakerSettings(DEFAULT_SPEAKER_SETTINGS)
  };
}
