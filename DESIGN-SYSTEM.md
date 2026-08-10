# Hội An Creative Week 2026 — Design System

*Tuần lễ Sáng tạo Hội An 2026.* Synthesized from the official key-visual files
(`Tổng hợp element KV.ai`, `element cộng hưởng.ai`) and the live app (`src/app.css`,
`src/routes/`). This is the reference for designing anything in this brand — a
brief written so a human **or** an AI can produce on-brand work without the source
files.

Two sources, two jobs:
- **The `.ai` files** are the *print/poster* system (CMYK, photo composites, custom
  logotype). They define the look.
- **The app** is the *product* translation (RGB, offline, mobile). When they
  disagree, **the app tokens below are the truth for screens** — they are the
  tested, colour-managed values.

---

## 1. Concept & tone

**Tagline:** *Hành trình — Chạm di sản, Chạm sáng tạo* / "Embrace Heritage,
Inspire Creativity." A walking **journey** that *touches* heritage and creativity.

**Feeling:** warm, handcrafted, festive, sunlit Hội An at lantern-hour. Old-town
ochre walls, silk lanterns, folk craft (pottery, wood, mask-making), the Thu Bồn
river. Modern and clean, **not** kitschy-touristy — heritage rendered in a
confident contemporary graphic language.

**One rule that governs everything:** the palette is warm and saturated, but on
any given surface **only one or two things are allowed to be loud.** Posters put
colour in the motifs and let the paper breathe; the app goes further — the basemap
is desaturated so the 25 destinations are the only saturated things on screen.

---

## 2. Colour

Exact RGB truth (from `src/app.css :root`). The `.ai` is CMYK; these are the
screen-correct equivalents — **use these hex values.**

### Paper / ground (warm off-whites, never pure white)
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#fbe3da` | base peach paper |
| `--paper-2` | `#fdecd4` | warmer cream paper |
| `--surface` | `#fff7ef` | cards, raised surfaces |
| `--bg` | `#fdeee2` | recessed fills: inputs, table cells, thumbs |

The signature ground is a **peach→pink gradient**, e.g.
`radial-gradient(120% 80% at 100% 0%, #fde3c9 0, transparent 60%),
linear-gradient(160deg, #fdeada, #fbdcd3 70%, #f9d3cb)`.

### Ink (brown-black, never neutral grey)
| Token | Hex | Use |
|---|---|---|
| `--ink` | `#52281f` | body text |
| `--muted` | `#a2786a` | secondary text |
| `--line` | `#f0d5c7` | hairlines, borders |

### Brand
| Token | Hex | Use |
|---|---|---|
| `--brand` | `#e85f34` | coral — primary action, accents |
| `--brand-soft` | `#f4a25a` | soft orange |
| `--brand-mid` | `#a72f1b` | mid oxblood |
| `--brand-dark` | `#7e1f13` | **oxblood — all display headings** |
| `--gold` | `#f3c24e` | scallop trim, sparks, highlights |
| `--teal` | `#2fa8a0` | cool accent (lantern, strip) |

### Gradients (motifs are gradient-filled, not flat)
| Token | Value | Use |
|---|---|---|
| `--grad-brand` | `linear-gradient(135deg, #f0713f, #e04f28)` | primary buttons, progress bar |
| `--grad-warm` | `linear-gradient(120deg, #f7c95c, #f0713f)` | gold→coral cloud capsules |
| `--grad-strip` | `linear-gradient(90deg, #2fa8a0, #7cc47f, #f3c24e, #fbe3da, #f0713f)` | the teal→green→gold→peach→coral brand strip (4px top rule) |

Motif-specific gradients seen in the KV: **lantern** teal `#bfe3d8`→cream
`#fdf3c9` with coral tie; **cloud scroll** green `#8ec98f`→blue `#1f6fb2`;
**peony** coral petals with a gold `#f7c948` glowing centre; **layered ripple**
stacked `#f6b64a`/`#ef7a48`/`#e0532a`.

### Category accents (map pins, chips, tags — stay inside the warm family)
| Category | Token | Hex |
|---|---|---|
| Di tích (heritage site) | `--c-di-tich` | `#b3311f` |
| Hội quán (assembly hall) | `--c-hoi-quan` | `#2fa8a0` |
| Nhà cổ (old house) | `--c-nha-co` | `#d99a2b` |
| Bảo tàng (museum) | `--c-bao-tang` | `#7a5aa8` |
| Trải nghiệm (experience) | `--c-trai-nghiem` | `#e0537f` |

