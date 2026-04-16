from pathlib import Path

# Patch App.tsx
app = Path('App.tsx').read_text(encoding='utf-8')
app = app.replace('import React, { useEffect, useMemo, useRef, useState } from "react";', 'import React, { useEffect, useMemo, useRef, useState } from "react";\nimport { FaFolderOpen } from "react-icons/fa";')
app = app.replace('  const [isExportingWaveVideo, setIsExportingWaveVideo] = useState(false);\n', '')
app = app.replace('  const [isExportingFinalMedia, setIsExportingFinalMedia] = useState(false);\n', '  const [isExportingFinalMedia, setIsExportingFinalMedia] = useState(false);\n  const [videoRenderProgress, setVideoRenderProgress] = useState(0);\n')
# remove handleExportWaveVideo function
start = app.find('  const handleExportWaveVideo = async () => {')
end = app.find('  const handleExportFinalMedia = async () => {')
if start != -1 and end != -1:
    app = app[:start] + app[end:]
# patch final media handler
old = '''  const handleExportFinalMedia = async () => {
    if (!waveAudioPath || !waveAudioUrl) {
      alert("Hãy chọn file audio trước.");
      return;
    }

    if (!waveBackgroundImagePath) {
      alert("Hãy chọn ảnh nền trước.");
      return;
    }

    const generationScript = buildGenerateScript();
    if (!generationScript.length) {
      alert("Script hiện tại chưa hợp lệ để dựng subtitle/BGM.");
      return;
    }

    setIsExportingFinalMedia(true);
    setWaveError("");
    setWaveStatus("Đang dựng audio final + SRT + video...");

    try {
      const sourceDuration = Number(waveSurferRef.current?.getDuration?.() || waveDuration || 0);
      const plan = buildCompositionPlan({
        script: generationScript,
        sourceDuration,
        bgmAssets
      });

      const result = await window.electronAPI?.composeFinalMedia?.({
        sourceAudioPath: waveAudioPath,
        backgroundImagePath: waveBackgroundImagePath,
        plan
      });

      if (!result?.ok) {
        throw new Error(result?.error || "Xuất media cuối thất bại");
      }

      const lines = [
        result.finalAudioPath ? `Audio: ${result.finalAudioPath}` : "",
        result.finalSrtPath ? `SRT: ${result.finalSrtPath}` : "",
        result.finalVideoPath ? `Video: ${result.finalVideoPath}` : ""
      ].filter(Boolean);

      setWaveStatus("Đã xuất audio final + SRT + video hoàn chỉnh.");
      alert(`Xuất media thành công:\n${lines.join("\n")}`);
    } catch (error: any) {
      setWaveError(error?.message || "Xuất media cuối thất bại");
      setWaveStatus("");
    } finally {
      setIsExportingFinalMedia(false);
    }
  };
'''
new = '''  const handleExportFinalMedia = async () => {
    if (!waveAudioPath || !waveAudioUrl) {
      alert("Hãy chọn file audio trước.");
      return;
    }

    if (!waveBackgroundImagePath) {
      alert("Hãy chọn ảnh nền trước.");
      return;
    }

    const generationScript = buildGenerateScript();
    if (!generationScript.length) {
      alert("Script hiện tại chưa hợp lệ để dựng subtitle/BGM.");
      return;
    }

    setIsExportingFinalMedia(true);
    setVideoRenderProgress(8);
    setProgress(8);
    setStage("rendering");
    setChunkInfo((prev) => ({
      ...prev,
      eta: "Đang dựng video..."
    }));
    setWaveError("");
    setWaveStatus("Đang chuẩn bị dựng audio final + SRT + video...");

    let progressTimer: any = null;

    try {
      progressTimer = window.setInterval(() => {
        setVideoRenderProgress((prev) => {
          const next = prev < 70 ? prev + 7 : prev < 88 ? prev + 2 : prev;
          setProgress(next);
          return next;
        });
      }, 900);

      const sourceDuration = Number(waveSurferRef.current?.getDuration?.() || waveDuration || 0);
      const plan = buildCompositionPlan({
        script: generationScript,
        sourceDuration,
        bgmAssets
      });

      setWaveStatus("Đang mix audio final và tạo subtitle...");
      setVideoRenderProgress(24);
      setProgress(24);

      const result = await window.electronAPI?.composeFinalMedia?.({
        sourceAudioPath: waveAudioPath,
        backgroundImagePath: waveBackgroundImagePath,
        plan
      });

      if (!result?.ok) {
        throw new Error(result?.error || "Xuất media cuối thất bại");
      }

      if (progressTimer) {
        window.clearInterval(progressTimer);
        progressTimer = null;
      }

      setWaveStatus("Đang hoàn tất file video...");
      setVideoRenderProgress(100);
      setProgress(100);

      const lines = [
        result.finalAudioPath ? `Audio: ${result.finalAudioPath}` : "",
        result.finalSrtPath ? `SRT: ${result.finalSrtPath}` : "",
        result.finalVideoPath ? `Video: ${result.finalVideoPath}` : ""
      ].filter(Boolean);

      setWaveStatus("Đã xuất audio final + SRT + video hoàn chỉnh.");
      alert(`Xuất media thành công:\n${lines.join("\n")}`);
    } catch (error: any) {
      if (progressTimer) {
        window.clearInterval(progressTimer);
      }
      setWaveError(error?.message || "Xuất media cuối thất bại");
      setWaveStatus("");
      setVideoRenderProgress(0);
      setProgress(0);
    } finally {
      if (progressTimer) {
        window.clearInterval(progressTimer);
      }
      setIsExportingFinalMedia(false);
      setTimeout(() => {
        setVideoRenderProgress(0);
        setChunkInfo((prev) => ({
          ...prev,
          eta: prev.total > 0 && prev.done < prev.total ? prev.eta : undefined
        }));
      }, 1200);
    }
  };
'''
app = app.replace(old, new)
# add open folder handler after select background image or around there
marker = '  const handleSelectWaveBackgroundImage = async () => {'
insert_at = app.find(marker)
open_folder = '''  const handleOpenCurrentFolder = async () => {
    const targetPath = String(directoryName || "").trim() || waveAudioPath || waveBackgroundImagePath;

    if (!targetPath) {
      alert("Chưa có thư mục để mở.");
      return;
    }

    try {
      const result = await window.electronAPI?.openFolderPath?.({ path: targetPath });
      if (!result?.ok) {
        throw new Error(result?.error || "Không thể mở thư mục.");
      }
    } catch (error: any) {
      alert(error?.message || "Không thể mở thư mục.");
    }
  };

'''
app = app[:insert_at] + open_folder + app[insert_at:]
# storage panel buttons
old_btn = '''                  <div className="mt-3">
                    <button
                      onClick={chooseFolder}
                      type="button"
                      className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
                    >
                      {directoryName ? "Đổi thư mục" : "Chọn thư mục"}
                    </button>
                  </div>'''
