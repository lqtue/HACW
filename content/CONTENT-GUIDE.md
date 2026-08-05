# Form khảo sát điểm đến — Tuần lễ Sáng tạo Hội An 2026

Mỗi điểm đến (25 điểm) điền theo mẫu `destination.template.json`. Mỗi trường có
**hai ngôn ngữ**: `vi` (tiếng Việt) và `en` (tiếng Anh). Tiếng Anh có thể dịch
sau, nhưng phải có đủ tiếng Việt khi khảo sát.

## Trường thông tin

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| `id` | ✅ | Mã không dấu, viết thường, nối bằng gạch ngang. VD: `chua-cau`, `hoi-quan-phuc-kien`. Không trùng. |
| `name.vi` / `name.en` | ✅ | Tên điểm đến. |
| `category` | ✅ | Một trong: `di-tich`, `hoi-quan`, `nha-co`, `bao-tang`, `trai-nghiem`. |
| `lat`, `lng` | ✅ | **Toạ độ GPS đo TẠI CỬA/lối vào điểm đến** (mở Google Maps tại chỗ → giữ vào vị trí → copy toạ độ). Sai số toạ độ làm check-in thất bại. |
| `radius` | ✅ | Bán kính check-in, mét. Mặc định **35**. Tăng lên (50–60) nếu điểm rộng hoặc GPS yếu. |
| `address.vi` / `address.en` | ✅ | Số nhà + tên đường + phường. |
| `hours.vi` / `hours.en` | ✅ | Giờ mở cửa. VD: `08:00 – 17:30`, hoặc `Cả ngày`. |
| `image` | ⬜ | Để `null` khi khảo sát; ảnh xử lý sau (xem mục Ảnh). |
| `description.vi` / `description.en` | ✅ | 1–3 câu giới thiệu. **Ưu tiên nguồn chính thống** (qua người Trung tâm bảo tồn giới thiệu), không chỉ dựa vào người trông coi. |
| `quizBank` | ✅ | Ngân hàng câu hỏi, xem bên dưới. |

## Ngân hàng câu hỏi (`quizBank`)

- **10 câu mỗi điểm**: **8 câu `easy` + 2 câu `hard`** (toàn dự án ~200 dễ + 50 khó / 250 câu).
- Mỗi lần khách check-in, hệ thống tự rút ngẫu nhiên **2 câu dễ + 1 câu khó**.
- Mỗi câu: `question` (câu hỏi), `options` (2–4 đáp án), `answer` = **chỉ số** đáp án đúng (đếm từ **0**). VD đáp án đầu đúng → `answer: 0`.
- `difficulty`: `"easy"` hoặc `"hard"`.
- Câu hỏi nên gắn với chính điểm đến, không quá khó (phối hợp Trung tâm bảo tồn).

Mẫu chỉ có sẵn 1 dễ + 1 khó — **copy thêm cho đủ 8 dễ + 2 khó**.

## Ảnh cần chụp (mỗi điểm)

1. **Ảnh mặt tiền / lối vào** (ngang, rõ biển tên) — ảnh chính.
2. 1–2 ảnh không gian bên trong / chi tiết đặc trưng.
3. Ảnh **màn hình Google Maps tại vị trí đứng** (để đối chiếu toạ độ).

Đặt tên ảnh theo `id`: `chua-cau-1.jpg`, `chua-cau-2.jpg`…

## Nộp lại

Mỗi điểm = 1 file JSON theo mẫu (đặt tên theo `id`, vd `chua-cau.json`) +
thư mục ảnh cùng `id`. Tổng hợp 25 file rồi gửi lại cho Tuệ để gộp vào
`src/lib/data/destinations.json`.
