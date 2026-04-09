import { useCallback } from "react";
import type { VoiceTypeOption } from "../services/voiceUtils";

type UsePresetPanelBridgeParams = {
  voiceType: VoiceTypeOption;
  setVoiceType: (value: VoiceTypeOption) => void;
  voiceName: string;
  setVoiceName: (value: string) => void;

  vmVoiceType: VoiceTypeOption;
  setVmVoiceType: (value: VoiceTypeOption) => void;
  vmVoiceName: string;
  setVmVoiceName: (value: string) => void;

  getPresetModified: () => boolean;
  handleSavePreset: (name: string) => void;
};

export function usePresetPanelBridge({
  voiceType,
  setVoiceType,
  voiceName,
  setVoiceName,

  vmVoiceType,
  setVmVoiceType,
  vmVoiceName,
  setVmVoiceName,

  getPresetModified,
  handleSavePreset
}: UsePresetPanelBridgeParams) {
  const handlePanelVoiceTypeChange = useCallback(
    (value: VoiceTypeOption) => {
      if (voiceType !== value) {
        setVoiceType(value);
      }
      if (vmVoiceType !== value) {
        setVmVoiceType(value);
      }
    },
    [voiceType, vmVoiceType, setVoiceType, setVmVoiceType]
  );

  const handlePanelVoiceNameChange = useCallback(
    (value: string) => {
      if (voiceName !== value) {
        setVoiceName(value);
      }
      if (vmVoiceName !== value) {
        setVmVoiceName(value);
      }
    },
    [voiceName, vmVoiceName, setVoiceName, setVmVoiceName]
  );

  return {
    panelVoiceType: voiceType,
    panelVoiceName: voiceName,
    panelPresetModified: getPresetModified(),
    handlePanelVoiceTypeChange,
    handlePanelVoiceNameChange,
    handlePanelSavePreset: (name: string) => handleSavePreset(name)
  };
}