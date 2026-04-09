import type {
  LanguageOption,
  VoiceFormat,
  VoiceProfileOption,
  VoiceTypeOption
} from "./voiceUtils";

export const PRESET_STORAGE_KEY = "easy-english-voice-generator-presets";
export const UI_PROFILE_STORAGE_KEY = "easy-english-voice-generator-ui-profile";

export type SpeakerPreset = {
  speed: number;
  pitch: number;
  pause: number;
  style: string;
};

export type SpeakerSettings = {
  A: SpeakerPreset;
  R: SpeakerPreset;
  blockPause: number;
};

export type SavedPreset = {
  id: string;
  name: string;
  settings: SpeakerSettings;
  voiceType: VoiceTypeOption;
  voiceName: string;
  format: VoiceFormat;
  language: LanguageOption;
  voiceProfile: VoiceProfileOption;
};

export type UiProfile = {
  format: VoiceFormat;
  language: LanguageOption;
  voiceProfile: VoiceProfileOption;
};

export const DEFAULT_SPEAKER_SETTINGS: SpeakerSettings = {
  A: {
    speed: 0.82,
    pitch: 1,
    pause: 0.4,
    style: "Friendly teacher voice, slow, clear, and easy to understand for learners."
  },
  R: {
    speed: 0.9,
    pitch: 1,
    pause: 0.3,
    style: "Natural response voice, friendly, slightly faster, positive, and supportive."
  },
  blockPause: 1.5
};

export const FORMAT_OPTIONS: Array<{
  value: VoiceFormat;
  label: string;
  note: string;
}> = [
  { value: "podcast", label: "Podcast", note: "Keep the current A/R workflow" },
  { value: "single", label: "Single Voice", note: "Single voice workflow" },
  { value: "kids", label: "Kids", note: "Suitable for kids content" },
  { value: "teaching", label: "Teaching", note: "Suitable for lessons and listening practice" }
];

export const LANGUAGE_OPTIONS: Array<{
  value: LanguageOption;
  label: string;
}> = [
  { value: "en", label: "English" }
];

export const VOICE_PROFILE_OPTIONS: Array<{
  value: VoiceProfileOption;
  label: string;
  note: string;
}> = [
  { value: "default", label: "Default", note: "Balanced and safe" },
  { value: "warm", label: "Warm", note: "Warmer and more natural" },
  { value: "clear", label: "Clear", note: "Clean and easy to hear" },
  { value: "story", label: "Story", note: "Softer and better for storytelling" }
];

export function cloneSpeakerSettings(settings: SpeakerSettings): SpeakerSettings {
  return {
    A: { ...settings.A },
    R: { ...settings.R },
    blockPause: settings.blockPause
  };
}

export function isSameSettings(a: SpeakerSettings, b: SpeakerSettings) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function getDefaultPresetMeta() {
  return {
    voiceType: "podcast" as VoiceTypeOption,
    voiceName: "podcast-default",
    format: "podcast" as VoiceFormat,
    language: "en" as LanguageOption,
    voiceProfile: "default" as VoiceProfileOption
  };
}

export function loadSavedPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        const fallback = getDefaultPresetMeta();

        const voiceType: VoiceTypeOption =
          item?.voiceType === "podcast" ||
          item?.voiceType === "englishMale" ||
          item?.voiceType === "englishFemale"
            ? item.voiceType
            : fallback.voiceType;

        const format: VoiceFormat = FORMAT_OPTIONS.some((x) => x.value === item?.format)
          ? item.format
          : fallback.format;

        const language: LanguageOption = item?.language === "en" ? "en" : fallback.language;

        const voiceProfile: VoiceProfileOption = VOICE_PROFILE_OPTIONS.some(
          (x) => x.value === item?.voiceProfile
        )
          ? item.voiceProfile
          : fallback.voiceProfile;

        return {
          id: String(item?.id || ""),
          name: String(item?.name || "").trim(),
          settings: {
            A: {
              speed: Number(item?.settings?.A?.speed ?? DEFAULT_SPEAKER_SETTINGS.A.speed),
              pitch: Number(item?.settings?.A?.pitch ?? DEFAULT_SPEAKER_SETTINGS.A.pitch),
              pause: Number(item?.settings?.A?.pause ?? DEFAULT_SPEAKER_SETTINGS.A.pause),
              style: String(item?.settings?.A?.style ?? DEFAULT_SPEAKER_SETTINGS.A.style)
            },
            R: {
              speed: Number(item?.settings?.R?.speed ?? DEFAULT_SPEAKER_SETTINGS.R.speed),
              pitch: Number(item?.settings?.R?.pitch ?? DEFAULT_SPEAKER_SETTINGS.R.pitch),
              pause: Number(item?.settings?.R?.pause ?? DEFAULT_SPEAKER_SETTINGS.R.pause),
              style: String(item?.settings?.R?.style ?? DEFAULT_SPEAKER_SETTINGS.R.style)
            },
            blockPause: Number(
              item?.settings?.blockPause ?? DEFAULT_SPEAKER_SETTINGS.blockPause
            )
          },
          voiceType,
          voiceName: String(item?.voiceName || "").trim(),
          format,
          language,
          voiceProfile
        };
      })
      .filter((item) => item.id && item.name);
  } catch {
    return [];
  }
}