---

## 3. Typography

**The logotype is fixed artwork — never re-typeset it.** "Tuần Lễ Sáng Tạo Hội
An" / "Hội An Creative Week" ships as the supplied lockup images (see §5). It uses
a custom festive display face (Kufam / Unbounded / K2D / KoHo / Red Rose /
Bellefair per the KV package) that is **not** loaded in the app.

**Everything else is set in one family: `Be Vietnam Pro`** (self-hosted, weights
400/500/600/700/800, vi+latin subsets). Rationale: heavy geometric sans matching
the key visual, works offline, full Vietnamese diacritic coverage.

| Role | Spec |
|---|---|
| Display / headings | Be Vietnam Pro **800**, **UPPERCASE**, tight line-height (~0.98), oxblood `--brand-dark` |
| Kicker / eyebrow | 700, uppercase, letter-spacing ~0.14em, `--brand-mid`, ~0.68rem |
| Body | 400–600, `--ink`, line-height ~1.62 |
| Numbers (dates, counters) | 800 display weight, oxblood |

No serif. No system-font fallback look. Sentence case for UI labels/buttons
("Check in", not "SUBMIT"); UPPERCASE reserved for display headings and eyebrows.

**Bilingual is mandatory.** VI is primary (app opens in VI), EN secondary. Every
content string is `{ vi, en }`. Proper nouns / year / date-range stay
one-language.

---

## 4. Layout & structure

The poster grammar, top to bottom:

1. **Brand strip** — a thin (4px) `--grad-strip` rule at the very top edge.
2. **Scallop eave** — a row of gold roof-tile half-domes (`--gold`) hanging from
   the top, evoking old-town tiled eaves. App: pure-CSS `.scallop`
   (stacked `radial-gradient` domes + a shine + a hairline ridge).
3. **Corner lockups** — small "Hội An Creative Week 2026" wordmark top-left;
   organizer credits ("ĐƠN VỊ CHỈ ĐẠO / CHỦ TRÌ…") top-right in tiny oxblood caps.
4. **Centre wordmark** — the stacked "Tuần Lễ / Sáng Tạo / Hội An 2026" logotype.
5. **Hero block** — oxblood display headline (the tagline) with **photos masked
   inside cloud-scroll capsules** sitting between the words (see §5). English
   sub-tagline in `--brand-mid` beneath.
6. **Date / venue lockup** — big oxblood date, venue beside it separated by a
   3px `--brand` left-border or a hairline divider.
7. **Photo base** — full-bleed old-town photograph anchored to the bottom, its
   top edge dissolving into cloud-scroll capsules.

**Decorative marks scattered sparingly:** a small **plus/cross** (╬) and a
**four-petal spark** (✦, the `.spark`), both in `--gold` or `--brand-soft`.

**Formats supplied:** portrait poster, landscape banner, vertical "story"
(1:2.5), sponsor/credit wall, and standalone date/venue typographic lockups.

**Radii & depth:** `--radius: 20px`, `--radius-sm: 14px`. Shadows are warm and
low: `--shadow` (soft lift), `--shadow-lift` (bigger). Capsules are fully rounded
(`border-radius: 999px`).

---

## 5. Motif library (`element cộng hưởng`)

Four core motifs, each supplied as **{ VI lockup, EN lockup, blank }**. The
**blank** versions (no baked text) are the reusable design elements — layer your
own bilingual type over them.

