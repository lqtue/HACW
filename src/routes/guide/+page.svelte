<script>
  import PageShell from '$lib/components/PageShell.svelte';
  import { i18n } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  // How to play, on one page. Same shape as /terms: one caller, so the copy is inline
  // rather than in strings.js. Written VI-first — the EN column is a translation of it,
  // not the other way round.
  const STEPS = {
    vi: [
      [
        'Vé mở cho bạn mấy điểm',
        'Vé tham quan phố cổ cho bạn vào 5 điểm, một số loại vé là 3. Quét mã trên vé, ứng dụng giữ đúng số ô đó cho bạn và không để bạn chọn quá tay.'
      ],
      [
        'Chọn đường trước khi bước',
        'Tự chọn những điểm bạn muốn, hoặc bấm “Chọn giúp tôi” rồi sửa lại. Ứng dụng cũng có sẵn vài tuyến gọn: một di tích, một bảo tàng, ba điểm tự do, đi bộ là tới.'
      ],
      [
        'Đến nơi rồi mới điểm danh',
        'Đứng trước cửa hoặc trong sân điểm đến, mở trang của điểm đó rồi cho ứng dụng dùng vị trí. Còn xa thì ứng dụng nhắc bạn lại gần thêm chút nữa.'
      ],
      [
        'Trả lời đúng để nhận mắt cửa',
        'Mỗi điểm có vài câu hỏi về chính nơi bạn đang đứng. Đúng hết thì mắt cửa được đóng vào sổ tay. Sai một câu thì chờ vài giây rồi làm lại từ câu đầu — câu trả lời thường nằm ngay trên tấm biển bên cạnh bạn.'
      ],
      [
        'Điểm cộng dồn theo cách bạn đi',
        'Mỗi lần điểm danh được 10 điểm. Đúng hết ngay lần đầu thêm 5 điểm. Ghé điểm đang vắng khách, chỗ có nhãn “Đề xuất”, thêm 10 điểm. Đi trọn một tuyến thêm 30 điểm, và đủ cả 25 điểm đến thêm 100 điểm.'
      ],
      [
        'Đổi quà ở quầy vé',
        'Mở Sổ tay để xem mình đang ở mốc nào và còn thiếu bao nhiêu điểm. Đủ rồi thì ra quầy vé phố cổ, đưa màn hình cho nhân viên và nhận quà ngay tại chỗ. Mỗi sổ tay nhận một phần quà; mấy mốc lớn cần vé đã quét.'
      ],
      [
        'Sổ tay nằm trong máy bạn',
        'Không cần đăng nhập, không cần mạng. Đi trong phố mất sóng vẫn điểm danh được, có mạng lại thì ứng dụng tự gửi. Đổi máy thì mở Sổ tay, chép mã 8 ký tự hoặc quét lại vé, tem sẽ theo bạn về.'
      ]
    ],
    en: [
      [
        'How many sites your ticket opens',
        'An ancient-town ticket admits you to 5 sites; some tickets are 3. Scan the code on it and the app holds exactly that many slots for you, so you cannot overcommit.'
      ],
      [
        'Choose your route before you walk',
        'Pick the sites you want, or tap “Pick for me” and adjust. There are also ready-made short routes: one monument, one museum, three free choices, all within walking distance.'
      ],
      [
        'Check in once you are there',
        'Stand at the gate or in the courtyard, open that site’s page and let the app use your location. If you are still far off, it will tell you to come closer.'
      ],
      [
        'Answer correctly to earn a mắt cửa',
        'Each site asks a few questions about the place you are standing in. Get them all right and the mắt cửa is pressed into your journal. One wrong answer means a short wait and a restart from the first question — the answers are usually on the sign beside you.'
      ],
      [
        'Points add up from how you walk',
        'Every check-in earns 10 points. All answers right first time adds 5. Visiting a quiet site — the ones marked “Suggested” — adds 10. Finishing a whole route adds 30, and all 25 sites adds 100.'
      ],
      [
        'Claim your gift at a ticket counter',
        'Open the Journal to see which tier you are on and how far the next one is. Once you qualify, go to any ancient-town ticket counter, show the screen to staff and take the gift there and then. One gift per journal; the larger tiers need a scanned ticket.'
      ],
      [
        'Your journal lives on your phone',
        'No account, no connection needed. You can check in with no signal and the app catches up later. Changing phones: open the Journal, copy the 8-character code or scan your ticket again, and the stamps follow you.'
      ]
    ]
  };
  const steps = $derived(STEPS[i18n.lang] ?? STEPS.en);
</script>

<PageShell title={s('guide_title')} back={true}>
  <ol class="guide-page">
    {#each steps as [h, p], i (h)}
      <li>
        <span class="n" aria-hidden="true">{i + 1}</span>
        <h2>{h}</h2>
        <p>{p}</p>
      </li>
    {/each}
  </ol>
</PageShell>

<style>
  .guide-page {
    list-style: none;
    margin: 0;
    padding: 0 0 32px;
    display: flex;
    flex-direction: column;
    gap: 22px;
    max-width: 60ch;
  }
  .guide-page li { display: grid; grid-template-columns: auto 1fr; column-gap: 12px; }
  .n {
    grid-row: 1 / span 2;
    width: 28px; height: 28px; border-radius: 999px;
    display: grid; place-items: center;
    background: var(--brand); color: #fff;
    font-weight: 800; font-size: var(--fs-sm);
    font-variant-numeric: tabular-nums;
  }
  .guide-page h2 { margin: 3px 0 6px; font-size: var(--fs-md); font-weight: 700; color: var(--ink); }
  .guide-page p { margin: 0; color: var(--ink); line-height: 1.6; }
</style>
