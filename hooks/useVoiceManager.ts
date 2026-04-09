import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { ScriptLine } from "./useTtsJob";
import { loadCustomVoices, saveCustomVoices } from "../services/voiceStorage";
import {
  getPreviewText,
  getVoiceModeFromType,
  normalizeTextId,
  type CustomVoiceForm,
  type LanguageOption,
  type VoiceCatalog,
  type VoiceCatalogItem,
  type VoiceTypeOption,
  type VoiceProfileOption
} from "../services/voiceUtils";
import type { SavedPreset } from "../services/speakerPresets";

type SpeakerPreset = {
  speed: number;
  pitch: number;
  pause: number;
  style: string;
};

type SpeakerSettings = {
  A: SpeakerPreset;
  R: SpeakerPreset;
  blockPause: number;
};

type HandleGenerateInput = {
  voiceMode: string;
  voiceType: VoiceTypeOption;
  voiceName: string;
  isPreview?: boolean;
  skipSaveToFile?: boolean;
  skipHistoryRefresh?: boolean;
};

type ImportVoiceRow = {
  voiceType: VoiceTypeOption;
  id: string;
  apiId: string;
  label: string;
  description: string;
  formatId?: string;
  presetId?: string;
  presetName?: string;
  speed?: number;
  pitch?: number;
  pause?: number;
  style?: string;
  format?: string;
  language?: LanguageOption;
  voiceProfile?: VoiceProfileOption;
};

type ManagedCustomVoiceItem = VoiceCatalogItem & {
  voiceType: VoiceTypeOption;
};

type VoiceConfigSpeakerDraft = {
  speed: number;
  pitch: number;
  pause: number;
  style: string;
};

type VoiceConfigDraft = {
  A: VoiceConfigSpeakerDraft;
  R: VoiceConfigSpeakerDraft;
};

type VoiceConfigMap = Record<string, VoiceConfigDraft>;

type FormatItem = {
  id: string;
  label: string;
  checked?: boolean;
};

type UseVoiceManagerParams = {
  language: LanguageOption;
  isBusy: boolean;
  speakerSettings: SpeakerSettings;
  parseScript: (raw: string) => ScriptLine[];
  handleGenerate: (
    text: string,
    script: ScriptLine[],
    speakerSettings: SpeakerSettings,
    options: HandleGenerateInput
  ) => Promise<any>;
  previewCooldownMs: number;
  setPresetMessage: (message: string) => void;
  currentPresets?: SavedPreset[];
  onImportPresets?: (
    presets: SavedPreset[],
    options?: {
      importedFromVoice?: boolean;
      hiddenInMainDropdown?: boolean;
    }
  ) => void;
  onDeleteImportedVoicePresets?: (voiceIds: string[]) => void;
};

const FORMAT_ITEMS_STORAGE_KEY = "easy-english-voice-generator-format-items";

function getLanguageByVoiceType(voiceType: VoiceTypeOption) {
  return "en-US";
}

function getGenderByVoiceType(voiceType: VoiceTypeOption) {
  return voiceType === "englishFemale" ? "female" : "male";
}

function normalizeNumber(value: any, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLanguage(value: any, fallback: LanguageOption): LanguageOption {
  return "en";
}

function normalizeVoiceProfile(value: any): VoiceProfileOption {
  return value === "warm" || value === "clear" || value === "story" ? value : "default";
}

function normalizeFormat(value: any): "podcast" | "single" | "kids" | "teaching" {
  return value === "single" || value === "kids" || value === "teaching"
    ? value
    : "podcast";
}

function fixMojibake(value: any) {
  const text = String(value ?? "").replace(/^\uFEFF/, "").trim();
  if (!text) return "";

  const looksBroken =
    /[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝãâäåæçèéêëìíîïñòóôõöøùúûüý]/.test(text);

  if (!looksBroken) {
    return text.normalize("NFC");
  }

  try {
    const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);
    const repaired = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
    return repaired ? repaired.normalize("NFC") : text.normalize("NFC");
  } catch {
    return text.normalize("NFC");
  }
}

function normalizeImportedText(value: any) {
  return fixMojibake(value).replace(/\u00A0/g, " ").replace(/[ \t]+/g, " ").trim();
}

