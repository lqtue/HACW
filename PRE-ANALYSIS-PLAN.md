# Pre-analysis plan — HACW 2026 dispersal switchback

**Status:** pre-registered by the commit that adds this file, before any festival data exists.
Written 27 Aug 2026; festival runs 28 Aug – 2 Sep 2026.
Amendments after 28 Aug 00:00 ICT must be added as dated entries in §9, never by editing the text above.

Analysis is on `events` (schema.sql). Nothing here is computed live; nothing here changes the app.

---

## 1. Question

Does an in-app crowd-aware nudge (gold "spotlight" mark on the quieter half of sites, plus an
"uncrowded" term in the planner's ranking) make app users' check-ins more evenly spread across
the 25 heritage sites than the same app with the nudge switched off?

Secondary: does any effect persist after the nudge stops? Does it differ by nationality or ticket type?

**Scope limit, stated once and repeated in every output:** the sample is *app users*, not the
Hội An crowd. Gate-scan counts per site were not obtainable (see §8), so no claim about the
whole visitor population is supported by this design.

---

## 2. Design

Switchback (alternating cluster-crossover), unit = half-day, switching at 13:00 ICT.
Schedule is fixed in `src/lib/switchback.js` and is the pre-registration:

| | 28 Aug | 29 Aug | 30 Aug | 31 Aug | 1 Sep | 2 Sep |
|---|---|---|---|---|---|---|
| AM | **on** | off | **on** | off | off | off |
| PM | off | **on** | off | **on** | off | off |

- **Main comparison:** 8 units from days 1–4 (4 on, 4 off), balanced so AM and PM each get 2 on / 2 off.
- **Tail:** days 5–6, 4 units, all off.

Randomisation is at the unit, so every visitor in a unit sees the same app. This removes the
interference problem an individual-level RCT would have had: if the nudge works, nudged visitors
empty the busy sites, which improves conditions for control visitors and biases the individual
contrast toward zero.

**Alternating, not one-way.** A stepped wedge crosses each cluster from control to intervention
once and never back, which "induces a colinearity between time and the intervention" so that
"any analysis of the intervention effect must adjust for time" (Hughes et al., 2019; Xia et al., 2022).
Alternating half-days avoid that for days 1–4. **The tail does not** — days 5–6 are confounded
with late-festival effects (visitor-mix change, staff fatigue, day-of-week). The tail is therefore
analysed and reported separately from the main estimate (§5.3), never pooled with it.

---

## 3. Assigning a visit to a unit

`sid` is one visit (ephemeral, dies with the tab). A visit can straddle 13:00, so the plan was
made under one condition and the check-ins recorded under another.

**Rule, fixed in advance:** a visit belongs to the unit of its **first** event
(`MIN(seq)` within `sid`). Visits whose events span more than one unit are flagged `crossing`.

- Primary analysis: **excludes** crossing visits.
- Sensitivity analysis: includes them, assigned by first event. Report both. If they disagree
  in sign, the result is not robust and must be reported as such.

Events with `sid IS NULL` (study switched off) contribute to unit-level counts (§5.2) but cannot
enter visitor-level analysis (§5.1).

---

## 4. Outcome measures

### 4.1 Primary — visitor level (binary)

For each non-crossing visit with ≥1 `checkin`:

> `reached_quiet` = 1 if any `checkin` in that visit has `spot = 1`, else 0.

`spot` is the **true** quiet-half membership at the moment of check-in, recorded regardless of
whether the visitor was shown the gold mark. That is what makes on- and off-units comparable.

### 4.2 Secondary — unit level (evenness)

Per unit, over check-in counts `c_1 … c_25` across all 25 sites (zeros included), with
`N = Σ c_i` and shares `p_i = c_i / N`:

> Normalised Shannon evenness  `J = −Σ p_i ln p_i / ln 25`  (0 = all at one site, 1 = perfectly even)

Entropy is preferred to a spatial Gini because Gini and HHI "are sensitive to economic
(Zhou et al., 2016) and landmass (Li & Liu, 2022) factors" and typically "do not control for the
quality of tourist attractions" (Wang & Chen, 2024). Gini is still reported as a robustness check.

**Sampling-bias correction is mandatory.** Entropy is biased downward at small `N`, so a unit
with more check-ins would look more even for no substantive reason. Apply Miller–Madow:

> `J_corrected = (H + (K − 1) / (2N)) / ln 25`, where `K` = number of sites with `c_i > 0`

and additionally report a rarefied version: subsample every unit to the smallest unit's `N`,
1000 draws, take the mean. If corrected and rarefied disagree, the rarefied result stands.

### 4.3 Tertiary

- **Deviation from expected share.** Expected share per site from the static `traffic` /
  `promoPriority` columns in `destinations.json` (fixed before the festival). Outcome =
  Σ|observed − expected| per unit. Answers "did traffic move toward the sites the organiser wanted"
  rather than "did it flatten".
- **Transition matrix.** Site-to-site transitions from consecutive `checkin` events within a `sid`,
  compared on- vs off-unit (Muñoz Mazón et al., 2019, used Markov chains per period for exactly this).
  Shows *which substitutions* the nudge caused, not only that marginals shifted.
- **Dwell proxy.** `next arrive.ts − this checkin.ts` within a `sid`, minus the straight-line walk
  time from `src/lib/route.js`. Contaminated by walking and by anything done between sites; treat
  as ordinal, not minutes. Xie et al. (2023) found stay time correlates with experience quality,
  which is the interpretation this supports — weakly.

---

## 5. Inference

### 5.1 Primary: visitor level, wild cluster bootstrap

Logistic regression of `reached_quiet` on `nudge`, with fixed effects for `day` and `half`,
clustered by unit (8 clusters). Cluster-robust standard errors are unreliable at 8 clusters, so
inference is by **wild cluster bootstrap** (Rademacher weights, 9999 reps, null imposed).

Report: odds ratio, 95% CI, bootstrap p.

### 5.2 Secondary: unit level, exact permutation — and why it cannot reach p < 0.05

Hughes et al. (2019) recommend permutation inference for this family of designs because it is
"robust to misspecification of both the mean and covariance structure," and Xia et al. (2022)
show that with few clusters a mis-specified random-effects structure makes inference
anti-conservative. So permutation is the right instrument here.

**But count the permutations.** Days 1–4 each carry exactly one switch, so each day is either
(AM on, PM off) or (AM off, PM on) — 2⁴ = 16 assignments. Requiring AM and PM to be balanced
2-on/2-off leaves **C(4,2) = 6**. The smallest attainable one-sided p is therefore **1/6 ≈ 0.17**;
relaxing the AM/PM balance gives 1/16 ≈ 0.06. **Neither can reach 0.05.**

This is a property of a 6-day festival, not a fixable analysis choice. Consequences, accepted in advance:

- The unit-level evenness analysis is **estimation, not hypothesis testing**. Pre-specified output
  is the paired effect size and its interval — *not* a significance claim.
- The paired statistic is the within-day difference `J_on − J_off` for each of days 1–4
  (pairing removes the day effect). Report all four differences individually, their mean, and a
  bootstrap CI. Four numbers is a small enough table to publish in full; do so.
- Any p-value from §5.2 is reported with its floor stated inline ("exact permutation p = 0.17,
  the minimum attainable under this schedule").
- §5.1 is the analysis that can support an inferential claim. §5.2 is the one that speaks in the
  units a heritage authority cares about. Report both; do not let the reader mistake which is which.

### 5.3 Tail

Days 5–6 vs the off-units of days 1–4, same outcomes. **Descriptive only.** Confounded with time
(§2). A persistence claim requires the tail to look like the on-units, not merely differ from
the off-units — state which pattern was observed and do not model it.

### 5.4 Subgroups

`nat` (chosen language) and `tk` (ticket type, 5 or 3) as pre-specified interactions with `nudge`.
Exploratory, not powered. Report effect sizes with intervals, no subgroup p-values.

Behavioural clusters are the more defensible segmentation: cluster visits on their sequences and
*then* describe the clusters by `nat`/`tk`. Domènech et al. (2020) found visitor profiles emerge
"more importantly, based on their spatiotemporal behaviour" rather than on demographics alone;
Ji et al. (2021) recovered three behaviour patterns from theme-park sequences by sequence alignment.

### 5.5 "Pick for me" A/B — restrict to on-units

`auto_steer` vs `auto_random` is a separate, visitor-level coin flip. **Analyse on nudge-on units only.**
On off-units the steer arm has no crowd term, so the two arms partly collapse and the contrast is
not the one the label implies.

**Known data caveat:** `auto_*.spot` records the *displayed* quiet state (empty on off-units),
whereas `checkin.spot`, `arrive.spot` and `plan_pick.spot` record the *true* quiet state.
Restricting to on-units makes the two definitions coincide, which is the second reason for the
restriction. Do not compare `auto_*.spot` across units.

Chain per `sid`: `auto_*` (filled) → `plan_pick` (kept) → `checkin` (visited).

---

## 6. Exact queries

Unit-level check-in matrix — the input to §4.2:

```sql
SELECT day, half, nudge, dest, COUNT(*) AS c
FROM events
WHERE t = 'checkin' AND day BETWEEN '2026-08-28' AND '2026-08-31'
GROUP BY day, half, nudge, dest;
```

Visit table — the input to §5.1 (`crossing` flags visits spanning >1 unit):

```sql
WITH v AS (
  SELECT sid,
         MIN(ts) AS t0,
         COUNT(DISTINCT day || half)                        AS units,
         MAX(CASE WHEN t = 'checkin' AND spot = 1 THEN 1 ELSE 0 END) AS reached_quiet,
         SUM(CASE WHEN t = 'checkin' THEN 1 ELSE 0 END)      AS checkins,
         MAX(nat) AS nat, MAX(tk) AS tk
  FROM events WHERE sid IS NOT NULL GROUP BY sid
)
SELECT v.*, e.day, e.half, e.nudge, (v.units > 1) AS crossing
FROM v JOIN events e ON e.sid = v.sid AND e.ts = v.t0
WHERE v.checkins > 0;
```

Plan adherence — planned vs actually visited, per visit:

```sql
SELECT sid,
       COUNT(DISTINCT CASE WHEN t = 'plan_pick' THEN dest END) AS planned,
       COUNT(DISTINCT CASE WHEN t = 'checkin'   THEN dest END) AS visited,
       COUNT(DISTINCT CASE WHEN t = 'checkin' AND dest IN (
         SELECT dest FROM events x WHERE x.sid = e.sid AND x.t = 'plan_pick'
       ) THEN dest END) AS kept
FROM events e WHERE sid IS NOT NULL GROUP BY sid;
```

Arrived but never stamped — the abandonment signal:

```sql
SELECT dest, nudge, COUNT(*) AS abandoned
FROM events a
WHERE a.t = 'arrive' AND NOT EXISTS (
  SELECT 1 FROM events c
  WHERE c.sid = a.sid AND c.t = 'checkin' AND c.dest = a.dest
)
GROUP BY dest, nudge;
```

Pick-for-me funnel (§5.5), on-units only:

```sql
SELECT a.t AS arm, COUNT(*) AS filled,
       SUM(EXISTS (SELECT 1 FROM events p
                   WHERE p.sid = a.sid AND p.t = 'plan_pick' AND p.dest = a.dest)) AS kept,
       SUM(EXISTS (SELECT 1 FROM events c
                   WHERE c.sid = a.sid AND c.t = 'checkin'   AND c.dest = a.dest)) AS visited
FROM events a
WHERE a.t IN ('auto_steer','auto_random') AND a.nudge = 1 AND a.sid IS NOT NULL
GROUP BY a.t;
```

Export for offline analysis (R/Python/DuckDB):

```
npx wrangler d1 execute hacw --remote --command "SELECT * FROM events" --json > events.json
```

---

## 7. What is fixed before data exists

1. Schedule (§2) — in `src/lib/switchback.js`, by commit hash.
2. Unit assignment rule and the crossing exclusion (§3).
3. Primary outcome `reached_quiet` (§4.1) and primary inference (§5.1).
4. Entropy with Miller–Madow correction plus rarefaction as the evenness measure (§4.2).
5. The admission that §5.2 cannot reach p < 0.05, and that it is reported as estimation (§5.2).
6. Tail is descriptive (§5.3); subgroups are exploratory (§5.4).
7. Expected-share baseline = the `traffic`/`promoPriority` values in `destinations.json` as of
   this commit. If the file changes during the festival, the pre-festival values still stand.

---

## 8. Limitations to state in every output

- **No denominator.** Gate-scan counts per site were unobtainable. Every claim is about app users.
  `ev:welcome` per day over tickets sold would be the adoption rate if sales figures arrive later.
- **Self-selection.** App users are not a random sample of visitors. This is a known and named
  limitation in this literature — Muñoz Mazón et al. (2019) report that "not all the tourists were
  willing to allow all their movements during their visit to the destination to be tracked."
  Their conclusion also favours this design: the best instruments "require low participation or
  interaction of the tourist so that data capture is as transparent as possible."
  A free external check on whether app users move like the wider crowd is geotagged social media —
  Domènech et al. (2020) reconstructed trajectories in Toledo from Flickr alone.
- **Underpowered at the unit level** (§5.2). 8 units, 6 permutations.
- **Tail confounded with time** (§2, §5.3).
- **Dwell is contaminated** by walking and by anything else done between sites (§4.3).
- **No experience measure at all.** Dwell correlates with experience quality (Xie et al., 2023) but
  that study had a questionnaire; this one has nothing. A one-tap rating after check-in would close
  this and costs one event type. Not shipped — see §9.
- **Counters are not the study record.** `count:<dest>` double-counts on a retried queue flush by
  design. Count check-ins from `events` (deduplicated on `eid`), never from `counters`.
- **Pre-festival noise.** The database holds real traffic from before 28 Aug. Every query here is
  date-filtered; keep it that way.

---

## 9. Amendments

*(Append dated entries. Do not edit §1–§8 after 28 Aug 00:00 ICT.)*

- **2026-08-27** — Plan registered. Known gaps accepted rather than fixed, on the grounds that the
  festival opens in under 24 h and the deployed build is tested: (a) no satisfaction rating,
  (b) no exit event, so dwell stays a proxy, (c) `auto_*.spot` is display-state, handled by
  restricting that analysis to on-units (§5.5).

---

## 10. References

Domènech, A., Mohíno Sanz, I., & Moya‐Gómez, B. (2020). Using Flickr geotagged photos to estimate visitor trajectories in World Heritage cities. *ISPRS International Journal of Geo-Information, 9*(11), 646. https://doi.org/10.3390/ijgi9110646

Grossi, L., & Mussini, M. (2021). Seasonality in tourist flows: Decomposing and testing changes in seasonal concentration. *Tourism Management, 84*, 104289. https://doi.org/10.1016/j.tourman.2021.104289

Hughes, J. P., Heagerty, P. J., & Xia, F. (2019). Robust inference for the stepped wedge design. *Biometrics, 76*(1), 119–130. https://doi.org/10.1111/biom.13106

Ji, K. M., Zhao, Y., & Wang, J. (2021). Consuming the mundane and extraordinary: Hospitality facilities and transport in the spatiotemporal behaviour of theme park visitors. *Asia Pacific Journal of Tourism Research, 26*(9), 953–972. https://doi.org/10.1080/10941665.2021.1925318

Muñoz Mazón, A. I., Fuentes Moraleda, L., & Chantre-Astaiza, Á. (2019). The study of tourist movements in tourist historic cities: A comparative analysis of the applicability of four different tools. *Sustainability, 11*(19), 5265. https://doi.org/10.3390/su11195265

Najafi, M., et al. (2026). Marketing responses to overtourism: A strategic mapping and diagnostic review. *Journal of Vacation Marketing*. https://doi.org/10.1177/13567667261423653

Schmücker, D., et al. (2023). The INPReS intervention escalation framework for avoiding overcrowding in tourism destinations. *Tourism and Hospitality, 4*(2), 17. https://doi.org/10.3390/tourhosp4020017

Wang, X. Q., & Chen, G. (2024). Attraction agglomeration and destination agglomeration: The case of Chinese national scenic areas. *Journal of Travel Research, 64*(7), 1701–1718. https://doi.org/10.1177/00472875241261627

Xia, F., Kenny, A., & Heagerty, P. J. (2022). Random effect misspecification in stepped wedge designs. *Clinical Trials, 19*(4), 380–383. https://doi.org/10.1177/17407745221084702

Xie, C., Zhao, M., & Li, Y. (2023). Evaluating the effectiveness of environmental interpretation in national parks based on visitors' spatiotemporal behavior and emotional experience: A case study of Pudacuo National Park, China. *Sustainability, 15*(10), 8027. https://doi.org/10.3390/su15108027

**Not verified:** project notes cite Hao, Ren & Yan (2025), "Beyond the hotspots," as the closest
published twin. It did not surface in a scite search on 27 Aug 2026. Confirm it exists before citing it.

Framing for the client draws on the INPReS escalation ladder (Schmücker et al., 2023):
information → nudging → pricing → reservation → stoppage. This app is rungs 1–2 — the cheapest and
least restrictive — so the study is evidence on whether a destination can disperse visitors
*before* escalating to pricing or access limits.
