import { normalizeBgmId } from "./bgmStorage";

export type ParsedBgmMarker = {
  id: string;
  duration?: number;
  volume?: number;
  mode?: "once" | "loop";
  raw: string;
};

export type ParsedScriptControl = {
  pauseSeconds?: number;
  bgm?: ParsedBgmMarker | null;
  markerLines: string[];
};

function parseNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parsePauseMarker(line: string) {
  const match = String(line || "").trim().match(/^#PAUSE\s*:\s*([0-9]*\.?[0-9]+)/i);
  if (!match) return undefined;
  return parseNumber(match[1]);
}

export function parseBgmMarker(line: string): ParsedBgmMarker | null {
  const raw = String(line || "").trim();
  const match = raw.match(/^#BGM\s*:\s*(.+)$/i);
  if (!match) return null;

  const parts = String(match[1] || "")
    .split("|")
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  const [idPart, ...rest] = parts;
  const bgm: ParsedBgmMarker = {
    id: normalizeBgmId(idPart),
    raw
  };

  rest.forEach((item) => {
    const [key, value] = item.split("=").map((part) => String(part || "").trim());
    const lowerKey = key.toLowerCase();
    if (lowerKey === "dur" || lowerKey === "duration") bgm.duration = parseNumber(value);
    if (lowerKey === "volume" || lowerKey === "vol") bgm.volume = parseNumber(value);
    if (lowerKey === "mode" && (value === "once" || value === "loop")) bgm.mode = value;
  });

  return bgm;
}

export function extractScriptControlMarkers(lines: string[]): ParsedScriptControl {
  const markerLines: string[] = [];
  let pauseSeconds: number | undefined;
  let bgm: ParsedBgmMarker | null = null;

  (lines || []).forEach((line) => {
    const raw = String(line || "").trim();
    if (!raw.startsWith("#")) return;
    markerLines.push(raw);

    const pause = parsePauseMarker(raw);
    if (typeof pause === "number") {
      pauseSeconds = pause;
      return;
    }

    const parsedBgm = parseBgmMarker(raw);
    if (parsedBgm) {
      bgm = parsedBgm;
    }
  });

  return {
    pauseSeconds,
    bgm,
    markerLines
  };
}

export function isControlMarkerLine(line: string) {
  return /^#(PAUSE|BGM)\s*:/i.test(String(line || "").trim());
}