async function readImportFileText(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const decoders = ["utf-8", "windows-1258", "windows-1252"];

  const decodeWith = (encoding: string) => {
    const decoder = new TextDecoder(encoding as any, { fatal: false });
    return decoder.decode(bytes).replace(/^\uFEFF/, "");
  };

  const scoreText = (input: string) => {
    const replacementCount = (input.match(/�/g) || []).length;
    const mojibakeCount =
      (input.match(/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝãâäåæçèéêëìíîïñòóôõöøùúûüý]/g) || []).length;
    return replacementCount * 10 + mojibakeCount;
  };

  let bestText = "";
  let bestScore = Number.POSITIVE_INFINITY;

  for (const encoding of decoders) {
    try {
      const decoded = decodeWith(encoding);
      const score = scoreText(decoded);
      if (score < bestScore) {
        bestScore = score;
        bestText = decoded;
      }
      if (score === 0) break;
    } catch {
      // ignore and try next decoder
    }
  }

  return normalizeImportedText(bestText || decodeWith("utf-8"));
}

function makePresetId(raw: any, fallbackName: string) {
  const explicit = normalizeTextId(String(raw || "").trim());
  if (explicit) return explicit;

  const fromName = normalizeTextId(fallbackName);
  if (fromName) return `preset_${fromName}`;

  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildVoiceItem(row: ImportVoiceRow): VoiceCatalogItem {
  return {
    id: row.id,
    apiId: fixMojibake(row.apiId),
    label: fixMojibake(row.label),
    description: fixMojibake(row.description),
    mode: "single",
    language: getLanguageByVoiceType(row.voiceType),
    gender: getGenderByVoiceType(row.voiceType),
    formatId: String(row.formatId || "single").trim() || "single"
  };
}

function normalizeImportRow(raw: any): ImportVoiceRow | null {
  const voiceType = normalizeImportedText(raw?.voiceType) as VoiceTypeOption;
  const label = normalizeImportedText(raw?.label);
  const normalizedId = normalizeTextId(raw?.id || raw?.label || "");
  const apiId = normalizeImportedText(raw?.apiId || raw?.baseVoice || raw?.voice);
  const description = normalizeImportedText(raw?.description || raw?.note);
  const formatId = normalizeImportedText(raw?.formatId || "single") || "single";

  const validVoiceTypes: VoiceTypeOption[] = [
    "podcast",
    "englishMale",
    "englishFemale"
  ];

  if (!validVoiceTypes.includes(voiceType)) return null;
  if (voiceType === "podcast") return null;
  if (!label || !normalizedId || !apiId) return null;

  const presetName = normalizeImportedText(raw?.presetName || raw?.preset);
  const presetId = presetName || raw?.presetId ? makePresetId(raw?.presetId, presetName) : "";

  const inferredLanguage: LanguageOption = "en";

  return {
    voiceType,
    id: normalizedId,
    apiId,
    label,
    description,
    formatId,
    presetId: presetId || undefined,
    presetName: presetName || undefined,
    speed: raw?.speed !== undefined ? normalizeNumber(raw.speed, 1) : undefined,
    pitch: raw?.pitch !== undefined ? normalizeNumber(raw.pitch, 0) : undefined,
    pause: raw?.pause !== undefined ? normalizeNumber(raw.pause, 0) : undefined,
    style: raw?.style !== undefined ? normalizeImportedText(raw.style) : undefined,
    format: raw?.format ? normalizeFormat(raw.format) : undefined,
    language: normalizeLanguage(raw?.language, inferredLanguage),
    voiceProfile: normalizeVoiceProfile(raw?.voiceProfile)
  };
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseVoiceImportText(rawText: string, fileName = ""): ImportVoiceRow[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".json") || trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.voices) ? parsed.voices : [];
    return list.map(normalizeImportRow).filter(Boolean) as ImportVoiceRow[];
  }

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => normalizeImportedText(header));
  const rows = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = normalizeImportedText(cols[index] || "");
    });
    return obj;
  });

  return rows.map(normalizeImportRow).filter(Boolean) as ImportVoiceRow[];
}

function inferVoiceTypeFromItem(item: VoiceCatalogItem): VoiceTypeOption {
  const language = String(item.language || "").toLowerCase();
  const gender = String(item.gender || "").toLowerCase();

  return gender === "female" ? "englishFemale" : "englishMale";
}

function getVoiceTypeByLanguage(language: LanguageOption): VoiceTypeOption {
  return "englishFemale";
}

function createDefaultSpeakerColumn(): VoiceConfigSpeakerDraft {
  return {
    speed: 1,
    pitch: 0,
    pause: 0,
    style: ""
  };
}

