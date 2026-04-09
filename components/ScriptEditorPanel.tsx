import React, { useEffect, useRef } from "react";
import type { VoiceFormat, LanguageOption } from "../services/voiceUtils";

type ScriptEditorPanelProps = {
  text: string;
  setText: (value: string) => void;
  maxChars: number;
  format: VoiceFormat;
  language: LanguageOption;
  getTextPlaceholder: (format: VoiceFormat, language: LanguageOption) => string;
};

export default function ScriptEditorPanel({
  text,
  setText,
  maxChars,
  format,
  language,
  getTextPlaceholder
}: ScriptEditorPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const focusEditor = () => {
      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    };

    const timer = window.setTimeout(focusEditor, 80);
    window.addEventListener("focus", focusEditor);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", focusEditor);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-800">Nhập văn bản</div>
        </div>

        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {text.length} / {maxChars}
        </div>
      </div>

      <textarea
        ref={textareaRef}
        autoFocus
        spellCheck={false}
        className="min-h-[320px] w-full rounded-xl border border-slate-200 px-3 py-3 text-base shadow-sm focus:border-slate-400 focus:outline-none"
        value={text}
        onChange={(e) => {
          if (e.target.value.length <= maxChars) {
            setText(e.target.value);
          }
        }}
        placeholder={getTextPlaceholder(format, language)}
      />
    </div>
  );
}
