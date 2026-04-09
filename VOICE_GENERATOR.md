# 📦 Easy English Channel Voice Generator (Electron App) - FULL DOCUMENTATION

---

## 🧱 1. Tổng quan kiến trúc

Ứng dụng được xây dựng theo mô hình Desktop App:

- **Frontend**: React + Vite (file chính: `App.tsx`, không dùng src/)
- **Backend**: Node.js + Express chạy nội bộ qua `127.0.0.1:3030`
- **Desktop Runtime**: Electron
- **Lưu trữ**:
  - `localStorage`: preset, format, config UI
  - `AppData/keys.txt`: API keys
  - File system: audio output + history

---

## 📁 2. Cấu trúc thư mục

```
root/
├── App.tsx
├── components/
│   ├── VoiceManagerDialog.tsx
│   ├── PresetPanel.tsx
│   ├── KeyManagerPanel.tsx
│   ├── ScriptEditorPanel.tsx
│   ├── HistoryAudioPanel.tsx
│   ├── AudioPlayerPanel.tsx
│   ├── FolderPanel.tsx
│   └── ProgressPanel.tsx
│
├── hooks/
│   ├── useVoiceManager.ts
│   ├── useTtsJob.ts
│   └── useKeyManager.ts
│
├── services/
│   ├── ttsPipeline.ts
│   ├── geminiService.ts
│   ├── voiceStorage.ts
│   ├── voiceUtils.ts
│   └── exportImport.ts
│
├── utils/
│   └── audioUtils.ts
│
├── server/
│   ├── index.mjs
│   ├── keyManager.mjs
│   └── keyStats.mjs
│
├── electron/
│   ├── main.cjs
│   └── preload.cjs
```

---

## ⚙️ 3. Flow hoạt động chính

```
Script → Parse → Chunk → TTS Job → Polling → Merge → Save file
```

### Chi tiết:
1. Nhập script (A:/R:)
2. Parse thành block
3. Chunk text
4. Gửi request backend
5. Backend xử lý theo key
6. Polling kết quả
7. Merge audio
8. Lưu file

---

## 🎤 4. Voice System

### 4.1 Voice Manager
- Hiển thị toàn bộ voice
- Filter:
  - Format
  - Language
  - Voice Type
- Search realtime
- Import:
  - CSV
  - JSON
- Export voice
- Multi select:
  - Select all
  - Clear
  - Delete

### 4.2 Voice Config
- speed
- pitch
- pause
- style

### 4.3 Voice Types
- vietnameseMale
- vietnameseFemale
- englishMale
- englishFemale
- podcast (flow riêng)

---

## 🎛️ 5. Preset System

- Lưu cấu hình giọng đọc
- Gắn với:
  - voiceType
  - format
- Import / Export preset
- Podcast dùng preset riêng (multi-speaker)

---

## 🧠 6. TTS Pipeline

### Tính năng:
- Chunk thông minh
- Retry khi key fail
- Polling async
- Merge audio

### Nguyên tắc:
- Không parallel quá nhiều
- Tránh burn quota
- Ưu tiên ổn định

---

## 🔑 7. Key Manager

### Tính năng:
- Import nhiều key
- Export key (đã fix hiển thị key thật)
- Test key
- Remove key lỗi
- Dashboard:
  - usage
  - success rate

### Storage:
- AppData/keys.txt

---

## 📁 8. File & Output

- Chọn folder qua Electron
- Lưu file trực tiếp
- History:
  - quét folder
  - play lại
- Merge audio nhiều file

---

## 📝 9. Script Editor

```
A: Hello
R: Hi
```

### Hỗ trợ:
- Block pause
- Auto pause rules
- Normalize script

---

## 🎨 10. UI/UX Design

### Layout:
- Trái: cấu hình (Preset, File, Folder)
- Phải: script + generate + audio

### Nguyên tắc:
- Panel gọn
- Có thể collapse
- Dialog cho phần phức tạp
- Button thống nhất:
  - Primary: xanh
  - Danger: đỏ
  - Secondary: xám

---

## 🧠 11. Design Principles

### One-way data flow
- UI → Hook → State

### Tách flow
- Podcast ≠ Single voice

### Electron-first
- File native
- Không phụ thuộc browser

---

## 🚀 12. Những gì đã fix

- Fix React loop
- Fix voice mapping
- Fix encoding tiếng Việt
- Fix import/export
- Fix select all
- Fix export key
- Polish UI

---

## 🔧 13. Hướng phát triển

- AI auto voice selection
- Preset recommendation
- Batch render
- Cloud sync

---

## 📌 14. Kết luận

App đã:
- ổn định
- đầy đủ feature
- tối ưu workflow
- sẵn sàng production

Có thể mở rộng thêm nhưng hiện tại đã dùng tốt cho content pipeline.
