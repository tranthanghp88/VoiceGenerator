import type { BgmAsset } from "./bgmStorage";
import { parseBgmMarker, parsePauseMarker } from "./scriptMarkers";
import type { ScriptLine } from "../hooks/useTtsJob";

export type DialogueSegment = {
  type: "dialogue";
  text: string;
  sourceStart: number;
  sourceEnd: number;
  start: number;
  end: number;
  subtitle: string;
};

export type PauseSegment = {
  type: "pause";
  duration: number;
  start: number;
  end: number;
};

export type CompositionSegment = DialogueSegment | PauseSegment;

export type MusicBed = {
  bgmId: string;
  filePath: string;
  start: number;
  duration?: number;
  volume: number;
  loop: boolean;
  duckVolume?: number;
  fadeOut?: number;
};

export type SubtitleCue = {
  start: number;
  end: number;
  text: string;
};

export type CompositionPlan = {
  segments: CompositionSegment[];
  musicBeds: MusicBed[];
  subtitles: SubtitleCue[];
  estimatedDuration: number;
};

function safeText(value: unknown) {
  return String(value || "").trim();
}

function groupByBlock(script: ScriptLine[]) {
  const map = new Map<number, ScriptLine[]>();
  (script || []).forEach((line, index) => {
    const blockId = Number(line?.blockId || index + 1);
    if (!map.has(blockId)) map.set(blockId, []);
    map.get(blockId)!.push(line);
  });
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, lines]) => lines);
}

function buildVoiceAllocations(script: ScriptLine[], sourceDuration: number) {
  const dialogueLines = (script || []).filter((line) => safeText(line?.text));
  const weights = dialogueLines.map((line) => {
    const text = safeText(line.text);
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, words * 1.6 + text.length * 0.05);
  });
  const totalWeight = weights.reduce((sum, item) => sum + item, 0) || 1;
  let cursor = 0;

  return dialogueLines.map((line, index) => {
    const duration = Math.max(0.2, sourceDuration * (weights[index] / totalWeight));
    const start = cursor;
    const end = index === dialogueLines.length - 1 ? sourceDuration : Math.min(sourceDuration, cursor + duration);
    cursor = end;
    return {
      blockId: Number(line.blockId || index + 1),
      text: safeText(line.text),
      sourceStart: Number(start.toFixed(3)),
      sourceEnd: Number(end.toFixed(3))
    };
  });
}

function findBgmAssetById(bgmAssets: BgmAsset[], id: string) {
  const needle = safeText(id).toLowerCase();
  return (
    (bgmAssets || []).find((item) => safeText(item.id).toLowerCase() === needle) ||
    (bgmAssets || []).find((item) => safeText(item.label).toLowerCase() === needle) ||
    null
  );
}

export function buildCompositionPlan(params: {
  script: ScriptLine[];
  sourceDuration: number;
  bgmAssets: BgmAsset[];
}) {
  const script = Array.isArray(params.script) ? params.script : [];
  const sourceDuration = Number(params.sourceDuration || 0);
  const bgmAssets = Array.isArray(params.bgmAssets) ? params.bgmAssets : [];

  if (!script.length) {
    throw new Error("Script trống, chưa thể dựng output.");
  }

  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) {
    throw new Error("Không đọc được thời lượng audio nguồn.");
  }

  const voiceAllocations = buildVoiceAllocations(script, sourceDuration);
  const blockGroups = groupByBlock(script);
  const segments: CompositionSegment[] = [];
  const musicBeds: MusicBed[] = [];
  const subtitles: SubtitleCue[] = [];
  const missingBgmIds = new Set<string>();

  let cursor = 0;
  let dialogueIndex = 0;

  blockGroups.forEach((blockLines) => {
    const firstLine = blockLines[0];
    const markerLines = Array.isArray(firstLine?.markerLines) ? firstLine.markerLines : [];
    let pauseSeconds = 0;
    let hasDialogueInBlock = false;

    markerLines.forEach((markerLine) => {
      const pause = parsePauseMarker(markerLine);
      if (typeof pause === "number" && pause > 0) {
        pauseSeconds = Math.max(pauseSeconds, pause);
        return;
      }

      const bgm = parseBgmMarker(markerLine);
      if (bgm?.id) {
        const asset = findBgmAssetById(bgmAssets, bgm.id);
        if (!asset?.filePath) {
          missingBgmIds.add(bgm.id);
          return;
        }

        musicBeds.push({
          bgmId: bgm.id,
          filePath: asset.filePath,
          start: Number(cursor.toFixed(3)),
          duration: Number.isFinite(Number(bgm.duration)) ? Math.max(0.2, Number(bgm.duration)) : undefined,
          volume: Number.isFinite(Number(bgm.volume)) ? Number(bgm.volume) : Number(asset.defaultVolume || 0.25),
          loop: String(bgm.mode || "").toLowerCase() === "loop",
          duckVolume: 0.08,
          fadeOut: 0.35
        });
      }
    });

    blockLines.forEach((line) => {
      const text = safeText(line.text);
      if (!text) return;
      const alloc = voiceAllocations[dialogueIndex];
      dialogueIndex += 1;
      if (!alloc) return;

      hasDialogueInBlock = true;
      const duration = Math.max(0.05, alloc.sourceEnd - alloc.sourceStart);
      const start = cursor;
      const end = cursor + duration;
      segments.push({
        type: "dialogue",
        text,
        sourceStart: alloc.sourceStart,
        sourceEnd: alloc.sourceEnd,
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
        subtitle: text
      });
      subtitles.push({
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
        text
      });
      cursor = end;
    });

    if (!hasDialogueInBlock && markerLines.some((line) => /^#BGM\s*:/i.test(String(line || "").trim()))) {
      const musicOnlyDuration = Math.max(4, pauseSeconds || 0);
      subtitles.push({
        start: Number(cursor.toFixed(3)),
        end: Number((cursor + musicOnlyDuration).toFixed(3)),
        text: "[Music]"
      });
    }

    if (pauseSeconds > 0) {
      const start = cursor;
      const end = cursor + pauseSeconds;
      segments.push({
        type: "pause",
        duration: pauseSeconds,
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3))
      });
      cursor = end;
    }
  });

  if (missingBgmIds.size) {
    throw new Error(`Thiếu file BGM cho tag: ${[...missingBgmIds].join(", ")}`);
  }

  return {
    segments,
    musicBeds,
    subtitles,
    estimatedDuration: Number(cursor.toFixed(3))
  } as CompositionPlan;
}
