export type VoiceGender = "male" | "female";
export type VoiceLocale = "vi-VN" | "en-US" | "other";
export type VoiceUseCase = "single" | "podcast" | "all";

export type VoiceOption = {
  id: string;
  label: string;
  shortLabel?: string;
  gender: VoiceGender;
  locale: VoiceLocale;
  useCase: VoiceUseCase;
  engine?: string;
  notes?: string;
};

export const VOICE_CATALOG: VoiceOption[] = [
  // ===== VIETNAMESE - MALE =====
  {
    id: "vi_male_1",
    label: "Vietnamese Male 1",
    shortLabel: "VN Male 1",
    gender: "male",
    locale: "vi-VN",
    useCase: "all",
  },
  {
    id: "vi_male_2",
    label: "Vietnamese Male 2",
    shortLabel: "VN Male 2",
    gender: "male",
    locale: "vi-VN",
    useCase: "all",
  },
  {
    id: "vi_male_3",
    label: "Vietnamese Male 3",
    shortLabel: "VN Male 3",
    gender: "male",
    locale: "vi-VN",
    useCase: "all",
  },
  {
    id: "vi_male_4",
    label: "Vietnamese Male 4",
    shortLabel: "VN Male 4",
    gender: "male",
    locale: "vi-VN",
    useCase: "all",
  },
  {
    id: "vi_male_5",
    label: "Vietnamese Male 5",
    shortLabel: "VN Male 5",
    gender: "male",
    locale: "vi-VN",
    useCase: "all",
  },
  {
    id: "vi_male_6",
    label: "Vietnamese Male 6",
    shortLabel: "VN Male 6",
    gender: "male",
    locale: "vi-VN",
    useCase: "all",
  },
  {
    id: "vi_male_7",
    label: "Vietnamese Male 7",
    shortLabel: "VN Male 7",
    gender: "male",
    locale: "vi-VN",
    useCase: "all",
  },

  // ===== VIETNAMESE - FEMALE =====
  {
    id: "vi_female_1",
    label: "Vietnamese Female 1",
    shortLabel: "VN Female 1",
    gender: "female",
    locale: "vi-VN",
    useCase: "all",
  },
  {
    id: "vi_female_2",
    label: "Vietnamese Female 2",
    shortLabel: "VN Female 2",
    gender: "female",
    locale: "vi-VN",
    useCase: "all",
  },
  {
    id: "vi_female_3",
    label: "Vietnamese Female 3",
    shortLabel: "VN Female 3",
    gender: "female",
    locale: "vi-VN",
    useCase: "all",
  },
  {
    id: "vi_female_4",
    label: "Vietnamese Female 4",
    shortLabel: "VN Female 4",
    gender: "female",
    locale: "vi-VN",
    useCase: "all",
  },
  {
    id: "vi_female_5",
    label: "Vietnamese Female 5",
    shortLabel: "VN Female 5",
    gender: "female",
    locale: "vi-VN",
    useCase: "all",
  },
  {
    id: "vi_female_6",
    label: "Vietnamese Female 6",
    shortLabel: "VN Female 6",
    gender: "female",
    locale: "vi-VN",
    useCase: "all",
  },
  {
    id: "vi_female_7",
    label: "Vietnamese Female 7",
    shortLabel: "VN Female 7",
    gender: "female",
    locale: "vi-VN",
    useCase: "all",
  },
  {
    id: "vi_female_8",
    label: "Vietnamese Female 8",
    shortLabel: "VN Female 8",
    gender: "female",
    locale: "vi-VN",
    useCase: "all",
  },

  // ===== CURRENT DEFAULT / EXISTING MAPPED VOICES =====
  {
    id: "puck",
    label: "Puck",
    shortLabel: "Puck",
    gender: "male",
    locale: "en-US",
    useCase: "podcast",
    notes: "Current Speaker A default",
  },
  {
    id: "kore",
    label: "Kore",
    shortLabel: "Kore",
    gender: "female",
    locale: "en-US",
    useCase: "podcast",
    notes: "Current Speaker R default",
  },
];

export function getVoiceById(id?: string | null) {
  if (!id) return null;
  return VOICE_CATALOG.find((voice) => voice.id === id) ?? null;
}

export function getVoicesByLocale(locale: VoiceLocale) {
  return VOICE_CATALOG.filter((voice) => voice.locale === locale);
}

export function getVoicesByGender(gender: VoiceGender) {
  return VOICE_CATALOG.filter((voice) => voice.gender === gender);
}

export function getVoicesForUseCase(useCase: VoiceUseCase) {
  if (useCase === "all") return VOICE_CATALOG;
  return VOICE_CATALOG.filter(
    (voice) => voice.useCase === "all" || voice.useCase === useCase
  );
}