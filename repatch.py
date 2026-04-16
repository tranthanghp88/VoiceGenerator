from pathlib import Path
import re

app = Path('App.tsx').read_text(encoding='utf-8')
# remove duplicate standalone import? keep okay.
# replace handleExportFinalMedia via regex
pattern = re.compile(r'  const handleExportFinalMedia = async \(\) => \{.*?\n  \};\n', re.S)
replacement = '''  const handleExportFinalMedia = async () => {
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
      window.setTimeout(() => {
        setVideoRenderProgress(0);
        setChunkInfo((prev) => ({
          ...prev,
          eta: prev.total > 0 && prev.done < prev.total ? prev.eta : undefined
        }));
      }, 1200);
    }
  };
'''
app, count = pattern.subn(replacement, app, count=1)
if count != 1:
    raise SystemExit('failed replace handleExportFinalMedia')
Path('App.tsx').write_text(app, encoding='utf-8')

wave = Path('components/WaveformDialog.tsx').read_text(encoding='utf-8')
wave = wave.replace('disabled={!waveAudioPath || !waveBackgroundImagePath || !isWaveReady || isExportingWaveVideo || isExportingFinalMedia}', 'disabled={!waveAudioPath || !waveBackgroundImagePath || !isWaveReady || isExportingFinalMedia}')
Path('components/WaveformDialog.tsx').write_text(wave, encoding='utf-8')
