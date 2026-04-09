# PATCH 01

Patch này chỉ gồm các file cần thay thế, không phải cài lại toàn bộ app.

## File cần overwrite
- App.tsx
- components/PresetPanel.tsx
- components/VoiceManagerDialog.tsx
- hooks/useVoiceManager.ts

## Nội dung patch
1. Thêm checkbox chọn:
   - Dùng Preset mặc định của Voice
   - hoặc dùng Preset chỉnh tay hiện tại

2. Panel Quản lý voice:
   - bỏ nút dấu cộng cạnh dropdown Format
   - đổi nhãn English (Male/Female) thành Nam | Nữ
   - giữ layout 2 cột cho voice Podcast ở phần chi tiết cấu hình

3. Panel Tạo giọng mới:
   - 3 dropdown cùng 1 hàng:
     Format | Loại giọng | Giọng gốc

## Cách update patch về sau
Từ bây giờ có thể update theo patch:
- chỉ zip các file thay đổi
- overwrite đúng file tương ứng
- không cần thay lại toàn bộ project nếu chỉ sửa UI/logic nhỏ
