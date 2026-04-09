export type VoiceFormat = "podcast" | "single" | "kids" | "teaching";
export type LanguageOption = "en";
export type VoiceProfileOption = "default" | "warm" | "clear" | "story";

export type VoiceTypeOption =
  | "podcast"
  | "englishMale"
  | "englishFemale";

export type VoiceCatalogItem = {
  id: string;
  apiId?: string | null;
  label: string;
  description?: string;
  mode?: string;
  language?: string;
  gender?: string;
  formatId?: string;
  speakers?: {
    A?: string;
    R?: string;
  };
};

export type VoiceCatalog = Partial<Record<VoiceTypeOption, VoiceCatalogItem[]>>;

export type CustomVoiceForm = {
  voiceType: VoiceTypeOption;
  id: string;
  apiId: string;
  label: string;
  description: string;
};

export function normalizeTextId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

export function getPreviewText(language: LanguageOption, voiceType: VoiceTypeOption) {
  if (voiceType === "podcast") {
    return "A: Hello, this is a short preview of the current podcast voice.\nR: We are checking the speaking quality now.";
  }
  return "A: Hello, this is a short preview for the current voice variant.";
}

export function getVoiceModeFromType(voiceType: VoiceTypeOption) {
  return voiceType === "podcast" ? "podcast" : "single";
}

function inferVoiceTypeFromItem(item: VoiceCatalogItem): VoiceTypeOption | null {
  const mode = String(item.mode || "").toLowerCase();
  const formatId = String(item.formatId || "").toLowerCase();
  const gender = String(item.gender || "").toLowerCase();

  if (mode === "podcast" || formatId === "podcast") return "podcast";
  if (gender === "female") return "englishFemale";
  return "englishMale";
}

export function buildVoiceCatalogFromLocal(source: Array<any>): VoiceCatalog {
  const grouped: VoiceCatalog = {
    podcast: [],
    englishMale: [],
    englishFemale: []
  };

  source.forEach((voice) => {
    const locale = String(voice?.locale || voice?.language || "en-US").trim() || "en-US";
    const gender = String(voice?.gender || "").trim().toLowerCase();
    const rawId = String(voice?.id || voice?.apiId || "").trim();
    const id = normalizeTextId(rawId || voice?.label || "");
    const label = String(voice?.label || rawId || "").trim();
    const formatId = String(voice?.formatId || "single").trim() || "single";
    const mode = String(voice?.mode || (formatId === "podcast" ? "podcast" : "single")).trim();

    if (!id || !label) return;

    let type: VoiceTypeOption;
    if (mode === "podcast" || formatId === "podcast") type = "podcast";
    else if (gender === "female") type = "englishFemale";
    else type = "englishMale";

    grouped[type] = [
      ...(grouped[type] || []),
      {
        id,
        apiId: String(voice?.apiId || rawId || id).trim(),
        label,
        description: String(
          voice?.notes || voice?.description || `${locale} ${gender}`.trim()
        ).trim(),
        mode,
        language: locale,
        gender,
        formatId
      }
    ];
  });

  return grouped;
}

export function mergeVoiceCatalog(base: VoiceCatalog, extra: VoiceCatalog): VoiceCatalog {
  const keys: VoiceTypeOption[] = [
    "podcast",
    "englishMale",
    "englishFemale"
  ];

  const merged: VoiceCatalog = {};

  keys.forEach((key) => {
    const map = new Map<string, VoiceCatalogItem>();
    [...(base[key] || []), ...(extra[key] || [])].forEach((item) => {
      map.set(item.id, item);
    });
    merged[key] = Array.from(map.values());
  });

  return merged;
}

export function createCatalogFromAppSources(customVoices: VoiceCatalogItem[]) {
  const grouped: VoiceCatalog = {
    podcast: [],
    englishMale: [],
    englishFemale: []
  };

  customVoices.forEach((item) => {
    const type = inferVoiceTypeFromItem(item);
    if (!type) return;

    grouped[type] = [
      ...(grouped[type] || []),
      {
        ...item,
        id: String(item.id || "").trim(),
        apiId: String(item.apiId || item.id || "").trim(),
        formatId: String(item.formatId || (type === "podcast" ? "podcast" : "single")).trim() || "single"
      }
    ];
  });

  return grouped;
}
