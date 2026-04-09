# Voice app split plan

## App hiện tại
- Mục tiêu chính: chỉ gen voice English.
- Không dùng flow tiếng Việt trong app này để tránh lỗi phát sinh.
- UI hiện tại giữ hướng English-first:
  - Format: Podcast | Giọng đơn | Kids
  - Không dùng trường Ngôn ngữ
  - Loại giọng: Nam | Nữ
- Preset Panel có thêm tùy chọn:
  - Bật: dùng Preset mặc định của Voice
  - Tắt: dùng Preset chỉnh tay hiện tại

## App tiếng Việt riêng
- Dùng app zip riêng chỉ để gen tiếng Việt khi cần.
- Giữ UI hiện tại của app đó trong giai đoạn đầu.
- Mục tiêu sau này:
  1. Thêm cơ chế xoay tua + quản lý key như app English hiện tại.
  2. Giữ flow generate giống app zip gốc.
  3. Tạm thời giữ nguyên UI, chỉnh sau.

## Gợi ý triển khai app tiếng Việt riêng sau này
- Đưa phần gọi API ra backend để xoay tua key ổn định.
- Frontend chỉ gọi backend, không để nhiều key ở frontend.
- Giữ logic pitch/speed/pause đơn giản để bám sát app zip gốc.