| Motif | Meaning | Palette | Files (PNG #) | Best use |
|---|---|---|---|---|
| 🏮 **Silk lantern** (đèn lồng) | Hội An's icon | teal→cream, coral tie + 4-petal knot | VI 02 · EN 07 · **blank 14** | hero centrepiece, splash, app icon |
| 🌸 **Peony + cloth** (hoa) | festivity, offering | coral petals, gold centre, oxblood cloth | VI 01/12 · EN 06 · **blank 13** | reward/achievement badge, alt hero |
| ☁️ **Cloud scroll** (mây) | Á-Đông sky, motion | green→blue | VI 05 · EN 09 · **blank 15** | section dividers, footers, banners |
| 🟠 **Layered ripple** | radiating energy | stacked gold→coral | VI 04 · EN 10 · **blank 16** | backgrounds, accent bands |
| ☁️ **Cloud-pill stack** (mây cách điệu) | stylized cloud-scroll | coral / cream | VI 03 · EN 11 | inline decoration, capsule behind headline text |
| **Wordmark only** | — | oxblood / cream | 08 (4 variants) | small brand mark in nav/footer |

**Photo-in-capsule masking** is the signature device: crop a craft/heritage photo
into a rounded-capsule (or cloud-pill) shape, tint it monochrome-coral, and place
it *between the words* of the oxblood headline. This ties photo → type → motif into
one object.

### The mắt cửa is separate and app-only
The app's own device is the **mắt cửa** ("door-eye" — the round talisman over Hội
An doorways): `MatCua.svelte` on screen, `pinImage()`/`markSvg()` on the map. It is
**not** part of the KV element set. It is the product's identity — every map pin,
card and stamp. One mark per category, colour = category accent, ink keyline by
underprint, gold four-petal spark on "spotlight" sites. **Keep it for pins;** use
the KV motifs (lantern etc.) for hero/decoration.

---

## 6. Applying it to the app (screen constraints)

The app is a **mobile-first, fully-offline PWA**. The poster look is adapted, not
copied:

- **Offline is absolute.** Nothing third-party on the critical path. Fonts
  self-hosted; motif art shipped as local PNGs under `static/` and precached.
  **Downscale motif PNGs to ~640–800px** before shipping (sources are 2067²) —
  keep the ~4.9 MB precache lean. No poster photos in the bundle (30–60 MB each,
  and text is baked into them).
- **The basemap carries no brand colour** — ivory land, white streets, grey
  labels — so the 25 mắt-cửa pins are the only saturated things. Don't tint the map.
- **Style from tokens, never hardcode hex.** Reuse `--brand`, `--paper`,
  `--grad-brand`, `--c-<category>`, and the motif classes (`.scallop`, `.spark`,
  `.brand-strip`).
- **Base path:** every internal link is prefixed with `base` from `$app/paths`
  (deployed under a subpath). Static assets too: `{base}/kv/lantern.png`.
- **Column:** ~540px phone column; `/organizer` widens to 1600px.

---

## 7. Do / Don't

**Do**
- Warm peach paper ground; oxblood display type; coral as the single loud accent.
- One or two saturated elements per surface, max.
- Gradient-filled motifs (never flat-fill the lantern/peony/cloud).
- UPPERCASE 800 for display, sentence case for UI actions.
- Reuse the blank motifs + your own `{vi,en}` type.

**Don't**
- Pure white backgrounds or neutral-grey text (use `--surface` / `--ink`).
- Re-typeset the logotype — it's fixed artwork.
- Tint the map or add a second saturated layer behind the pins.
- Use the mắt cửa as a KV motif or the lantern as a map pin — they don't swap.
- Ship full-res PNGs, poster photos, or the `.ai` in the bundle.

---

## 8. Asset inventory & handling

**Source files** (design team, not in the app bundle):
- `Tổng hợp element KV.ai` — master brand deck: 11 artboards (tagline lockups,
  sponsor wall, posters, date/venue lockups, programme schedule).
- `element cộng hưởng.ai` — 16 artboards = the motif library (= the 16 PNGs).

**Shipped in app:** `static/kv/lantern.png` (blank lantern 14, 760², ~117 KB) as
the home-hero motif. Add more blank motifs (13/15/16) the same way as needed.

**Viewing `.ai` without Illustrator** — modern `.ai` is a PDF wrapper (`%PDF-1.6`):
```bash
pdfinfo  "file.ai"                     # page/artboard count + size
pdftoppm -png -r 150 "file.ai" out     # rasterize each artboard to out-NN.png
# magick / sips / qlmanage also work; poppler's pdftoppm renders per-page,
# so even the 465 MB master file is fine.
```

---

## 9. Voice (copy)

Warm, direct, active. VI primary and idiomatic (not translated-from-English);
EN clean and friendly. Sentence case, say what a tap does ("Check in" /
"Xem hộ chiếu"). Heritage words in Vietnamese stay Vietnamese (street names,
"Hội quán", "Nhà cổ"). Emoji used sparingly as functional icons on buttons
(📍 🎁 🗺️), not decoration.
