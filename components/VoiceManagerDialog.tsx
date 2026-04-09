import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaFileExport,
  FaFileImport,
  FaMagic,
  FaPlus,
  FaSave,
  FaSearch,
  FaTimes
} from "react-icons/fa";

type VoiceTypeOption =
  | "podcast"
  | "englishMale"
  | "englishFemale";

type CustomVoiceForm = {
  voiceType: VoiceTypeOption;
  id: string;
  apiId: string;
  label: string;
  description: string;
};

type ManagedCustomVoiceItem = {
  id: string;
  apiId?: string | null;
  label: string;
  description?: string;
  voiceType?: VoiceTypeOption;
  formatId?: string;
  mode?: string;
  language?: string;
  gender?: string;
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

type FormatItem = {
  id: string;
  label: string;
  checked?: boolean;
};

type VoiceManagerDialogProps = {
  show: boolean;
  form: CustomVoiceForm;
  error: string;
  onClose: () => void;
  onSave: () => boolean | void | Promise<boolean | void>;
  onPreview: () => void | Promise<void>;
  onImport: (file: File) => void | Promise<void>;
  isPreviewing: boolean;
  setForm: React.Dispatch<React.SetStateAction<CustomVoiceForm>>;
  isVoiceConfigDirty?: boolean;
  onSaveVoiceConfig?: () => void;

  customVoiceItems?: ManagedCustomVoiceItem[];
  selectedCustomVoiceIds?: string[];
  selectedCustomVoiceSet?: Set<string>;
  onToggleCustomVoiceSelected?: (voiceId: string) => void;
  onSelectAllCustomVoices?: (voiceIds?: string[]) => void;
  onClearSelectedCustomVoices?: () => void;
  onDeleteSelectedCustomVoices?: () => void;

  selectedFormat?: string;
  setSelectedFormat?: (value: string) => void;
  selectedLanguage?: "en";
  setSelectedLanguage?:
    | React.Dispatch<React.SetStateAction<"en">>
    | ((value: "en") => void);
  selectedVoiceType?: VoiceTypeOption;
  setSelectedVoiceType?: (value: VoiceTypeOption) => void;

  selectedVoiceId?: string;
  onSelectVoice?: (voiceId: string) => void;

  voiceConfigDraft?: VoiceConfigDraft;
  setVoiceConfigDraft?: React.Dispatch<React.SetStateAction<VoiceConfigDraft>>;

  formatOptions?: Array<{ id: string; label: string }>;
  onOpenFormatManager?: () => void;
  onAddFormatItem?: () => void;
  onUpdateFormatItemLabel?: (id: string, value: string) => void;
  onToggleFormatItemChecked?: (id: string, checked: boolean) => void;
  onDeleteCheckedFormatItems?: () => void;
  onSaveFormatItems?: () => void;
};

function getVoiceTypeLabel(value?: VoiceTypeOption) {
  switch (value) {
    case "englishMale":
      return "Male";
    case "englishFemale":
      return "Female";
    case "podcast":
      return "Podcast";
    default:
      return "Khác";
  }
}

function getVoiceTypeOptionsByLanguage(_language: "en") {
  return [
    { value: "englishMale" as const, label: "Male" },
    { value: "englishFemale" as const, label: "Female" }
  ];
}

function makeFormatItem(): FormatItem {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: "",
    checked: false
  };
}

