import { decodeImportBuffer, normalizeText } from "./textEncoding";

// utils/exportImport.ts

export function exportVoices(customVoices: any[]) {
  try {
    const data = JSON.stringify(customVoices || [], null, 2);
    const blob = new Blob(["\uFEFF", data], {
      type: "application/json;charset=utf-8"
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "voices.json";
    a.click();
  } catch (e) {
    console.error(e);
  }
}

export function exportPresets() {
  try {
    const raw = JSON.parse(localStorage.getItem("speaker_presets") || "[]");
    const filtered = (Array.isArray(raw) ? raw : []).filter(
      (item: any) => !item?.hiddenInMainDropdown && !item?.importedFromVoice
    );

    const data = JSON.stringify(filtered, null, 2);

    const blob = new Blob(["\uFEFF", data], {
      type: "application/json;charset=utf-8"
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "presets.json";
    a.click();
  } catch (e) {
    console.error(e);
  }
}

export function exportAll(customVoices: any[]) {
  try {
    const presets = JSON.parse(localStorage.getItem("speaker_presets") || "[]");

    const data = JSON.stringify(
      {
        voices: customVoices || [],
        presets
      },
      null,
      2
    );

    const blob = new Blob(["\uFEFF", data], {
      type: "application/json;charset=utf-8"
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "full.json";
    a.click();
  } catch (e) {
    console.error(e);
  }
}

export async function importPresets(file: File) {
  try {
    const text = decodeImportBuffer(await file.arrayBuffer());

    const parsed = JSON.parse(text);

    const presets = (Array.isArray(parsed) ? parsed : parsed.presets || []).map((item: any) => ({
      ...item,
      id: normalizeText(item?.id),
      name: normalizeText(item?.name),
      voiceName: normalizeText(item?.voiceName),
      voiceType: normalizeText(item?.voiceType),
      format: normalizeText(item?.format),
      language: normalizeText(item?.language),
      voiceProfile: normalizeText(item?.voiceProfile),
      settings: {
        ...item?.settings,
        A: {
          ...item?.settings?.A,
          style: normalizeText(item?.settings?.A?.style)
        },
        R: {
          ...item?.settings?.R,
          style: normalizeText(item?.settings?.R?.style)
        }
      }
    }));

    const existing = JSON.parse(localStorage.getItem("speaker_presets") || "[]");

    localStorage.setItem(
      "speaker_presets",
      JSON.stringify([...presets, ...existing])
    );
  } catch (e) {
    console.error(e);
  }
}