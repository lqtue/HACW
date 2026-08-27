# Translation brief — Hội An Creative Week 2026 app

Hand this to a translator (human or model) together with `content/full-text.md`.
One language per run. Everything below the line is the prompt.

---

You are localising the visitor app for **Tuần lễ Sáng tạo Hội An 2026** (Hội An
Creative Week 2026), a mobile web app used by tourists **while standing in front of
the monument**. Source text is Vietnamese. Translate it into **<TARGET LANGUAGE>**.

This is localisation, not word-for-word translation. A sentence that is correct but
reads like a machine wrote it has failed.

## What the text is for

Visitors buy a paper ticket that admits them to **5 of the 25 heritage sites** in
the old town. In the app they pick their five, walk there, check in with GPS, answer
a short quiz about what is in front of them, collect points and swap them for a gift
at a ticket counter. So the text is read: on a phone, outdoors, in a hurry, often by
someone whose second language this is.

Register: plain, warm, concrete. Second person. No travel-brochure voice — no
"discover the magic", no exclamation marks, no words the Vietnamese does not have.
If the Vietnamese is one short line, the translation is one short line.

## Rules

**1. Proper nouns get the name a reader of your language actually uses — not a
transliteration of the Vietnamese.** This is the most important rule.

- Chinese, Japanese, Korean: restore the original Han characters / the established
  local name. Examples: Hội quán Phúc Kiến → 福建会馆 · Hội quán Triều Châu → 潮州会馆
  · Quan Công / Quan Thánh Đế Quân → 关公 / 关圣帝君 · Thiên Hậu → 天后 · Chùa Cầu
  → 来远桥 (in Japanese, 日本橋 is the name visitors know) · Tụy Tiên Đường Minh Hương
  → 萃先堂 · Minh Hương → 明乡 · bát tiên quá hải → 八仙过海 · Xích Thố → 赤兔 ·
  Tam Quốc diễn nghĩa → 三国演义 · gốm Hizen → 肥前焼 · búp bê Koga → 古賀人形.
- English, French, German: keep the Vietnamese name in Latin script **with its
  diacritics**, and add the established English exonym where one exists (Chùa Cầu →
  "the Japanese Covered Bridge"). Add a three-to-five-word gloss on first use when
  the name carries meaning the reader needs.
- If you cannot verify a name, keep the Vietnamese and list it under "Uncertain"
  at the end. Never invent characters.

**2. Translate the concept, not the words.** Vietnamese heritage vocabulary often
has no one-word equivalent: hoành phi, liễn đối, bao lam, thiên tỉnh, vì vỏ cua,
ghe bầu, nhà thờ tộc, đình, hội quán, tiền hiền/hậu hiền, sắc phong. Give the
reader the thing itself in a few words ("thiên tỉnh" → "skywell", the open shaft
that is a tube house's only source of light), and stay consistent afterwards.

**3. Build a glossary first, then reuse it.** Before translating, fix your term for
each of these and never vary it: điểm đến (site) · check-in · tem (stamp) ·
điểm (point) · Sổ tay (the visitor's journal) · mắt cửa (the "door eye" charm that
is the app's own mark, and its stamp) · Điểm đề xuất (a site the app suggests
because it is quiet right now) · tuyến / hành trình (route) · vé (ticket) ·
quầy vé (ticket counter) · voucher · đừng bỏ lỡ (don't miss). Put the glossary at
the top of your output.

**4. Quiz questions are the one place a wrong nuance breaks the app.** Each
question has exactly one correct option, marked **ĐÁP ÁN ĐÚNG** in the source.
- The correct option must stay unambiguously correct, the two others unambiguously
  wrong, and all three mutually exclusive.
- Do not make the answer guessable from wording: keep the three options similar in
  length and grammatical shape; never make the correct one the longest or the only
  detailed one.
- Questions point at a physical object ("this crane", "these numbers", "the
  painting on the left as you look out from the main hall"). Keep the pointing
  precise — left stays left.
- Keep the **ĐÁP ÁN ĐÚNG** / **Đáp án** labels in your output so the order can be
  checked. Do not reorder options.

**5. Keep every `{...}` slot exactly as it is.** `Câu {i}/{n}` · `+{n} điểm` ·
`{d} · {m} phút đi bộ` · `Đã đến {name}`. The app substitutes numbers and names
there. You may move a slot within the sentence if your grammar requires it; you may
not rename, translate or drop one.

**6. Respect the length of the container.**
- **Giới thiệu ngắn** is one line on a map label — aim for the source's length, at
  most ~90 characters. Never turn it into two sentences.
- **Chữ trong ứng dụng** (section 6) are buttons, tabs and labels. Most must fit a
  phone button: keep them at or under the Vietnamese length. `Khám phá`,
  `Hành trình`, `Sổ tay` are the three bottom-tab labels — one or two words each.
- **Giới thiệu dài** and **Giải thích** may run long; keep the paragraph structure.

**7. Numbers, dates, money.** Vietnamese đồng stays đồng, formatted the way your
language writes it (50.000đ → "50,000 VND" in English). Dates: 28/8–2/9/2026 in
your locale's order. Centuries: thế kỷ XVII → "17th century" / 17. Jahrhundert /
17世紀. Keep every number identical to the source.

**8. Do not translate:** the section headings and field labels of the source file
(`### A1 Chùa Cầu`, `**Giới thiệu ngắn:**`) — they are scaffolding, keep them in
Vietnamese so the file can be matched back line by line. Sections 7 (language
greetings) needs no translation at all.

## Output

Return the whole file with the same headings, the same order and the same bullet
structure, with only the content translated. Then two short lists:

- **Uncertain** — names or terms you could not verify, with what you used and why.
- **Wrong in the source** — anything factually off, internally inconsistent, or
  where a quiz option looks like it could also be correct. Do not fix it silently.

Do not add, merge, drop or reorder any item. Do not add commentary inside the file.
