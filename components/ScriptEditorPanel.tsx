import React, { useEffect, useRef } from "react";
import type { VoiceFormat, LanguageOption } from "../services/voiceUtils";

type ScriptEditorPanelProps = {
  text: string;
  setText: (value: string) => void;
  maxChars: number;
  format: VoiceFormat;
  language: LanguageOption;
  getTextPlaceholder: (format: VoiceFormat, language: LanguageOption) => string;
  onOpenBgmManager?: () => void;
  onCursorChange?: (start: number, end: number) => void;
};

export default function ScriptEditorPanel({
  text,
  setText,
  maxChars,
  format,
  language,
  getTextPlaceholder,
  onOpenBgmManager,
  onCursorChange
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

  const syncCursor = () => {
    const node = textareaRef.current;
    if (!node || !onCursorChange) return;
    onCursorChange(node.selectionStart || 0, node.selectionEnd || 0);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-800">Nhập văn bản</div>
          <div className="mt-1 text-xs text-slate-500">
            
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenBgmManager ? (
            <button
              type="button"
              onClick={onOpenBgmManager}
              className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Mở BGM Manager
            </button>
          ) : null}
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {text.length} / {maxChars}
          </div>
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
          syncCursor();
        }}
        onClick={syncCursor}
        onKeyUp={syncCursor}
        onSelect={syncCursor}
        placeholder={getTextPlaceholder(format, language)}
      />
    </div>
  );
}
