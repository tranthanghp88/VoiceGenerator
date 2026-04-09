import { fixMojibake, normalizeText } from "../utils/textEncoding";
import type { VoiceCatalogItem } from "./voiceUtils";

const CUSTOM_VOICE_STORAGE_KEY = "easy-english-voice-generator-custom-voices";

function normalizeVoiceItem(item: any): VoiceCatalogItem {
  return {
    id: normalizeText(item?.id),
    apiId: normalizeText(item?.apiId),
    label: normalizeText(item?.label),
    description: normalizeText(item?.description),
    mode: normalizeText(item?.mode || "single") || "single",
    language: normalizeText(item?.language),
    gender: normalizeText(item?.gender),
    formatId: normalizeText(item?.formatId || "single") || "single"
  };
}

export function loadCustomVoices(): VoiceCatalogItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_VOICE_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeVoiceItem)
      .filter((item) => item.id && item.label);
  } catch {
    return [];
  }
}

export function saveCustomVoices(voices: VoiceCatalogItem[]) {
  const normalized = (Array.isArray(voices) ? voices : [])
    .map(normalizeVoiceItem)
    .filter((item) => item.id && item.label);

  localStorage.setItem(CUSTOM_VOICE_STORAGE_KEY, JSON.stringify(normalized));
}