# Hướng dẫn điền nội dung điểm đến — Tuần lễ Sáng tạo Hội An 2026

Tài liệu này dành cho người khảo sát/biên soạn nội dung. Bạn chỉ cần **mở bảng
`content-form.csv`** (bằng Google Sheets hoặc Excel) và điền vào các ô còn trống.
Không cần biết gì về kỹ thuật.

Bảng đã có sẵn **25 dòng**, mỗi dòng một điểm đến. Một số ô (tên, địa chỉ, giờ,
giới thiệu) đã điền sẵn để tham khảo — bạn rà soát lại và **bổ sung phần còn
thiếu**, quan trọng nhất là **toạ độ GPS** và **phần khám phá tại chỗ**.

<<<<<<< Updated upstream
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
=======
> ⚠️ Đừng sửa cột **"Tên điểm (VI) — KHÔNG sửa"**. Đó là tên dùng để khớp dữ liệu.
>
> Mỗi nội dung có **hai cột**: tiếng Việt `(VI)` và tiếng Anh `(EN)`. **Bắt buộc
> có tiếng Việt**; tiếng Anh có thể để trống, dịch sau.
>>>>>>> Stashed changes

---

## "Khám phá tại chỗ" là gì?

Thay cho câu đố kiến thức, mỗi điểm có **một thử thách khám phá**: dẫn khách
**tìm một chi tiết CÓ THẬT chỉ nhìn thấy được khi đứng tại điểm đến**, rồi chọn
đáp án đúng. Vừa là trải nghiệm kể chuyện, vừa là cách xác nhận khách thật sự
đang có mặt.

**Quy tắc vàng**: chi tiết phải **đếm/đo/nhìn được tại chỗ** — số lối cổng, màu
bức tượng, vạch nước lũ trên cột, con linh vật, số bậc thang… **Tránh** câu hỏi
tra Google ra ngay được, vì sẽ mất ý nghĩa "phải đến tận nơi".

### 4 điểm mẫu đã điền hoàn chỉnh

Hãy mở xem 4 dòng này trước để hình dung độ chi tiết mong muốn:
**Chùa Cầu · Hội quán Phúc Kiến · Nhà cổ Tấn Ký · Miếu Quan Công**.

Ví dụ Chùa Cầu: *manh mối* "Nhìn kỹ hai đầu cầu — có cặp tượng linh vật canh
giữ" → *câu hỏi* "Hai linh vật đó là con gì?" → đáp án A "Chó và Khỉ" (đúng).

### 21 điểm còn lại

Ô **"Manh mối"** đang ghi `⚠ Cần khảo sát`. Đây là phần bạn cần điền: nghĩ ra
một chi tiết có thật tại điểm đó và viết theo mẫu 4 điểm trên.

---

## Các cột cần điền

| Cột | Điền gì |
|-----|---------|
| **Vĩ độ / Latitude**, **Kinh độ / Longitude** | Toạ độ GPS **đo ngay tại cửa/lối vào**: mở Google Maps tại chỗ → giữ ngón tay vào vị trí đang đứng → copy hai số toạ độ. Sai toạ độ sẽ làm khách không check-in được. |
| **Địa chỉ**, **Giờ mở cửa** | Rà lại ô có sẵn cho đúng thực tế (số nhà, đường; giờ mở–đóng, ví dụ `08:00 – 17:30` hoặc `Cả ngày`). |
| **Giới thiệu ngắn** | 1–3 câu giới thiệu điểm đến. **Ưu tiên nguồn chính thống** (qua Trung tâm Bảo tồn), không chỉ nghe người trông coi. |
| **Dẫn chuyện khi vừa đến** | *(không bắt buộc)* 1–2 câu tạo không khí khi khách vừa tới — bối cảnh, truyền thuyết. Để trống nếu chưa có. |
| **Manh mối – nhìn/tìm gì?** | Câu dẫn khách **quan sát một chi tiết cụ thể** (vd: "Ngước nhìn nóc cổng chính"). |
| **Câu hỏi** | Hỏi về chi tiết vừa quan sát (vd: "Cổng chính có mấy lối đi?"). |
| **Đáp án A / B / C** | 2–3 lựa chọn. Để trống đáp án C nếu chỉ có 2. Các đáp án sai nên **hợp lý nhưng nhìn là biết khác** — không đoán mò được nếu không đứng tại chỗ. |
| **Đáp án đúng (A/B/C)** | Ghi đúng một chữ: `A`, `B` hoặc `C`. |
| **Lời giải / phần thưởng** | *(không bắt buộc)* 1–2 câu hiện ra sau khi khách trả lời đúng — một điều thú vị, cái kết của câu chuyện. |

Với điểm **trình diễn** (bài chòi, xí mà, hát bội…): manh mối có thể gắn với buổi
diễn — nhạc cụ mở màn, nguyên liệu món ăn, tên một quân bài…

---

## Ảnh cần chụp (mỗi điểm)

1. **Ảnh mặt tiền / lối vào** (ngang, rõ biển tên) — ảnh chính.
2. 1–2 ảnh không gian bên trong / chi tiết đặc trưng (nhất là **chi tiết dùng cho
   câu khám phá** — chụp lại để đối chiếu).
3. Ảnh **màn hình Google Maps tại vị trí đứng** (để đối chiếu toạ độ).

Đặt tên ảnh theo tên điểm, ví dụ `chua-cau-1.jpg`, `chua-cau-2.jpg`…

---

## Nộp lại

1. **Bảng `content-form.csv`** đã điền (nếu dùng Google Sheets: *File → Download →
   CSV*).
2. **Thư mục ảnh** của các điểm.

Gửi lại cho Tuệ để đưa vào ứng dụng.
