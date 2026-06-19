<script>
  import { base } from '$app/paths';
  import { getPosition, distanceMeters } from '$lib/geo.js';
  import { categoryLabel, mapsUrl } from '$lib/util.js';
  import { hasStamp, addStamp } from '$lib/passport.svelte.js';

  let { data } = $props();
  const dest = data.dest;

  // ponytail: flip to false for production to remove the test bypass below.
  const SIMULATE = true;

  // idle -> locating -> (far | quiz) -> done ; or error
  let step = $state(hasStamp(dest.id) ? 'done' : 'idle');
  let message = $state('');
  let distance = $state(0);
  let picked = $state(null);

  async function checkIn() {
    step = 'locating';
    message = '';
    try {
      const here = await getPosition();
      distance = Math.round(distanceMeters(here, { lat: dest.lat, lng: dest.lng }));
      if (distance <= dest.radius) {
        step = 'quiz';
      } else {
        step = 'far';
      }
    } catch (e) {
      step = 'error';
      message =
        e?.code === 1
          ? 'Bạn cần cho phép truy cập vị trí để check-in.'
          : 'Không lấy được vị trí. Hãy thử lại ở ngoài trời.';
    }
  }

  function answer(i) {
    picked = i;
    if (i === dest.quiz.answer) {
      addStamp(dest.id);
      step = 'done';
    } else {
      message = 'Chưa đúng — thử lại nhé!';
    }
  }
</script>

<div class="topbar"><h1>{dest.name}</h1><small>{dest.nameEn}</small></div>

<div class="page">
  <div class="hero" style="--cat: var(--c-{dest.category})">
    <span class="watermark">{dest.name.charAt(0)}</span>
  </div>

  <span class="tag" style="background: var(--c-{dest.category})">{categoryLabel(dest.category)}</span>
  <p>{dest.description}</p>
  <p class="muted"><small>🕑 {dest.hours} · 📍 {dest.address}</small></p>

  <a class="btn secondary" href={mapsUrl(dest)} target="_blank" rel="noopener" style="width: 100%">
    ➤ Chỉ đường bằng Google Maps
  </a>

  <div class="checkin">
    {#if step === 'done'}
      <div class="success">✅ Đã check-in! Tem đã được thêm vào hộ chiếu.</div>
      <a class="btn secondary" href="{base}/passport">Xem hộ chiếu</a>
    {:else if step === 'idle' || step === 'error'}
      {#if message}<div class="banner">{message}</div>{/if}
      <button class="btn" onclick={checkIn} style="width: 100%">📍 Check-in tại đây</button>
      {#if SIMULATE}
        <button class="btn secondary" onclick={() => (step = 'quiz')} style="width: 100%">
          🧪 Giả lập đã đến nơi (test)
        </button>
      {/if}
    {:else if step === 'locating'}
      <button class="btn" disabled style="width: 100%">Đang xác định vị trí…</button>
    {:else if step === 'far'}
      <div class="banner">
        Bạn đang cách điểm đến khoảng <strong>{distance} m</strong> (cần ≤ {dest.radius} m).
        Hãy đến gần hơn rồi thử lại.
      </div>
      <button class="btn" onclick={checkIn} style="width: 100%">Thử lại</button>
    {:else if step === 'quiz'}
      <div class="quiz">
        <p><strong>✔ Đã đến nơi!</strong> Trả lời câu đố để nhận tem:</p>
        <p>{dest.quiz.question}</p>
        {#each dest.quiz.options as opt, i}
          <button
            class="opt"
            class:wrong={picked === i && i !== dest.quiz.answer}
            onclick={() => answer(i)}
          >{opt}</button>
        {/each}
        {#if message}<p class="muted">{message}</p>{/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .hero {
    position: relative;
    height: 150px;
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 14px;
    background:
      radial-gradient(140% 120% at 85% -10%, color-mix(in srgb, var(--cat) 55%, transparent), transparent 60%),
      linear-gradient(160deg, color-mix(in srgb, var(--cat) 22%, var(--surface)), var(--surface));
    border: 1px solid var(--line);
  }
  .hero .watermark {
    position: absolute;
    right: 8px;
    bottom: -24px;
    font-family: var(--font-display);
    font-size: 11rem;
    font-weight: 700;
    line-height: 1;
    color: var(--cat);
    opacity: 0.16;
    user-select: none;
  }
  .checkin { margin-top: 20px; display: grid; gap: 10px; }
  .success {
    background: #e6f4ea;
    border: 1px solid #a8d8b9;
    color: #1e6b34;
    border-radius: 12px;
    padding: 12px;
    font-weight: 600;
  }
  .quiz .opt {
    display: block;
    width: 100%;
    text-align: left;
    padding: 12px 16px;
    margin-bottom: 8px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    font-size: 1rem;
    cursor: pointer;
  }
  .quiz .opt.wrong { border-color: var(--brand); background: #fdece8; }
</style>
