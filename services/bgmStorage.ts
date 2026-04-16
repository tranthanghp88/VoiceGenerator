export type BgmAsset = {
  id: string;
  label: string;
  fileName: string;
  filePath: string;
  category?: string;
  defaultVolume?: number;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type ImportBgmAssetInput = {
  path: string;
  label?: string;
  category?: string;
  defaultVolume?: number;
  tags?: string[];
};

const STORAGE_KEY = "easy-english-voice-generator-bgm-assets";

function normalizeText(value: any) {
  return String(value ?? "").trim();
}

export function normalizeBgmId(value: any) {
  const raw = normalizeText(value).toLowerCase();
  const cleaned = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  return cleaned || `bgm_${Date.now()}`;
}

export function normalizeTags(value: any): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item).toLowerCase())
      .filter(Boolean);
  }

  return normalizeText(value)
    .split(",")
    .map((item) => normalizeText(item).toLowerCase())
    .filter(Boolean);
}

export function normalizeBgmAsset(raw: any): BgmAsset {
  return {
    id: normalizeBgmId(raw?.id || raw?.label || raw?.fileName),
    label: normalizeText(raw?.label || raw?.id || raw?.fileName || "Untitled BGM"),
    fileName: normalizeText(raw?.fileName || ""),
    filePath: normalizeText(raw?.filePath || ""),
    category: normalizeText(raw?.category || ""),
    defaultVolume: Number.isFinite(Number(raw?.defaultVolume))
      ? Number(raw?.defaultVolume)
      : 0.25,
    tags: normalizeTags(raw?.tags),
    createdAt: normalizeText(raw?.createdAt || new Date().toISOString()),
    updatedAt: normalizeText(raw?.updatedAt || new Date().toISOString())
  };
}

export function loadBgmAssetsLocal(): BgmAsset[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeBgmAsset) : [];
  } catch {
    return [];
  }
}

export function saveBgmAssetsLocal(assets: BgmAsset[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify((assets || []).map(normalizeBgmAsset)));
  } catch {}
}

export function buildBgmTag(asset: Partial<BgmAsset> | null | undefined, extra?: {
  duration?: number | string;
  volume?: number | string;
  mode?: "once" | "loop" | string;
}) {
  const id = normalizeText(asset?.id);
  if (!id) return "#BGM: ";

  const parts = [id];
  const duration = normalizeText(extra?.duration);
  const volume = normalizeText(extra?.volume ?? asset?.defaultVolume);
  const mode = normalizeText(extra?.mode);

  if (duration) parts.push(`dur=${duration}`);
  if (volume) parts.push(`volume=${volume}`);
  if (mode && (mode === "once" || mode === "loop")) parts.push(`mode=${mode}`);

  return `#BGM: ${parts.join("|")}`;
}