function slugifyVoiceId(text: string) {
  const base = String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || `voice-${Date.now()}`;
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob(["\uFEFF", JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob(["\uFEFF", content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const SAMPLE_CSV_NEW = `voiceType,id,apiId,label,description,formatId,presetId,presetName,speed,pitch,pause,style,format,language,voiceProfile
englishFemale,ef01,en-US-VoiceA,Female 01,English female voice,podcast,preset_ef01,Female Warm,1,0,0.2,warm,podcast,en,warm
englishMale,en01,en-US-VoiceB,Male 01,English male voice,single,preset_en01,EN Clear,0.95,0,0.15,clear voice,single,en,clear`;

const SAMPLE_JSON = JSON.stringify(
  [
    {
      voiceType: "englishFemale",
      id: "mc01",
      apiId: "en-US-VoiceA",
      label: "Female 01",
      description: "English voice",
      formatId: "podcast",
      presetId: "preset_mc01",
      presetName: "Female Warm",
      speed: 1,
      pitch: 0,
      pause: 0.2,
      style: "warm",
      format: "podcast",
      language: "en",
      voiceProfile: "warm"
    },
    {
      voiceType: "englishMale",
      id: "en01",
      apiId: "en-US-VoiceB",
      label: "Male 01",
      description: "English voice",
      formatId: "single",
      presetId: "preset_en01",
      presetName: "EN Clear",
      speed: 0.95,
      pitch: 0,
      pause: 0.15,
      style: "clear voice",
      format: "single",
      language: "en",
      voiceProfile: "clear"
    }
  ],
  null,
  2
);

const BUILT_IN_BASE_VOICES: Array<{
  id: string;
  apiId: string;
  label: string;
  voiceType: VoiceTypeOption;
  formatId: string;
  description?: string;
}> = [
  // Vietnamese - Single
  {
    id: "base_vi_female_single_kore",
    apiId: "Kore",
    label: "Kore",
    voiceType: "englishFemale",
    formatId: "single",
    description: "English voice"
  },
  {
    id: "base_vi_female_single_zephyr",
    apiId: "Zephyr",
    label: "Zephyr",
    voiceType: "englishFemale",
    formatId: "single",
    description: "English voice"
  },
  {
    id: "base_vi_male_single_puck",
    apiId: "Puck",
    label: "Puck",
    voiceType: "englishMale",
    formatId: "single",
    description: "English voice"
  },
  {
    id: "base_vi_male_single_charon",
    apiId: "Charon",
    label: "Charon",
    voiceType: "englishMale",
    formatId: "single",
    description: "English voice"
  },
  {
    id: "base_vi_male_single_fenrir",
    apiId: "Fenrir",
    label: "Fenrir",
    voiceType: "englishMale",
    formatId: "single",
    description: "English voice"
  },

  // Vietnamese - Podcast
  {
    id: "base_vi_female_podcast_kore",
    apiId: "Kore",
    label: "Kore",
    voiceType: "englishFemale",
    formatId: "podcast",
    description: "English voice"
  },
  {
    id: "base_vi_female_podcast_zephyr",
    apiId: "Zephyr",
    label: "Zephyr",
    voiceType: "englishFemale",
    formatId: "podcast",
    description: "English voice"
  },
  {
    id: "base_vi_male_podcast_puck",
    apiId: "Puck",
    label: "Puck",
    voiceType: "englishMale",
    formatId: "podcast",
    description: "English voice"
  },
  {
    id: "base_vi_male_podcast_charon",
    apiId: "Charon",
    label: "Charon",
    voiceType: "englishMale",
    formatId: "podcast",
    description: "English voice"
  },

  // Vietnamese - Kids
  {
    id: "base_vi_female_kids_zephyr",
    apiId: "Zephyr",
    label: "Zephyr",
    voiceType: "englishFemale",
    formatId: "kids",
    description: "English voice"
  },
  {
    id: "base_vi_male_kids_fenrir",
    apiId: "Fenrir",
    label: "Fenrir",
    voiceType: "englishMale",
    formatId: "kids",
    description: "English voice"
  },

  // English - Single
  {
    id: "base_en_female_single_kore",
    apiId: "Kore",
    label: "Kore",
    voiceType: "englishFemale",
    formatId: "single",
    description: "English female - clear, versatile"
  },
  {
    id: "base_en_female_single_zephyr",
    apiId: "Zephyr",
    label: "Zephyr",
    voiceType: "englishFemale",
    formatId: "single",
    description: "English female - bright, youthful"
  },
  {
    id: "base_en_male_single_puck",
    apiId: "Puck",
    label: "Puck",
    voiceType: "englishMale",
    formatId: "single",
    description: "English male - youthful, energetic"
  },
  {
    id: "base_en_male_single_charon",
    apiId: "Charon",
    label: "Charon",
    voiceType: "englishMale",
    formatId: "single",
    description: "English male - deep, solid"
  },
  {
    id: "base_en_male_single_fenrir",
    apiId: "Fenrir",
    label: "Fenrir",
    voiceType: "englishMale",
    formatId: "single",
    description: "English male - storytelling"
  },

  // English - Podcast
  {
    id: "base_en_female_podcast_kore",
    apiId: "Kore",
    label: "Kore",
    voiceType: "englishFemale",
    formatId: "podcast",
    description: "English female podcast - clear"
  },
  {
    id: "base_en_female_podcast_zephyr",
    apiId: "Zephyr",
    label: "Zephyr",
    voiceType: "englishFemale",
    formatId: "podcast",
    description: "English female podcast - bright"
  },
  {
    id: "base_en_male_podcast_puck",
    apiId: "Puck",
    label: "Puck",
    voiceType: "englishMale",
    formatId: "podcast",
    description: "English male podcast - energetic"
  },
  {
    id: "base_en_male_podcast_charon",
    apiId: "Charon",
    label: "Charon",
    voiceType: "englishMale",
    formatId: "podcast",
    description: "English male podcast - deep"
  },

  // English - Kids
  {
    id: "base_en_female_kids_zephyr",
    apiId: "Zephyr",
    label: "Zephyr",
    voiceType: "englishFemale",
    formatId: "kids",
    description: "English female kids - bright"
  },
  {
    id: "base_en_male_kids_fenrir",
    apiId: "Fenrir",
    label: "Fenrir",
    voiceType: "englishMale",
    formatId: "kids",
    description: "English male kids - storytelling"
  }
];

function createDefaultSpeakerDraft(): VoiceConfigSpeakerDraft {
  return {
    speed: 1,
    pitch: 0,
    pause: 0,
    style: ""
  };
}

function createDefaultVoiceConfigDraft(): VoiceConfigDraft {
  return {
    A: createDefaultSpeakerDraft(),
    R: createDefaultSpeakerDraft()
  };
}

function normalizeSpeakerDraft(source?: Partial<VoiceConfigSpeakerDraft> | null): VoiceConfigSpeakerDraft {
  return {
    speed: Number(source?.speed ?? 1),
    pitch: Number(source?.pitch ?? 0),
    pause: Number(source?.pause ?? 0),
    style: String(source?.style ?? "")
  };
}

function normalizeVoiceConfigDraft(source?: Partial<VoiceConfigDraft> | null): VoiceConfigDraft {
  return {
    A: normalizeSpeakerDraft(source?.A),
    R: normalizeSpeakerDraft(source?.R)
  };
}

function SpeakerConfigColumn({
  title,
  draft,
  disabled,
  onChange
}: {
  title: string;
  draft: VoiceConfigSpeakerDraft;
  disabled?: boolean;
  onChange: (next: VoiceConfigSpeakerDraft) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
      <div className="mb-3 font-semibold text-slate-800">{title}</div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Speed</span>
          <input
            type="number"
            step="0.01"
            value={draft.speed}
            onChange={(e) =>
              onChange({
                ...draft,
                speed: Number(e.target.value)
              })
            }
            disabled={disabled}
            className="w-full rounded-xl border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Pitch</span>
          <input
            type="number"
            step="0.1"
            value={draft.pitch}
            onChange={(e) =>
              onChange({
                ...draft,
                pitch: Number(e.target.value)
              })
            }
            disabled={disabled}
            className="w-full rounded-xl border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Pause</span>
          <input
            type="number"
            step="0.1"
            value={draft.pause}
            onChange={(e) =>
              onChange({
                ...draft,
                pause: Number(e.target.value)
              })
            }
            disabled={disabled}
            className="w-full rounded-xl border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </label>
      </div>

      <label className="mt-3 block space-y-1">
        <span className="text-xs font-medium text-slate-600">Style</span>
        <input
          type="text"
          value={draft.style}
          onChange={(e) =>
            onChange({
              ...draft,
              style: e.target.value
            })
          }
          disabled={disabled}
          className="w-full rounded-xl border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
          placeholder="Ví dụ: calm / warm / storytelling"
        />
      </label>
    </div>
  );
}

function PodcastDualConfigGrid({
  leftTitle,
  rightTitle,
  leftDraft,
  rightDraft,
  disabled,
  onChangeLeft,
  onChangeRight
}: {
  leftTitle: string;
  rightTitle: string;
  leftDraft: VoiceConfigSpeakerDraft;
  rightDraft: VoiceConfigSpeakerDraft;
  disabled?: boolean;
  onChangeLeft: (next: VoiceConfigSpeakerDraft) => void;
  onChangeRight: (next: VoiceConfigSpeakerDraft) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-3">
        <div className="font-semibold text-slate-800">{leftTitle}</div>
        <div className="font-semibold text-slate-800">{rightTitle}</div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Speed</span>
            <input
              type="number"
              step="0.01"
              value={leftDraft.speed}
              onChange={(e) =>
                onChangeLeft({
                  ...leftDraft,
                  speed: Number(e.target.value)
                })
              }
              disabled={disabled}
              className="w-full rounded-xl border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Speed</span>
            <input
              type="number"
              step="0.01"
              value={rightDraft.speed}
              onChange={(e) =>
                onChangeRight({
                  ...rightDraft,
                  speed: Number(e.target.value)
                })
              }
              disabled={disabled}
              className="w-full rounded-xl border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Pitch</span>
            <input
              type="number"
              step="0.1"
              value={leftDraft.pitch}
              onChange={(e) =>
                onChangeLeft({
                  ...leftDraft,
                  pitch: Number(e.target.value)
                })
              }
              disabled={disabled}
              className="w-full rounded-xl border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Pitch</span>
            <input
              type="number"
              step="0.1"
              value={rightDraft.pitch}
              onChange={(e) =>
                onChangeRight({
                  ...rightDraft,
                  pitch: Number(e.target.value)
                })
              }
              disabled={disabled}
              className="w-full rounded-xl border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Pause</span>
            <input
              type="number"
              step="0.1"
              value={leftDraft.pause}
              onChange={(e) =>
                onChangeLeft({
                  ...leftDraft,
                  pause: Number(e.target.value)
                })
              }
              disabled={disabled}
              className="w-full rounded-xl border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Pause</span>
            <input
              type="number"
              step="0.1"
              value={rightDraft.pause}
              onChange={(e) =>
                onChangeRight({
                  ...rightDraft,
                  pause: Number(e.target.value)
                })
              }
              disabled={disabled}
              className="w-full rounded-xl border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Style</span>
            <input
              type="text"
              value={leftDraft.style}
              onChange={(e) =>
                onChangeLeft({
                  ...leftDraft,
                  style: e.target.value
                })
              }
              disabled={disabled}
              className="w-full rounded-xl border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
              placeholder="Ví dụ: calm / warm / storytelling"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Style</span>
            <input
              type="text"
              value={rightDraft.style}
              onChange={(e) =>
                onChangeRight({
                  ...rightDraft,
                  style: e.target.value
                })
              }
              disabled={disabled}
              className="w-full rounded-xl border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
              placeholder="Ví dụ: calm / warm / storytelling"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

export default function VoiceManagerDialog({
  show,
  form,
  error,
  onClose,
  onSave,
  onPreview,
  onImport,
  isPreviewing,
  setForm,
  isVoiceConfigDirty = false,
  onSaveVoiceConfig,
  customVoiceItems = [],
  selectedCustomVoiceIds = [],
  selectedCustomVoiceSet,
  onToggleCustomVoiceSelected,
  onSelectAllCustomVoices,
  onClearSelectedCustomVoices,
  onDeleteSelectedCustomVoices,
  selectedFormat = "single",
  setSelectedFormat,
  selectedLanguage = "en",
  setSelectedLanguage,
  selectedVoiceType = "englishFemale",
  setSelectedVoiceType,
  selectedVoiceId = "",
  onSelectVoice,
  voiceConfigDraft,
  setVoiceConfigDraft,
  formatOptions = [
    { id: "podcast", label: "Podcast" },
    { id: "single", label: "Single Voice" },
    { id: "kids", label: "Kid Voice" }
  ],
  onOpenFormatManager,
  onAddFormatItem,
  onUpdateFormatItemLabel,
  onToggleFormatItemChecked,
  onDeleteCheckedFormatItems,
  onSaveFormatItems
}: VoiceManagerDialogProps) {
  const normalizedFormatItems = useMemo<FormatItem[]>(() => {
    const base = Array.isArray(formatOptions) ? formatOptions : [];
    const withChecked = base.map((item) => ({
      id: String(item.id || ""),
      label: String(item.label || ""),
      checked: false
    }));
    const hasKids = withChecked.some((item) => item.id === "kids");
    return hasKids
      ? withChecked
      : [...withChecked, { id: "kids", label: "Kid Voice", checked: false }];
  }, [formatOptions]);

  const normalizedVoiceConfigDraft = useMemo(
    () => normalizeVoiceConfigDraft(voiceConfigDraft),
    [voiceConfigDraft]
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [showCreateVoicePanel, setShowCreateVoicePanel] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedExportVoiceIds, setSelectedExportVoiceIds] = useState<string[]>([]);
  const [showFormatManagerDialog, setShowFormatManagerDialog] = useState(false);
  const [localFormatItems, setLocalFormatItems] = useState<FormatItem[]>(normalizedFormatItems);
  const [localSelectedFormat, setLocalSelectedFormat] = useState(selectedFormat || "single");
  const [localSelectedLanguage, setLocalSelectedLanguage] = useState<"en">("en");
  const [searchQuery, setSearchQuery] = useState("");
  const [manageFormatFilter, setManageFormatFilter] = useState<string>(selectedFormat || "all");
  const [manageVoiceTypeFilter, setManageVoiceTypeFilter] = useState<"all" | "male" | "female">("all");
  const [isEditingVoiceConfig, setIsEditingVoiceConfig] = useState(false);
  const [createVoiceConfigDraft, setCreateVoiceConfigDraft] = useState<VoiceConfigDraft>(
    createDefaultVoiceConfigDraft()
  );

  const effectiveFormatOptions = useMemo(() => normalizedFormatItems, [normalizedFormatItems]);
  const selectedIds = useMemo(
    () => selectedCustomVoiceSet || new Set(selectedCustomVoiceIds),
    [selectedCustomVoiceIds, selectedCustomVoiceSet]
  );

  const isPodcastCreate = localSelectedFormat === "podcast";

  const createVoiceTypeOptions = useMemo(() => {
    if (isPodcastCreate) {
      return [{ value: "podcast" as const, label: "Podcast" }];
    }
    return getVoiceTypeOptionsByLanguage(localSelectedLanguage);
  }, [isPodcastCreate, localSelectedLanguage]);

  const manageVoiceTypeOptions = useMemo(
    () => [
      { value: "all" as const, label: "Tất cả" },
      { value: "female" as const, label: "Female" },
      { value: "male" as const, label: "Male" }
    ],
    []
  );

  useEffect(() => {
    setLocalFormatItems(effectiveFormatOptions.map((item) => ({ ...item, checked: false })));
  }, [effectiveFormatOptions, show]);

  useEffect(() => {
    if (!show) {
      setShowCreateVoicePanel(false);
      setIsEditingVoiceConfig(false);
      return;
    }

    const nextFormat = selectedFormat || "all";
    setManageFormatFilter(nextFormat);
    setManageVoiceTypeFilter("all");
  }, [show, selectedFormat]);

  useEffect(() => {
    if (!isVoiceConfigDirty) {
      setIsEditingVoiceConfig(false);
    }
  }, [isVoiceConfigDirty]);

  useEffect(() => {
    if (selectedFormat && selectedFormat !== localSelectedFormat) {
      setLocalSelectedFormat(selectedFormat);
    }
  }, [selectedFormat, localSelectedFormat]);

  useEffect(() => {
    if (selectedLanguage && selectedLanguage !== localSelectedLanguage) {
      setLocalSelectedLanguage(selectedLanguage);
    }
  }, [selectedLanguage, localSelectedLanguage]);

  useEffect(() => {
    if (manageFormatFilter === "podcast" && manageVoiceTypeFilter !== "all") {
      setManageVoiceTypeFilter("all");
    }
  }, [manageFormatFilter, manageVoiceTypeFilter]);

  useEffect(() => {
    if (!selectedVoiceId) return;

    const selectedItem = customVoiceItems.find((item) => item.id === selectedVoiceId);
    if (!selectedItem?.voiceType) return;

    const nextFormat = String(selectedItem.formatId || selectedFormat || "single").trim() || "single";
    setManageFormatFilter(nextFormat);

    if (nextFormat === "podcast") {
      setManageVoiceTypeFilter("all");
    } else {
      setManageVoiceTypeFilter(
        String(selectedItem.voiceType) === "englishMale" ? "male" : "female"
      );
    }
  }, [customVoiceItems, selectedFormat, selectedVoiceId]);

  useEffect(() => {
    const allowedValues = new Set(manageVoiceTypeOptions.map((item) => item.value));
    if (manageVoiceTypeFilter !== "all" && !allowedValues.has(manageVoiceTypeFilter)) {
      setManageVoiceTypeFilter("all");
    }
  }, [manageVoiceTypeFilter, manageVoiceTypeOptions]);

  useEffect(() => {
    if (!showCreateVoicePanel) return;
    setCreateVoiceConfigDraft(normalizeVoiceConfigDraft(voiceConfigDraft));
  }, [showCreateVoicePanel, voiceConfigDraft]);

  useEffect(() => {
    if (!showCreateVoicePanel) return;

    if (isPodcastCreate) {
      if (form.voiceType !== "podcast") {
        setForm((prev) => ({ ...prev, voiceType: "podcast", apiId: "" }));
      }
      if (selectedVoiceType !== "podcast") {
        setSelectedVoiceType?.("podcast");
      }
      return;
    }

    const allowed = getVoiceTypeOptionsByLanguage(localSelectedLanguage).map((item) => item.value);
    if (!allowed.includes(form.voiceType as any) || form.voiceType === "podcast") {
      const nextType = allowed[0];
      setForm((prev) => ({ ...prev, voiceType: nextType, apiId: "" }));
      setSelectedVoiceType?.(nextType);
    }
  }, [
    form.voiceType,
    isPodcastCreate,
    localSelectedLanguage,
    selectedVoiceType,
    setForm,
    setSelectedVoiceType,
    showCreateVoicePanel
  ]);
  
  const effectiveVoiceTypeFilter =
    manageFormatFilter === "podcast" ? "all" : manageVoiceTypeFilter;

  const filteredVoices = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    return customVoiceItems.filter((item) => {
      if (!item.voiceType) return false;

      const itemFormatId = String(item.formatId || "single").trim() || "single";
      const label = String(item.label || "").toLowerCase();
      const apiId = String(item.apiId || item.id || "").toLowerCase();
      const description = String(item.description || "").toLowerCase();
      const itemGroup =
        item.voiceType === "podcast"
          ? "podcast"
          : String(item.voiceType) === "englishMale"
            ? "male"
            : "female";

      if (manageFormatFilter !== "all" && itemFormatId !== manageFormatFilter) return false;
      if (effectiveVoiceTypeFilter !== "all" && itemGroup !== effectiveVoiceTypeFilter) return false;

      if (keyword) {
        const haystack = [label, apiId, description, itemFormatId].join(" ");
        if (!haystack.includes(keyword)) return false;
      }

      return true;
    });
  }, [
    customVoiceItems,
    manageFormatFilter,
    manageVoiceTypeFilter,
    searchQuery
  ]);

  useEffect(() => {
    setSelectedExportVoiceIds((prev) => {
      const allowed = new Set(filteredVoices.map((item) => item.id));
      const next = prev.filter((id) => allowed.has(id));
      return next.length ? next : filteredVoices.map((item) => item.id);
    });
  }, [filteredVoices]);

  const activeVoice = selectedVoiceId
    ? customVoiceItems.find((item) => item.id === selectedVoiceId) || null
    : filteredVoices[0] || null;

  const createVoiceBaseOptions = useMemo(() => {
    if (isPodcastCreate) {
      return [
        {
          id: "podcast_pair_1",
          apiId: "Puck|Kore",
          label: "Puck + Kore",
          voiceType: "podcast" as const,
          formatId: "podcast",
          description: "A = Puck, R = Kore"
        },
        {
          id: "podcast_pair_2",
          apiId: "Charon|Kore",
          label: "Charon + Kore",
          voiceType: "podcast" as const,
          formatId: "podcast",
          description: "A = Charon, R = Kore"
        },
        {
          id: "podcast_pair_3",
          apiId: "Puck|Zephyr",
          label: "Puck + Zephyr",
          voiceType: "podcast" as const,
          formatId: "podcast",
          description: "A = Puck, R = Zephyr"
        }
      ];
    }

    const customBaseOptions = customVoiceItems
      .filter((item) => {
        if (!item.voiceType || item.voiceType === "podcast") return false;
        if (item.voiceType !== form.voiceType) return false;
        const itemFormatId = String(item.formatId || "single").trim() || "single";
        if (localSelectedFormat && itemFormatId !== localSelectedFormat) return false;
        return true;
      })
      .map((item) => ({
        id: item.id,
        apiId: String(item.apiId || item.id || ""),
        label: item.label,
        voiceType: item.voiceType as VoiceTypeOption,
        formatId: String(item.formatId || "single").trim() || "single",
        description: item.description || ""
      }));

    const builtInOptions = BUILT_IN_BASE_VOICES.filter((item) => {
      if (item.voiceType !== form.voiceType) return false;
      if (localSelectedFormat && item.formatId !== localSelectedFormat) return false;
      return true;
    });

    const seen = new Set<string>();

    return [...builtInOptions, ...customBaseOptions]
      .filter((item) => {
        const key = String(item.apiId || item.id);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""), "vi"));
  }, [customVoiceItems, form.voiceType, isPodcastCreate, localSelectedFormat]);

  if (!show) return null;

  const handlePickFile = () => fileInputRef.current?.click();

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setIsImporting(true);
    try {
      await onImport(file);
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const selectedCount = selectedCustomVoiceIds.length;

  const handleOpenFormatDialog = () => {
    onOpenFormatManager?.();
    setLocalFormatItems(normalizedFormatItems.map((item) => ({ ...item, checked: false })));
    setShowFormatManagerDialog(true);
  };

  const handleAddFormatRow = () => {
    if (onAddFormatItem) return onAddFormatItem();
    setLocalFormatItems((prev) => [...prev, makeFormatItem()]);
  };

  const handleUpdateFormatLabel = (id: string, value: string) => {
    if (onUpdateFormatItemLabel) return onUpdateFormatItemLabel(id, value);
    setLocalFormatItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, label: value } : item))
    );
  };

  const handleToggleFormatChecked = (id: string, checked: boolean) => {
    if (onToggleFormatItemChecked) return onToggleFormatItemChecked(id, checked);
    setLocalFormatItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked } : item))
    );
  };

  const handleDeleteCheckedFormats = () => {
    if (onDeleteCheckedFormatItems) return onDeleteCheckedFormatItems();
    const protectedIds = new Set(["podcast", "single"]);
    const next = localFormatItems.filter(
      (item) => !(item.checked && !protectedIds.has(item.id))
    );
    setLocalFormatItems(next.length ? next : localFormatItems);
  };

  const handleSaveFormatDialog = () => {
    onSaveFormatItems?.();
    setShowFormatManagerDialog(false);
  };

  const displayedFormatItems =
    onAddFormatItem ||
    onUpdateFormatItemLabel ||
    onToggleFormatItemChecked ||
    onDeleteCheckedFormatItems ||
    onSaveFormatItems
      ? normalizedFormatItems
      : localFormatItems;

  const activeFormatLabel =
    effectiveFormatOptions.find((item) => item.id === (activeVoice?.formatId || "single"))
      ?.label ||
    activeVoice?.formatId ||
    "Single";

  const handleCreateSave = async () => {
    const safeLabel = String(form.label || "").trim();
    const safeApiId = String(form.apiId || "").trim();
    const nextFormat = localSelectedFormat || "single";
    const nextLanguage = localSelectedLanguage;
    const nextVoiceType = isPodcastCreate
      ? "podcast"
      : ((form.voiceType && form.voiceType !== "podcast"
          ? form.voiceType
          : createVoiceTypeOptions[0]?.value) || "englishFemale");

    const nextId =
      String(form.id || "").trim() ||
      slugifyVoiceId(`${safeLabel || safeApiId || nextVoiceType}-${nextFormat}`);

    setSelectedFormat?.(nextFormat);
    setSelectedLanguage?.(nextLanguage);
    setSelectedVoiceType?.(nextVoiceType);

    setForm((prev) => ({
      ...prev,
      id: nextId,
      voiceType: nextVoiceType,
      apiId: safeApiId
    }));

    setVoiceConfigDraft?.(normalizeVoiceConfigDraft(createVoiceConfigDraft));

    const result = await onSave();
    if (result !== false) {
      setShowCreateVoicePanel(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4">
        <div className="flex h-[92vh] max-h-[92vh] w-full max-w-7xl min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="border-b px-5 py-4">
            <div className="text-lg font-semibold text-slate-800">Voice Manager</div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden p-5">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-600">Tìm voice</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <FaSearch />
                      </span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tên voice, API ID, mô tả..."
                        className="w-full rounded-xl border py-2 pl-9 pr-3"
                      />
                    </div>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-600">Format</span>
                    <div className="flex gap-2">
                      <select
                        value={manageFormatFilter}
                        onChange={(e) => setManageFormatFilter(e.target.value)}
                        className="w-full rounded-xl border px-3 py-1.5"
                      >
                        <option value="all">Tất cả format</option>
                        {effectiveFormatOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>

                    </div>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-600">Loại giọng</span>
                    <select
                      value={manageFormatFilter === "podcast" ? "all" : manageVoiceTypeFilter}
                      onChange={(e) =>
                        setManageVoiceTypeFilter(e.target.value as "all" | "male" | "female")
                      }
                      disabled={manageFormatFilter === "podcast"}
                      className="w-full rounded-xl border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      {manageVoiceTypeOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <div className="flex min-w-[320px] flex-col items-end gap-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.json"
                      onChange={handleImportFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={handlePickFile}
                      disabled={isImporting}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      <FaFileImport />
                      {isImporting ? "Đang import..." : "Import Voice"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowExportDialog(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300"
                    >
                      <FaFileExport />
                      Export Voice
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextFormat = selectedFormat || "single";
                        setLocalSelectedFormat(nextFormat);
                        const nextType =
                          nextFormat === "podcast"
                            ? "podcast"
                            : String(selectedVoiceType) === "englishMale" ||
                                String(selectedVoiceType) === "englishFemale"
                              ? selectedVoiceType
                              : "englishFemale";
                        setForm((prev) => ({ ...prev, voiceType: nextType, apiId: nextFormat === "podcast" ? "" : prev.apiId }));
                        setCreateVoiceConfigDraft(normalizeVoiceConfigDraft(voiceConfigDraft));
                        setShowCreateVoicePanel(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <FaPlus />
                      Tạo Voice mới
                    </button>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        downloadTextFile("voice_import_sample.csv", SAMPLE_CSV_NEW, "text/csv")
                      }
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Mẫu CSV mới
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadTextFile("voice_import_sample.json", SAMPLE_JSON, "application/json")
                      }
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Mẫu JSON
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  Tổng voice hiển thị: {filteredVoices.length}
                </span>
                {importFileName ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                    File đã chọn: {importFileName}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-2">
                <div className="min-h-0">
                  <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-800">Danh sách Voice</div>
                        <div className="text-sm text-slate-500">
                          Hiển thị toàn bộ voice. Dùng bộ lọc phía trên để thu hẹp danh sách.
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onSelectAllCustomVoices?.(filteredVoices.map((item) => item.id))
                          }
                          className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                        >
                          Chọn tất cả
                        </button>
                        <button
                          type="button"
                          onClick={onClearSelectedCustomVoices}
                          className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                      {filteredVoices.length ? (
                        filteredVoices.map((item) => {
                          const checked = selectedIds.has(item.id);
                          const isActive = activeVoice?.id === item.id;
                          const itemFormatLabel =
                            effectiveFormatOptions.find(
                              (formatItem) =>
                                formatItem.id ===
                                (String(item.formatId || "single").trim() || "single")
                            )?.label || item.formatId || "Single";
                          const itemLanguage =
                            item.voiceType === "podcast" ? "Podcast" : "English";
                          return (
                            <div
                              key={item.id}
                              className={`rounded-2xl border p-3 transition ${
                                isActive
                                  ? "border-blue-300 bg-blue-50"
                                  : "border-slate-200 bg-white hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => onToggleCustomVoiceSelected?.(item.id)}
                                  className="mt-1"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextFormat = String(item.formatId || "single").trim() || "single";
                                    setManageFormatFilter(nextFormat);

                                    if (nextFormat === "podcast") {
                                      setManageVoiceTypeFilter("all");
                                    } else {
                                      setManageVoiceTypeFilter(
                                        String(item.voiceType) === "englishMale" ? "male" : "female"
                                      );
                                    }

                                    onSelectVoice?.(item.id);
                                  }}
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="font-medium text-slate-800">{item.label}</div>
                                    <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                                      {getVoiceTypeLabel(item.voiceType)}
                                    </span>
                                    <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                                      {itemFormatLabel}
                                    </span>
                                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                                      {itemLanguage}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-sm text-slate-500">
                                    API ID: {item.apiId || item.id}
                                  </div>
                                  <div className="mt-0.5 truncate text-sm text-slate-500">
                                    {item.description?.trim() || "Không có mô tả"}
                                  </div>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">
                          Không có voice nào khớp với bộ lọc hiện tại.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="min-h-0">
                  <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="font-medium text-slate-800">Chi tiết cấu hình Voice</div>
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingVoiceConfig && isVoiceConfigDirty) {
                            onSaveVoiceConfig?.();
                          } else {
                            setIsEditingVoiceConfig(true);
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm text-white"
                      >
                        <FaSave />
                        {isEditingVoiceConfig ? "Lưu" : "Sửa"}
                      </button>
                    </div>

                    {activeVoice ? (
                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
                          <div className="font-medium text-slate-800">{activeVoice.label}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            API ID: {activeVoice.apiId || activeVoice.id}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            Format: {activeFormatLabel}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {activeVoice.description?.trim() || "Không có mô tả"}
                          </div>
                        </div>

                        {(activeVoice?.voiceType === "podcast" ||
                          activeVoice?.mode === "podcast" ||
                          (activeVoice?.formatId || "single") === "podcast") ? (
                          <PodcastDualConfigGrid
                            leftTitle="Giọng A"
                            rightTitle="Giọng R"
                            leftDraft={normalizedVoiceConfigDraft.A}
                            rightDraft={normalizedVoiceConfigDraft.R}
                            disabled={!isEditingVoiceConfig}
                            onChangeLeft={(next) =>
                              setVoiceConfigDraft?.((prev) => ({
                                ...normalizeVoiceConfigDraft(prev),
                                A: normalizeSpeakerDraft(next)
                              }))
                            }
                            onChangeRight={(next) =>
                              setVoiceConfigDraft?.((prev) => ({
                                ...normalizeVoiceConfigDraft(prev),
                                R: normalizeSpeakerDraft(next)
                              }))
                            }
                          />
                        ) : (
                          <SpeakerConfigColumn
                            title="Voice Config"
                            draft={normalizedVoiceConfigDraft.A}
                            disabled={!isEditingVoiceConfig}
                            onChange={(next) =>
                              setVoiceConfigDraft?.((prev) => ({
                                ...normalizeVoiceConfigDraft(prev),
                                A: normalizeSpeakerDraft(next),
                                R: normalizeSpeakerDraft(next)
                              }))
                            }
                          />
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                        Chọn một voice ở danh sách bên trái để xem cấu hình.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <div className="px-5 pb-2">
              <div className="rounded-xl bg-red-50 px-3 py-1.5 text-sm text-red-700">{error}</div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-200 px-4 py-2 text-slate-800"
            >
              <FaTimes />
              Đóng
            </button>
            <button
              type="button"
              onClick={onDeleteSelectedCustomVoices}
              disabled={!selectedCount}
              className="rounded-xl bg-rose-600 px-4 py-2 text-white disabled:opacity-50"
            >
              Xóa {selectedCount ? `(${selectedCount})` : ""}
            </button>
            <button
              type="button"
              onClick={onPreview}
              disabled={isPreviewing || !activeVoice}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-white disabled:opacity-60"
            >
              {isPreviewing ? "Đang nghe thử..." : "Nghe thử"}
            </button>
          </div>
        </div>
      </div>

      {showExportDialog ? (
        <div className="fixed inset-0 z-[141] flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="border-b px-5 py-4">
              <div className="text-lg font-semibold text-slate-800">Export Voice</div>
              <div className="mt-1 text-sm text-slate-500">
                Chọn voice cần xuất rồi bấm Xuất file.
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={
                    filteredVoices.length > 0 &&
                    selectedExportVoiceIds.length === filteredVoices.length
                  }
                  onChange={(e) =>
                    setSelectedExportVoiceIds(
                      e.target.checked ? filteredVoices.map((item) => item.id) : []
                    )
                  }
                />
                Chọn tất cả
              </label>
              <div className="text-sm text-slate-500">
                Đã chọn: {selectedExportVoiceIds.length}
              </div>
            </div>
            <div className="flex-1 overflow-hidden p-5">
              <div className="space-y-2">
                {filteredVoices.length ? (
                  filteredVoices.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-2 rounded-2xl border border-slate-200 p-3"
                    >
                      <input
                        type="checkbox"
                        checked={selectedExportVoiceIds.includes(item.id)}
                        onChange={(e) =>
                          setSelectedExportVoiceIds((prev) =>
                            e.target.checked
                              ? [...prev, item.id]
                              : prev.filter((id) => id !== item.id)
                          )
                        }
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800">{item.label}</div>
                        <div className="text-xs text-slate-500">
                          {getVoiceTypeLabel(item.voiceType)} · {item.apiId || item.id} ·{" "}
                          {item.formatId || "single"}
                        </div>
                      </div>
                    </label>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">Không có voice để xuất.</div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button
                type="button"
                onClick={() => setShowExportDialog(false)}
                className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={!selectedExportVoiceIds.length}
                onClick={() => {
                  const payload = filteredVoices.filter((item) =>
                    selectedExportVoiceIds.includes(item.id)
                  );
                  downloadJson("voices_export.json", payload);
                  setShowExportDialog(false);
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Xuất file
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showFormatManagerDialog ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="border-b px-5 py-4">
              <div className="text-lg font-semibold text-slate-800">Format Manager</div>
            </div>
            <div className="flex-1 overflow-hidden p-5">
              <div className="space-y-2">
                {displayedFormatItems.map((item, index) => {
                  const isProtected = item.id === "podcast" || item.id === "single";
                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 p-3 md:grid-cols-[120px_minmax(0,1fr)_60px]"
                    >
                      <div className="flex items-center text-sm font-medium text-slate-700">
                        Format {index + 1}
                      </div>
                      <input
                        type="text"
                        value={item.label}
                        disabled={isProtected}
                        onChange={(e) => handleUpdateFormatLabel(item.id, e.target.value)}
                        className="w-full rounded-xl border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
                        placeholder="Nhập tên format"
                      />
                      <label className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          disabled={isProtected}
                          checked={!!item.checked}
                          onChange={(e) => handleToggleFormatChecked(item.id, e.target.checked)}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleAddFormatRow}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Thêm dòng
                </button>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-4">
              <button
                type="button"
                onClick={handleDeleteCheckedFormats}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white"
              >
                Xóa
              </button>
              <button
                type="button"
                onClick={handleSaveFormatDialog}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowFormatManagerDialog(false)}
                className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateVoicePanel ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-2 border-b px-5 py-4">
              <div className="text-lg font-semibold text-slate-800">Tạo Voice mới</div>
              <button
                type="button"
                onClick={() => setShowCreateVoicePanel(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <FaTimes />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-600">Format</span>
                    <select
                      value={localSelectedFormat}
                      onChange={(e) => {
                        const next = e.target.value;
                        setLocalSelectedFormat(next);
                        setSelectedFormat?.(next);

                        if (next === "podcast") {
                          setForm((prev) => ({ ...prev, voiceType: "podcast", apiId: "" }));
                          setSelectedVoiceType?.("podcast");
                        } else {
                          const defaultType = form.voiceType === "englishMale" ? "englishMale" : "englishFemale";
                          setForm((prev) => ({ ...prev, voiceType: defaultType, apiId: "" }));
                          setSelectedVoiceType?.(defaultType);
                        }
                      }}
                      className="w-full rounded-xl border px-3 py-1.5"
                    >
                      {effectiveFormatOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-600">Loại giọng</span>
                    <select
                      value={isPodcastCreate ? "podcast" : form.voiceType}
                      disabled={isPodcastCreate}
                      onChange={(e) => {
                        const nextType = e.target.value as VoiceTypeOption;
                        setSelectedVoiceType?.(nextType);
                        setForm((prev) => ({ ...prev, voiceType: nextType, apiId: "" }));
                      }}
                      className="w-full rounded-xl border px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {createVoiceTypeOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-600">Giọng gốc</span>
                    <select
                      value={form.apiId}
                      onChange={(e) => {
                        const nextApiId = e.target.value;
                        const baseVoice = createVoiceBaseOptions.find(
                          (item) => String(item.apiId || item.id) === nextApiId
                        );
                        setForm((prev) => ({
                          ...prev,
                          apiId: nextApiId,
                          voiceType: (baseVoice?.voiceType || prev.voiceType) as VoiceTypeOption
                        }));
                      }}
                      className="w-full rounded-xl border px-3 py-1.5"
                    >
                      <option value="">Chọn giọng gốc...</option>
                      {createVoiceBaseOptions.map((item) => {
                        const optionValue = String(item.apiId || item.id);
                        return (
                          <option key={`${item.id}_${optionValue}`} value={optionValue}>
                            {item.label} - {optionValue}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-600">Tên giọng</span>
                    <input
                      type="text"
                      value={form.label}
                      onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                      className="w-full rounded-xl border px-3 py-1.5"
                    />
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">Mô tả</span>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="min-h-[84px] w-full rounded-xl border px-3 py-1.5"
                  />
                </label>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">

                {isPodcastCreate ? (
                  <PodcastDualConfigGrid
                    leftTitle="Giọng A"
                    rightTitle="Giọng R"
                    leftDraft={createVoiceConfigDraft.A}
                    rightDraft={createVoiceConfigDraft.R}
                    onChangeLeft={(next) =>
                      setCreateVoiceConfigDraft((prev) => ({
                        ...normalizeVoiceConfigDraft(prev),
                        A: normalizeSpeakerDraft(next)
                      }))
                    }
                    onChangeRight={(next) =>
                      setCreateVoiceConfigDraft((prev) => ({
                        ...normalizeVoiceConfigDraft(prev),
                        R: normalizeSpeakerDraft(next)
                      }))
                    }
                  />
                ) : (
                  <SpeakerConfigColumn
                    title="Voice Config"
                    draft={createVoiceConfigDraft.A}
                    onChange={(next) =>
                      setCreateVoiceConfigDraft({
                        A: normalizeSpeakerDraft(next),
                        R: normalizeSpeakerDraft(next)
                      })
                    }
                  />
                )}
              </div>
            </div>

            <div className="border-t px-5 py-4">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateVoicePanel(false)}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-200 px-4 py-2 text-slate-800"
                >
                  <FaTimes />
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleCreateSave}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white"
                >
                  <FaSave />
                  Lưu giọng mới
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}