function cloneSpeakerColumn(source?: Partial<VoiceConfigSpeakerDraft> | null): VoiceConfigSpeakerDraft {
  return {
    speed: normalizeNumber(source?.speed, 1),
    pitch: normalizeNumber(source?.pitch, 0),
    pause: normalizeNumber(source?.pause, 0),
    style: String(source?.style || "")
  };
}

function createDefaultVoiceConfig(): VoiceConfigDraft {
  return {
    A: createDefaultSpeakerColumn(),
    R: createDefaultSpeakerColumn()
  };
}

function normalizeVoiceConfig(value: any): VoiceConfigDraft {
  if (
    value &&
    typeof value === "object" &&
    value.A &&
    typeof value.A === "object" &&
    value.R &&
    typeof value.R === "object"
  ) {
    return {
      A: cloneSpeakerColumn(value.A),
      R: cloneSpeakerColumn(value.R)
    };
  }

  return {
    A: cloneSpeakerColumn(value),
    R: cloneSpeakerColumn(value)
  };
}

function createDefaultFormatItems(): FormatItem[] {
  return [
    { id: "podcast", label: "Podcast" },
    { id: "single", label: "Single Voice" },
    { id: "kids", label: "Kid Voice" }
  ];
}

function loadFormatItems(): FormatItem[] {
  try {
    const raw = localStorage.getItem(FORMAT_ITEMS_STORAGE_KEY);
    if (!raw) return createDefaultFormatItems();

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return createDefaultFormatItems();

    const normalized = parsed
      .map((item) => ({
        id: String(item?.id || "").trim(),
        label: String(item?.label || "").trim(),
        checked: false
      }))
      .filter((item) => item.id && item.label);

    const coreIds = new Set(normalized.map((item) => item.id));
    const next = [...normalized];

    if (!coreIds.has("podcast")) {
      next.unshift({ id: "podcast", label: "Podcast", checked: false });
    }

    if (!coreIds.has("single")) {
      const insertIndex = next.findIndex((item) => item.id !== "podcast");
      if (insertIndex === -1) {
        next.push({ id: "single", label: "Single Voice", checked: false });
      } else {
        next.splice(insertIndex, 0, { id: "single", label: "Single Voice", checked: false });
      }
    }

    if (!coreIds.has("kids")) {
      next.push({ id: "kids", label: "Kid Voice", checked: false });
    }

    return next.length ? next : createDefaultFormatItems();
  } catch {
    return createDefaultFormatItems();
  }
}

function saveFormatItems(items: FormatItem[]) {
  try {
    const clean = items
      .map(({ checked, ...item }) => ({
        id: String(item.id || "").trim(),
        label: String(item.label || "").trim()
      }))
      .filter((item) => item.id && item.label);

    localStorage.setItem(FORMAT_ITEMS_STORAGE_KEY, JSON.stringify(clean));
  } catch (error) {
    console.error("Save formatItems failed:", error);
  }
}

function buildCatalogFromCustomVoices(customVoices: VoiceCatalogItem[]): VoiceCatalog {
  const next: VoiceCatalog = {
    podcast: [],
    englishMale: [],
    englishFemale: []
  };

  for (const item of customVoices) {
    const voiceType = inferVoiceTypeFromItem(item);
    const currentList = next[voiceType] || [];
    next[voiceType] = [...currentList, item];
  }

  return next;
}

function buildImportedPreset(row: ImportVoiceRow): SavedPreset | null {
  if (!row.presetId || !row.presetName) return null;

  const speaker = {
    speed: normalizeNumber(row.speed, 1),
    pitch: normalizeNumber(row.pitch, 0),
    pause: normalizeNumber(row.pause, 0),
    style: String(row.style || "").trim()
  };

  return {
    id: row.presetId,
    name: row.presetName,
    settings: {
      A: { ...speaker },
      R: { ...speaker },
      blockPause: 0
    },
    voiceType: row.voiceType,
    voiceName: row.id,
    format: normalizeFormat(row.format),
    language:
      row.language ||
      ("en"),
    voiceProfile: row.voiceProfile || "default"
  };
}