new_btn = '''                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={chooseFolder}
                      type="button"
                      className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
                    >
                      {directoryName ? "Đổi thư mục" : "Chọn thư mục"}
                    </button>
                    <button
                      onClick={handleOpenCurrentFolder}
                      type="button"
                      disabled={!directoryName}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FaFolderOpen />
                      Mở thư mục
                    </button>
                  </div>'''
app = app.replace(old_btn, new_btn)
# grid breakpoint
app = app.replace('      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">', '      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">')
app = app.replace('<aside className="space-y-4 xl:col-span-4">', '<aside className="space-y-4 lg:col-span-4">')
app = app.replace('<main className="space-y-4 xl:col-span-8">', '<main className="space-y-4 lg:col-span-8">')
# waveform dialog props call
app = app.replace('        waveContainerRef={waveContainerRef}\n        isExportingWaveVideo={isExportingWaveVideo}\n        isExportingFinalMedia={isExportingFinalMedia}\n        isWaveReady={isWaveReady}\n        onSelectAudio={handleSelectWaveAudio}\n        onSelectBackgroundImage={handleSelectWaveBackgroundImage}\n        onExportWaveVideo={handleExportWaveVideo}\n        onExportFinalMedia={handleExportFinalMedia}\n', '        isExportingFinalMedia={isExportingFinalMedia}\n        isWaveReady={isWaveReady}\n        videoRenderProgress={videoRenderProgress}\n        onSelectAudio={handleSelectWaveAudio}\n        onSelectBackgroundImage={handleSelectWaveBackgroundImage}\n        onOpenFolder={handleOpenCurrentFolder}\n        onExportFinalMedia={handleExportFinalMedia}\n')
Path('App.tsx').write_text(app, encoding='utf-8')

# Patch WaveformDialog
wave = Path('components/WaveformDialog.tsx').read_text(encoding='utf-8')
wave = wave.replace('  waveAudioPreviewRef: React.RefObject<HTMLAudioElement | null>;\n  waveContainerRef: React.RefObject<HTMLDivElement | null>;\n  isExportingWaveVideo: boolean;\n  isExportingFinalMedia: boolean;\n  isWaveReady: boolean;\n  onSelectAudio: () => void;\n  onSelectBackgroundImage: () => void;\n  onExportWaveVideo: () => void;\n  onExportFinalMedia: () => void;\n', '  waveAudioPreviewRef: React.RefObject<HTMLAudioElement | null>;\n  isExportingFinalMedia: boolean;\n  isWaveReady: boolean;\n  videoRenderProgress: number;\n  onSelectAudio: () => void;\n  onSelectBackgroundImage: () => void;\n  onOpenFolder: () => void;\n  onExportFinalMedia: () => void;\n')
wave = wave.replace('  waveAudioPreviewRef,\n  waveContainerRef,\n  isExportingWaveVideo,\n  isExportingFinalMedia,\n  isWaveReady,\n  onSelectAudio,\n  onSelectBackgroundImage,\n  onExportWaveVideo,\n  onExportFinalMedia\n', '  waveAudioPreviewRef,\n  isExportingFinalMedia,\n  isWaveReady,\n  videoRenderProgress,\n  onSelectAudio,\n  onSelectBackgroundImage,\n  onOpenFolder,\n  onExportFinalMedia\n')
wave = wave.replace('              Xuất waveform podcast, audio final, SRT và video hoàn chỉnh ngay trong app.\n', '              Chọn audio, ảnh nền rồi dựng audio final, SRT và video hoàn chỉnh ngay trong app.\n')
wave = wave.replace('          <div className="flex flex-col gap-2 md:flex-row">\n', '          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">\n')
# remove waveform button block
start = wave.find('            <button\n              type="button"\n              onClick={onExportWaveVideo}')
if start != -1:
    end = wave.find('            <button\n              type="button"\n              onClick={onExportFinalMedia}', start)
    wave = wave[:start] + wave[end:]