export function savePresetsToStorage(presets: SavedPreset[]) {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

export function loadUiProfile(): UiProfile {
  try {
    const raw = localStorage.getItem(UI_PROFILE_STORAGE_KEY);
    if (!raw) {
      return {
        format: "podcast",
        language: "en",
        voiceProfile: "default"
      };
    }

    const parsed = JSON.parse(raw);

    const format: VoiceFormat = FORMAT_OPTIONS.some((item) => item.value === parsed?.format)
      ? parsed.format
      : "podcast";

    const language: LanguageOption = "en";

    const voiceProfile: VoiceProfileOption = VOICE_PROFILE_OPTIONS.some(
      (item) => item.value === parsed?.voiceProfile
    )
      ? parsed.voiceProfile
      : "default";

    return { format, language, voiceProfile };
  } catch {
    return {
      format: "podcast",
      language: "en",
      voiceProfile: "default"
    };
  }
}

export function saveUiProfile(profile: UiProfile) {
  localStorage.setItem(UI_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export function getTextPlaceholder(format: VoiceFormat, language: LanguageOption) {
  void language;

  if (format === "kids") {
    return "A: Hello kids. Today we are going to learn with a fun and friendly voice.";
  }

  if (format === "single") {
    return "A: Hello everyone. In this lesson, we will practice useful English expressions.";
  }

  if (format === "teaching") {
    return "A: Today we will learn three useful English phrases.\nR: Great. Can you explain the first one slowly?";
  }

  return "A: Hello everyone, welcome to our show.\nR: Today we will discuss a useful topic.";
}

export function applyUiProfileToSpeakerSettings(
  current: SpeakerSettings,
  profile: UiProfile
): SpeakerSettings {
  const next = cloneSpeakerSettings(current);

  if (profile.voiceProfile === "warm") {
    next.A.style =
      "Warm, friendly, natural voice with a clear and easy rhythm.";
    next.R.style =
      "Warm response voice, natural, supportive, and positive.";
    next.A.speed = 0.84;
    next.R.speed = 0.9;
  } else if (profile.voiceProfile === "clear") {
    next.A.style =
      "Clear pronunciation, clean and structured delivery, good for teaching and listening practice.";
    next.R.style =
      "Clear response voice, concise, bright, and professional.";
    next.A.speed = 0.8;
    next.R.speed = 0.86;
  } else if (profile.voiceProfile === "story") {
    next.A.style =
      "Natural storytelling voice, soft, slightly emotional, and engaging.";
    next.R.style =
      "Soft response voice, natural, with a smooth rhythm.";
    next.A.speed = 0.83;
    next.R.speed = 0.88;
  } else {
    next.A.style =
      "Friendly teacher voice, slow, clear, and easy to understand for learners.";
    next.R.style =
      "Natural response voice, friendly, slightly faster, positive, and supportive.";
    next.A.speed = 0.82;
    next.R.speed = 0.9;
  }

  if (profile.format === "single") {
    next.R.pause = 0.15;
    next.blockPause = 1.1;
  } else if (profile.format === "kids") {
    next.A.pause = 0.45;
    next.R.pause = 0.32;
    next.blockPause = 1.4;
    next.A.speed = Math.min(next.A.speed, 0.9);
    next.R.speed = Math.min(next.R.speed, 0.95);
  } else if (profile.format === "teaching") {
    next.A.pause = 0.5;
    next.R.pause = 0.35;
    next.blockPause = 1.6;
  } else {
    next.A.pause = 0.4;
    next.R.pause = 0.3;
    next.blockPause = 1.5;
  }

  return next;
}