export function useVoiceManager({
  language,
  isBusy,
  parseScript,
  handleGenerate,
  previewCooldownMs,
  setPresetMessage,
  currentPresets = [],
  onImportPresets,
  onDeleteImportedVoicePresets
}: UseVoiceManagerParams) {
  const [voiceCatalog, setVoiceCatalog] = useState<VoiceCatalog>({});
  const [voiceType, setVoiceType] = useState<VoiceTypeOption>("podcast");
  const [voiceName, setVoiceName] = useState("");
  const [customVoices, setCustomVoices] = useState<VoiceCatalogItem[]>([]);
  const [selectedCustomVoiceIds, setSelectedCustomVoiceIds] = useState<string[]>([]);
  const [showAddVoiceDialog, setShowAddVoiceDialog] = useState(false);
  const [addVoiceError, setAddVoiceError] = useState("");
  const [addVoiceForm, setAddVoiceForm] = useState<CustomVoiceForm>({
    voiceType: "englishFemale",
    id: "",
    apiId: "",
    label: "",
    description: ""
  });
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [lastPreviewAt, setLastPreviewAt] = useState(0);

  const [selectedFormat, setSelectedFormat] = useState<string>("single");
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>("en");
  const [selectedVoiceType, setSelectedVoiceType] = useState<VoiceTypeOption>(
    getVoiceTypeByLanguage("en")
  );
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [voiceConfigs, setVoiceConfigs] = useState<VoiceConfigMap>({});
  const [savedVoiceConfigs, setSavedVoiceConfigs] = useState<VoiceConfigMap>({});
  const [formatItems, setFormatItems] = useState<FormatItem[]>(() => loadFormatItems());
  const [showFormatManager, setShowFormatManager] = useState(false);

  useEffect(() => {
    setCustomVoices(
      (loadCustomVoices() || []).map((item: any) => ({
        ...item,
        apiId: fixMojibake(item?.apiId),
        label: fixMojibake(item?.label),
        description: fixMojibake(item?.description)
      }))
    );
  }, []);

  useEffect(() => {
    saveFormatItems(formatItems);
  }, [formatItems]);

  useEffect(() => {
    setVoiceCatalog(buildCatalogFromCustomVoices(customVoices));
  }, [customVoices]);

  useEffect(() => {
    setSelectedLanguage((prev) => (prev === "en" ? prev : "en"));
  }, [language]);

  useEffect(() => {
    const nextVoiceType = getVoiceTypeByLanguage(selectedLanguage);
    setSelectedVoiceType((prev) => {
      return String(prev) === "englishMale" || String(prev) === "englishFemale" ? prev : nextVoiceType;
    });
  }, [selectedLanguage]);

  const customVoiceItems = useMemo<ManagedCustomVoiceItem[]>(() => {
    return customVoices.map((item) => ({
      ...item,
      voiceType: inferVoiceTypeFromItem(item),
      formatId: String(item.formatId || "single").trim() || "single"
    }));
  }, [customVoices]);

  const selectedCustomVoiceSet = useMemo(
    () => new Set(selectedCustomVoiceIds),
    [selectedCustomVoiceIds]
  );

  const filteredCustomVoiceItems = useMemo(() => {
    return customVoiceItems.filter((item) => {
      const itemFormatId = String(item.formatId || "single").trim() || "single";

      if (selectedFormat && itemFormatId !== selectedFormat) return false;

      if (selectedFormat === "podcast") {
        return item.voiceType === "podcast" || itemFormatId === "podcast" || item.mode === "podcast";
      }

      if (selectedVoiceType && selectedVoiceType !== "podcast" && item.voiceType !== selectedVoiceType) {
        return false;
      }

      return item.voiceType === "englishMale" || item.voiceType === "englishFemale";
    });
  }, [customVoiceItems, selectedFormat, selectedVoiceType]);

  useEffect(() => {
    if (!formatItems.length) return;

    const exists = formatItems.some((item) => item.id === selectedFormat);
    if (!exists && formatItems[0]?.id) {
      setSelectedFormat(formatItems[0].id);
    }
  }, [formatItems, selectedFormat]);

  const firstFilteredVoiceId = filteredCustomVoiceItems[0]?.id || "";

  useEffect(() => {
    if (!firstFilteredVoiceId) {
      setSelectedVoiceId("");
      return;
    }

    if (!selectedVoiceId) {
      setSelectedVoiceId(firstFilteredVoiceId);
      return;
    }

    const exists = filteredCustomVoiceItems.some((item) => item.id === selectedVoiceId);
    if (!exists && firstFilteredVoiceId !== selectedVoiceId) {
      setSelectedVoiceId(firstFilteredVoiceId);
    }
  }, [firstFilteredVoiceId, filteredCustomVoiceItems, selectedVoiceId]);

  const activeManagedVoice = useMemo(() => {
    if (selectedVoiceId) {
      return customVoiceItems.find((item) => item.id === selectedVoiceId) || null;
    }

    return filteredCustomVoiceItems[0] || null;
  }, [customVoiceItems, filteredCustomVoiceItems, selectedVoiceId]);

  const handleSelectVoiceId = (nextId: string) => {
    const normalizedId = String(nextId || "").trim();
    if (!normalizedId) {
      setSelectedVoiceId("");
      return;
    }

    const selectedItem = customVoiceItems.find((item) => item.id === normalizedId);
    if (!selectedItem) {
      setSelectedVoiceId(normalizedId);
      return;
    }

    const nextFormat = String(selectedItem.formatId || "single").trim() || "single";
    const nextVoiceType =
      selectedItem.voiceType === "podcast"
        ? "podcast"
        : selectedItem.voiceType === "englishMale"
          ? "englishMale"
          : "englishFemale";

    setSelectedFormat(nextFormat);

    if (nextVoiceType !== "podcast") {
      setSelectedVoiceType(nextVoiceType);
    }

    setSelectedVoiceId(normalizedId);
  };


  useEffect(() => {
    const nextId = activeManagedVoice?.id || "";
    const nextType = activeManagedVoice?.voiceType || "";

    if (!nextId || !nextType) return;
    if (voiceType === nextType && voiceName === nextId) return;

    setVoiceType(nextType);
    setVoiceName(nextId);
  }, [activeManagedVoice?.id, activeManagedVoice?.voiceType]);

  useEffect(() => {
    const list = voiceCatalog?.[voiceType] || [];
    if (!list.length) {
      if (voiceName !== "") {
        setVoiceName("");
      }
      return;
    }

    const nextId = list[0]?.id || "";
    const exists = list.some((item) => item.id === voiceName);
    if (!exists && nextId && nextId !== voiceName) {
      setVoiceName(nextId);
    }
  }, [voiceCatalog, voiceType]);

  const activeVoiceInfo = useMemo(() => {
    const list = voiceCatalog?.[voiceType] || [];
    return list.find((item) => item.id === voiceName) || null;
  }, [voiceCatalog, voiceType, voiceName]);

  const voiceConfigDraft = useMemo<VoiceConfigDraft>(() => {
    if (!selectedVoiceId) return createDefaultVoiceConfig();
    return normalizeVoiceConfig(voiceConfigs[selectedVoiceId]);
  }, [selectedVoiceId, voiceConfigs]);

  const isVoiceConfigDirty = useMemo(() => {
    if (!selectedVoiceId) return false;
    const current = normalizeVoiceConfig(voiceConfigs[selectedVoiceId]);
    const saved = normalizeVoiceConfig(savedVoiceConfigs[selectedVoiceId]);
    return JSON.stringify(current) !== JSON.stringify(saved);
  }, [selectedVoiceId, voiceConfigs, savedVoiceConfigs]);

  const setVoiceConfigDraft: Dispatch<SetStateAction<VoiceConfigDraft>> = (updater) => {
    if (!selectedVoiceId) return;

    setVoiceConfigs((prev) => {
      const current = normalizeVoiceConfig(prev[selectedVoiceId]);
      const nextValue = typeof updater === "function" ? updater(current) : updater;

      return {
        ...prev,
        [selectedVoiceId]: normalizeVoiceConfig(nextValue)
      };
    });
  };

  const handleSaveVoiceConfig = () => {
    if (!selectedVoiceId) return;

    const nextConfig = normalizeVoiceConfig(voiceConfigDraft);

    setVoiceConfigs((prev) => ({
      ...prev,
      [selectedVoiceId]: nextConfig
    }));

    setSavedVoiceConfigs((prev) => ({
      ...prev,
      [selectedVoiceId]: nextConfig
    }));

    setPresetMessage(`Đã lưu cấu hình cho voice "${activeManagedVoice?.label || selectedVoiceId}"`);
    setAddVoiceError("");
  };

  const handleOpenAddVoiceDialog = () => {
    setAddVoiceError("");
    setSelectedCustomVoiceIds([]);
    setShowAddVoiceDialog(true);
  };

  const handleCloseAddVoiceDialog = () => {
    setAddVoiceError("");
    setSelectedCustomVoiceIds([]);
    setShowAddVoiceDialog(false);
  };

  const handleCreateVoice = () => {
    const label = String(addVoiceForm.label || "").trim();
    const apiId = String(addVoiceForm.apiId || "").trim();
    const description = String(addVoiceForm.description || "").trim();

    if (!label) {
      setAddVoiceError("Bạn chưa nhập tên giọng.");
      return false;
    }

    if (!apiId) {
      setAddVoiceError("Bạn chưa chọn giọng gốc.");
      return false;
    }

    const normalizedVoiceType =
      addVoiceForm.voiceType === "podcast"
        ? "podcast"
        : addVoiceForm.voiceType;

    const id = normalizeTextId(addVoiceForm.id || label || apiId);
    if (!id) {
      setAddVoiceError("Không tạo được ID cho voice mới.");
      return false;
    }

    if (customVoices.some((item) => item.id === id)) {
      setAddVoiceError("ID voice đã tồn tại. Hãy đổi tên giọng khác.");
      return false;
    }

    const newItem: VoiceCatalogItem = {
      id,
      apiId,
      label,
      description,
      mode: selectedFormat === "podcast" ? "podcast" : "single",
      language: getLanguageByVoiceType(normalizedVoiceType),
      gender: getGenderByVoiceType(normalizedVoiceType),
      formatId: String(selectedFormat || "single").trim() || "single"
    };

    const nextCustomVoices = [...customVoices, newItem];
    const nextConfig = normalizeVoiceConfig(voiceConfigDraft);
    const nextVoiceConfigs = { ...voiceConfigs, [id]: nextConfig };

    setCustomVoices(nextCustomVoices);
    saveCustomVoices(nextCustomVoices);
    setVoiceConfigs(nextVoiceConfigs);
    setSavedVoiceConfigs((prev) => ({ ...prev, [id]: nextConfig }));

    setVoiceType(normalizedVoiceType);
    setVoiceName(id);
    setSelectedVoiceType(normalizedVoiceType);
    setSelectedVoiceId(id);
    setAddVoiceForm({
      voiceType:
        selectedFormat === "podcast"
          ? "podcast"
          : String(selectedVoiceType) === "englishMale"
            ? "englishMale"
            : "englishFemale",
      id: "",
      apiId: "",
      label: "",
      description: ""
    });
    setAddVoiceError("");
    setPresetMessage(`Đã tạo voice mới: "${label}".`);
    return true;
  };

  const handleImportVoices = async (file: File) => {
    try {
      setAddVoiceError("");

      const text = await readImportFileText(file);
      const importedRows = parseVoiceImportText(text, file.name);

      if (!importedRows.length) {
        setAddVoiceError("Không tìm thấy dữ liệu hợp lệ trong file import.");
        return;
      }

      const existingIds = new Set(customVoices.map((item) => item.id));

      const dedupedRows: ImportVoiceRow[] = [];
      const seenInFile = new Set<string>();

      for (const row of importedRows) {
        if (existingIds.has(row.id)) continue;
        if (seenInFile.has(row.id)) continue;
        seenInFile.add(row.id);
        dedupedRows.push(row);
      }

      if (!dedupedRows.length) {
        setAddVoiceError("Tất cả ID trong file đã tồn tại.");
        return;
      }

      const nextItems = dedupedRows.map(buildVoiceItem);
      const nextCustomVoices = [...customVoices, ...nextItems];

      setCustomVoices(nextCustomVoices);
      saveCustomVoices(nextCustomVoices);

      const importedPresets = dedupedRows
        .map(buildImportedPreset)
        .filter(Boolean) as SavedPreset[];

      const existingPresetIds = new Set(currentPresets.map((item) => item.id));
      const existingPresetNames = new Set(currentPresets.map((item) => item.name.toLowerCase()));
      const nextImportedPresets: SavedPreset[] = [];
      const seenPresetIds = new Set<string>();
      const seenPresetNames = new Set<string>();

      for (const preset of importedPresets) {
        const lowerName = preset.name.toLowerCase();
        if (existingPresetIds.has(preset.id)) continue;
        if (existingPresetNames.has(lowerName)) continue;
        if (seenPresetIds.has(preset.id)) continue;
        if (seenPresetNames.has(lowerName)) continue;

        seenPresetIds.add(preset.id);
        seenPresetNames.add(lowerName);
        nextImportedPresets.push(preset);
      }

      if (nextImportedPresets.length) {
        onImportPresets?.(nextImportedPresets, {
          importedFromVoice: true,
          hiddenInMainDropdown: true
        });
      }

      const first = dedupedRows[0];
      setVoiceType(first.voiceType);
      setVoiceName(first.id);

      const inferredLanguage: LanguageOption = "en";

      setSelectedLanguage(inferredLanguage);
      setSelectedFormat(first.formatId || "single");
      setSelectedVoiceType(first.voiceType);
      setSelectedVoiceId(first.id);

      const importedVoiceCount = dedupedRows.length;
      const importedPresetCount = nextImportedPresets.length;

      if (importedPresetCount > 0) {
        setPresetMessage(`Đã import ${importedVoiceCount} voice và ${importedPresetCount} preset.`);
      } else {
        setPresetMessage(`Đã import ${importedVoiceCount} biến thể giọng.`);
      }
    } catch (error) {
      console.error("Import voices failed:", error);
      setAddVoiceError("Import thất bại. Hãy dùng file JSON hoặc CSV đúng định dạng.");
    }
  };

  const runPreview = async (previewVoiceType: VoiceTypeOption, previewVoiceName: string) => {
    const now = Date.now();

    if (now - lastPreviewAt < previewCooldownMs) {
      const waitSeconds = Math.ceil((previewCooldownMs - (now - lastPreviewAt)) / 1000);
      setPresetMessage(`Vui lòng đợi ${waitSeconds}s rồi nghe thử lại.`);
      return;
    }

    if (isBusy || isPreviewingVoice) {
      setPresetMessage("Đang bận xử lý, chưa thể nghe thử lúc này.");
      return;
    }

    const list = voiceCatalog?.[previewVoiceType] || [];
    const previewVoiceInfo = list.find((item) => item.id === previewVoiceName) || null;
    const previewApiVoiceName = previewVoiceInfo?.apiId || previewVoiceName;

    if (!previewApiVoiceName) {
      setPresetMessage("Chưa xác định được giọng để nghe thử.");
      return;
    }

    const previewText = getPreviewText(selectedLanguage, previewVoiceType);
    const previewScript = parseScript(previewText);
    const previewConfig = normalizeVoiceConfig(voiceConfigs[previewVoiceName]);

    try {
      setIsPreviewingVoice(true);
      setLastPreviewAt(now);
      setPresetMessage("Đang tạo audio nghe thử...");

      await handleGenerate(
        previewText,
        previewScript,
        {
          A: {
            speed: previewConfig.A.speed,
            pitch: previewConfig.A.pitch,
            pause: previewConfig.A.pause,
            style: previewConfig.A.style
          },
          R: {
            speed: previewConfig.R.speed,
            pitch: previewConfig.R.pitch,
            pause: previewConfig.R.pause,
            style: previewConfig.R.style
          },
          blockPause: 0
        },
        {
          voiceMode: getVoiceModeFromType(previewVoiceType),
          voiceType: previewVoiceType,
          voiceName: previewApiVoiceName,
          isPreview: true,
          skipSaveToFile: true,
          skipHistoryRefresh: true
        }
      );

      setPresetMessage("Đã tạo audio nghe thử.");
    } catch (error) {
      console.error("Preview voice failed:", error);
      setPresetMessage("Nghe thử thất bại. Vui lòng thử lại.");
    } finally {
      setIsPreviewingVoice(false);
    }
  };

  const handlePreviewVoice = async () => {
    const previewTarget = activeManagedVoice;
    if (!previewTarget?.id || !previewTarget.voiceType) {
      setAddVoiceError("Chưa có voice nào được chọn để nghe thử.");
      return;
    }

    setVoiceType(previewTarget.voiceType);
    setVoiceName(previewTarget.id);
    await runPreview(previewTarget.voiceType, previewTarget.id);
  };

  const handlePreviewVariantDraft = async () => {
    await handlePreviewVoice();
  };

  const handleToggleCustomVoiceSelected = (voiceId: string) => {
    setSelectedCustomVoiceIds((prev) =>
      prev.includes(voiceId) ? prev.filter((id) => id !== voiceId) : [...prev, voiceId]
    );
  };

  const handleSelectAllCustomVoices = (voiceIds?: string[]) => {
    if (!Array.isArray(voiceIds)) {
      setSelectedCustomVoiceIds([]);
      return;
    }

    setSelectedCustomVoiceIds(Array.from(new Set(voiceIds.filter(Boolean))));
  };

  const handleClearSelectedCustomVoices = () => {
    setSelectedCustomVoiceIds([]);
  };

  const handleDeleteSelectedCustomVoices = () => {
    if (!selectedCustomVoiceIds.length) {
      setAddVoiceError("Bạn chưa chọn voice nào để xóa.");
      return;
    }

    const selectedIdSet = new Set(selectedCustomVoiceIds);
    const deletedCount = selectedCustomVoiceIds.length;

    const nextCustomVoices = customVoices.filter((item) => !selectedIdSet.has(item.id));
    const nextVoiceConfigs = { ...voiceConfigs };
    const nextSavedVoiceConfigs = { ...savedVoiceConfigs };

    selectedCustomVoiceIds.forEach((id) => {
      delete nextVoiceConfigs[id];
      delete nextSavedVoiceConfigs[id];
    });

    setCustomVoices(nextCustomVoices);
    saveCustomVoices(nextCustomVoices);
    setVoiceConfigs(nextVoiceConfigs);
    setSavedVoiceConfigs(nextSavedVoiceConfigs);
    setSelectedCustomVoiceIds([]);

    onDeleteImportedVoicePresets?.(selectedCustomVoiceIds);

    if (selectedIdSet.has(selectedVoiceId)) {
      const remainingManaged = nextCustomVoices
        .map((item) => ({
          ...item,
          voiceType: inferVoiceTypeFromItem(item),
          formatId: String(item.formatId || "single").trim() || "single"
        }))
        .filter((item) => item.voiceType === selectedVoiceType)
        .filter((item) => item.formatId === selectedFormat);

      setSelectedVoiceId(remainingManaged[0]?.id || "");
    }

    if (selectedIdSet.has(voiceName)) {
      const remainingCatalog = buildCatalogFromCustomVoices(nextCustomVoices);
      const currentTypeList = remainingCatalog?.[voiceType] || [];

      if (currentTypeList.length) {
        setVoiceName(currentTypeList[0].id);
      } else {
        const fallbackEntry = Object.entries(remainingCatalog).find(
          ([, list]) => Array.isArray(list) && list.length > 0
        ) as [VoiceTypeOption, VoiceCatalogItem[]] | undefined;

        if (fallbackEntry) {
          setVoiceType(fallbackEntry[0]);
          setVoiceName(fallbackEntry[1][0].id);
        } else {
          setVoiceName("");
        }
      }
    }

    setAddVoiceError("");
    setPresetMessage(`Đã xóa ${deletedCount} voice đã chọn.`);
  };

  const handleOpenFormatManager = () => {
    setShowFormatManager(true);
  };

  const handleCloseFormatManager = () => {
    setShowFormatManager(false);
  };

  const handleAddFormatItem = () => {
    setFormatItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label: "",
        checked: false
      }
    ]);
  };

  const handleUpdateFormatItemLabel = (id: string, value: string) => {
    setFormatItems((prev) => prev.map((item) => (item.id === id ? { ...item, label: value } : item)));
  };

  const handleToggleFormatItemChecked = (id: string, checked: boolean) => {
    setFormatItems((prev) => prev.map((item) => (item.id === id ? { ...item, checked } : item)));
  };

  const handleDeleteCheckedFormatItems = () => {
    const coreIds = new Set(["podcast", "single", "kids"]);
    const next = formatItems.filter((item) => !(item.checked && !coreIds.has(item.id)));
    setFormatItems(next.length ? next : createDefaultFormatItems());
  };

  const handleSaveFormatItems = () => {
    const cleaned = formatItems
      .map(({ checked, ...item }) => ({
        ...item,
        label: item.label.trim()
      }))
      .filter((item) => item.id && item.label);

    const next = cleaned.length ? cleaned : createDefaultFormatItems();
    setFormatItems(next);
    saveFormatItems(next);
    setShowFormatManager(false);
    setPresetMessage("Đã lưu danh sách format.");
  };

  return {
    voiceCatalog,
    voiceType,
    setVoiceType,
    voiceName,
    setVoiceName,

    customVoiceItems,
    filteredCustomVoiceItems,
    selectedCustomVoiceIds,
    selectedCustomVoiceSet,
    selectedVoiceId,
    setSelectedVoiceId: handleSelectVoiceId,

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
    showFormatManager,
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
    handlePreviewVariantDraft,

    handleToggleCustomVoiceSelected,
    handleSelectAllCustomVoices,
    handleClearSelectedCustomVoices,
    handleDeleteSelectedCustomVoices,

    handleOpenFormatManager,
    handleCloseFormatManager,
    handleAddFormatItem,
    handleUpdateFormatItemLabel,
    handleToggleFormatItemChecked,
    handleDeleteCheckedFormatItems,
    handleSaveFormatItems
  };
}