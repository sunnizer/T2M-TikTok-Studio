# T2M TikTok Studio — Desktop v0.1.0 (Beta Source)

**Phạm vi:** phần mềm Desktop Windows/macOS dùng Chrome riêng để chụp nghiệm thu TikTok. **KHÔNG** có License, thu phí, Database hoặc Chrome Extension.

## Chức năng đã viết
- Giao diện Desktop riêng: nhập 1–200 link video, chọn Views Only (thumbnail Profile) hoặc Views + Engagement (trang video).
- Mở Google Chrome qua Playwright với profile T2M riêng, người dùng tự đăng nhập TikTok; lưu phiên đăng nhập giữa các lần chạy.
- Batch Screenshot PNG trong Documents/T2M TikTok Studio/Screenshots, Pause/Stop bằng yêu cầu dừng, Resume bỏ qua các kết quả SAVED.
- Engagement: đọc số liệu nếu có ở DOM / JSON nhúng TikTok, thêm khung **T2M EVIDENCE OVERLAY** phân biệt rõ với giao diện TikTok gốc, ghi nguồn và xuất file JSON đi kèm.
- Gặp CAPTCHA/chặn truy cập: dừng và yêu cầu thao tác thủ công, không tự vượt hạn chế.
- Khung Check Update / Download / Install & Restart dựa trên electron-updater; **CHƯA KÍCH HOẠT** khi chưa có endpoint phát hành.
- Workflow GitHub Actions để Build thử EXE Windows và DMG/ZIP macOS từ source này, chưa ký số.

## Chạy thử trên Windows (hoặc macOS)
1. Cài Node.js 22 LTS và Google Chrome chính thức.
2. Tải ZIP mã nguồn và giải nén (hoặc clone repo mới), mở Terminal tại thư mục có `package.json`.
3. `npm install`
4. `npm test`
5. `npm start`
6. Bấm **Mở Chrome & Đăng nhập TikTok**. Đăng nhập thủ công trên Chrome T2M mới.
7. Dán 1–2 link video → chọn chế độ → **Bắt đầu chụp**. Không dùng cho Batch lớn trước khi kiểm thử thực tế.

## Tạo EXE / DMG thử nghiệm
- Windows: `npm run dist:win` → `release/` chứa bộ cài NSIS.
- macOS: `npm run dist:mac` → `release/` chứa DMG + ZIP.
- Hoặc đưa **nội dung** thư mục dự án lên một repository GitHub Private **mới** (vd: `t2m-tiktok-studio`), vào Actions → Build T2M TikTok Studio → Run workflow, tải artifact khi hoàn tất.
- Bản thử nghiệm **chưa ký số**: Windows SmartScreen/macOS Gatekeeper có thể cảnh báo hoặc chặn. Không phát hành thương mại khi chưa ký/notarize và kiểm thử đầy đủ.

## Kích hoạt Update thật sau này
1. Tạo endpoint HTTPS ổn định phục vụ `latest.yml`, bộ cài Windows, `latest-mac.yml`, `.zip`, `.dmg` (hoặc proxy qua Vercel Blob). Các URL cần công khai hoặc được cấp quyền an toàn để ứng dụng kiểm tra được; KHÔNG nhúng GitHub token vào client.
2. Đặt `updateBaseUrl` trong `src/update-config.json` đến endpoint đã triển khai thật, **trước khi build**. Đừng điền URL giả.
3. Xây dựng quy trình CI: build, ký số/notarize, đối chiếu SHA512, upload bản phát hành/metadata và chỉ đổi `latest.yml` khi tất cả artifact đã được kiểm tra.
4. Tạo bản phát hành mới tăng version > 0.1.0, chạy phần mềm bản trước để kiểm tra Check → Download → Install & Restart. Với macOS, cần code signing và notarization.

**Điều cần làm rõ:** TikTok thay đổi cấu trúc thường xuyên; việc truy xuất Views / Engagement chưa được thử trên TikTok thật ở phiên này. Ảnh Profile có thể không tìm thấy video nếu profile quá lớn; khi đó báo lỗi thay vì giả mạo kết quả. Phiên bản này chưa hoàn thiện toàn bộ công cụ cũ như Looker/CSV/định dạng ảnh JPG, tùy chọn crop nâng cao.

## Kiến trúc
- `src/main.js`: Electron main process + IPC.
- `src/automation.js`: Playwright chạy Google Chrome với profile T2M.
- `src/metrics.js`: đọc chỉ số hiển thị hoặc trang có metadata.
- `src/utils.js`: xử lý URL và kiểm tra lỗi, unit-test độc lập.
- `src/renderer.js`, `index.html`, `styles.css`: giao diện Desktop.
- `src/updates.js`: update client, chỉ chạy sau khi có endpoint thực tế.
- `.github/workflows/build-desktop.yml`: CI beta.
- `reference/`: bản zip Extension cũ làm tài liệu tham chiếu, không phải mã đang chạy.

**Bảo mật:** không có key Supabase, Vercel Blob hay GitHub trong app. Chỉ cung cấp quyền GitHub/Vercel/Supabase qua connector, không gửi mật khẩu/secret qua chat.

**Lockfile:** Môi trường tạo mã nguồn không truy cập npm registry, nên gói thử nghiệm chưa kèm `package-lock.json`. Sau lần `npm install` đầu tiên trên Windows/GitHub Actions, hãy commit lockfile vào GitHub và chuyển CI sang `npm ci` để khóa toàn bộ dependency trước khi phát hành.