# patch disableds
wave = wave.replace('              disabled={isExportingWaveVideo || isExportingFinalMedia}', '              disabled={isExportingFinalMedia}')
# add open folder button before export
wave = wave.replace('            <button\n              type="button"\n              onClick={onExportFinalMedia}', '            <button\n              type="button"\n              onClick={onOpenFolder}\n              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700"\n            >\n              Mở thư mục\n            </button>\n\n            <button\n              type="button"\n              onClick={onExportFinalMedia}')
# output text
wave = wave.replace('<div className="mt-1 font-medium text-slate-800">*_waveform.mp4 / *_final.wav / *_final.srt / *_final.mp4</div>', '<div className="mt-1 font-medium text-slate-800">*_final.wav / *_final.srt / *_final.mp4</div>')
# add progress box before error
marker = '          {waveError ? (\n'
progress_block = '''          {isExportingFinalMedia || videoRenderProgress > 0 ? (\n            <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-3">\n              <div className="mb-2 flex items-center justify-between gap-3 text-sm">\n                <span className="font-medium text-purple-900">Tiến trình dựng video</span>\n                <span className="font-semibold text-purple-700">{Math.round(videoRenderProgress)}%</span>\n              </div>\n              <div className="h-3 overflow-hidden rounded-full bg-purple-100">\n                <div\n                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500 transition-all duration-500"\n                  style={{ width: `${Math.max(0, Math.min(100, videoRenderProgress))}%` }}\n                />\n              </div>\n            </div>\n          ) : null}\n\n'''
wave = wave.replace(marker, progress_block + marker)
# remove waveform visual block
start = wave.find('          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4">')
if start != -1:
    end = wave.find('          <audio ref={waveAudioPreviewRef}', start)
    wave = wave[:start] + wave[end:]
Path('components/WaveformDialog.tsx').write_text(wave, encoding='utf-8')

# Patch electron/main.cjs
main = Path('electron/main.cjs').read_text(encoding='utf-8')
main = main.replace('const { app, BrowserWindow, ipcMain, dialog } = require("electron");', 'const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");')
insert = '''ipcMain.handle("file:open-folder-path", async (_event, payload = {}) => {\n  try {\n    const targetPath = safeText(payload.path);\n    if (!targetPath) return { ok: false, error: "Thiếu đường dẫn để mở." };\n\n    let folderPath = targetPath;\n    if (fs.existsSync(targetPath)) {\n      try {\n        const stat = fs.statSync(targetPath);\n        if (stat.isFile()) {\n          folderPath = path.dirname(targetPath);\n        }\n      } catch {}\n    } else {\n      folderPath = path.dirname(targetPath);\n    }\n\n    if (!folderPath || !fs.existsSync(folderPath)) {\n      return { ok: false, error: "Không tìm thấy thư mục cần mở." };\n    }\n\n    const result = await shell.openPath(folderPath);\n    if (result) {\n      return { ok: false, error: result };\n    }\n\n    return { ok: true, path: folderPath };\n  } catch (error) {\n    return { ok: false, error: error?.message || String(error || "Không thể mở thư mục") };\n  }\n});\n\n'''
marker = 'ipcMain.handle("file:list-audio-files", async (_event, payload = {}) => {'
idx = main.find(marker)
main = main[:idx] + insert + main[idx:]
Path('electron/main.cjs').write_text(main, encoding='utf-8')

# Patch preload
a = Path('electron/preload.cjs').read_text(encoding='utf-8')
a = a.replace('  listAudioFiles: (payload) => ipcRenderer.invoke("file:list-audio-files", payload),\n', '  listAudioFiles: (payload) => ipcRenderer.invoke("file:list-audio-files", payload),\n  openFolderPath: (payload) => ipcRenderer.invoke("file:open-folder-path", payload),\n')
Path('electron/preload.cjs').write_text(a, encoding='utf-8')

# Patch typings
t = Path('electronAPI.d.ts').read_text(encoding='utf-8')
t = t.replace('      listAudioFiles: (payload: any) => Promise<any>;\n      readAudioFile: (payload: any) => Promise<any>;\n', '      listAudioFiles: (payload: any) => Promise<any>;\n      readAudioFile: (payload: any) => Promise<any>;\n      openFolderPath: (payload: { path: string }) => Promise<{ ok: boolean; path?: string; error?: string }>;\n')
Path('electronAPI.d.ts').write_text(t, encoding='utf-8')
