#!/usr/bin/env python3
"""Generate the contributor content form from destinations.json.

Run: python3 content/build-content-form.py

A clean, content-only sheet for researchers — no tech fields (id, category,
radius, JSON). Rows are matched back to destinations by **site name (VI)**, so
contributors must not change the "Tên điểm (VI)" column. Correct answer is
marked A/B/C (mapped to the data index on merge: A=0, B=1, C=2).

ponytail: one-way (json -> form) for now. The reverse (form -> destinations.json
merge: match by name_vi, A/B/C -> index) lives here when the survey returns.
"""
import csv, json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
dests = json.loads((root / "src/lib/data/destinations.json").read_text("utf-8"))

# header label  ->  how to pull it from a destination
def rows():
    for d in dests:
        x = d["discovery"]
        o = x["options"]
        yield {
            "Tên điểm (VI) — KHÔNG sửa": d["name"]["vi"],
            "Site name (EN)": d["name"]["en"],
            "Vĩ độ / Latitude": d["lat"],
            "Kinh độ / Longitude": d["lng"],
            "Địa chỉ (VI)": d["address"]["vi"],
            "Address (EN)": d["address"]["en"],
            "Giờ mở cửa (VI)": d["hours"]["vi"],
            "Opening hours (EN)": d["hours"]["en"],
            "Giới thiệu ngắn (VI)": d["description"]["vi"],
            "Short description (EN)": d["description"]["en"],
            "Dẫn chuyện khi vừa đến (VI)": x["story"]["vi"],
            "Arrival story (EN)": x["story"]["en"],
            "Manh mối – nhìn/tìm gì? (VI)": x["clue"]["vi"],
            "Clue – what to look for (EN)": x["clue"]["en"],
            "Câu hỏi (VI)": x["prompt"]["vi"],
            "Question (EN)": x["prompt"]["en"],
            "Đáp án A (VI)": o[0]["vi"] if len(o) > 0 else "",
            "Answer A (EN)": o[0]["en"] if len(o) > 0 else "",
            "Đáp án B (VI)": o[1]["vi"] if len(o) > 1 else "",
            "Answer B (EN)": o[1]["en"] if len(o) > 1 else "",
            "Đáp án C (VI)": o[2]["vi"] if len(o) > 2 else "",
            "Answer C (EN)": o[2]["en"] if len(o) > 2 else "",
            "Đáp án đúng (A/B/C)": chr(65 + x["answer"]),
            "Lời giải / phần thưởng (VI)": x["reveal"]["vi"],
            "Reveal (EN)": x["reveal"]["en"],
        }

data = list(rows())
out = root / "content/content-form.csv"
with out.open("w", newline="", encoding="utf-8-sig") as f:  # BOM so Excel reads UTF-8
    w = csv.DictWriter(f, fieldnames=list(data[0].keys()))
    w.writeheader()
    w.writerows(data)

print(f"wrote {out.relative_to(root)} — {len(data)} rows")
