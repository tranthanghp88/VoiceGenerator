import React, { RefObject } from "react";

type AudioPlayerPanelProps = {
  audioUrl: string | null;
  isPreviewingVoice: boolean;
  audioRef: RefObject<HTMLAudioElement | null>;
};

export default function AudioPlayerPanel({
  audioUrl,
  isPreviewingVoice,
  audioRef
}: AudioPlayerPanelProps) {
  if (!audioUrl) return null;

  return (
    <div className="space-y-2 rounded-2xl border bg-white p-4 shadow-sm">
      <p className="font-medium text-green-600">
        {isPreviewingVoice ? "Đang phát audio nghe thử" : "Đã tạo xong audio"}
      </p>
      <audio ref={audioRef} controls src={audioUrl} className="w-full" />
    </div>
  );
}