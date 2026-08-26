<script>
  import PageShell from '$lib/components/PageShell.svelte';
  import { i18n } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  // ponytail: placeholder terms — organizer replaces the copy before launch. Kept
  // inline (one page, one caller) rather than in strings.js or a JSON content file.
  const SECTIONS = {
    vi: [
      ['Về ứng dụng', 'Ứng dụng đồng hành cùng Tuần lễ Sáng tạo Hội An 2026, giúp bạn khám phá các điểm di sản, điểm danh và thu thập tem trên sổ tay sáng tạo của riêng mình. Ứng dụng miễn phí và hoạt động không cần đăng nhập.'],
      ['Dữ liệu và quyền riêng tư', 'Sổ tay, tem và điểm số được lưu ngay trên thiết bị của bạn, không cần tài khoản. Vị trí GPS chỉ dùng để điểm danh và tìm quầy vé gần nhất; cảm biến chuyển động chỉ dùng cho la bàn khi đi bộ. Nếu bạn bật nghiên cứu (mặc định tắt), ứng dụng chỉ gửi số lượng lượt ghé ẩn danh theo ô lưới thô — không lưu lộ trình, thời gian hay danh tính. Bạn có thể tắt bất cứ lúc nào trong mục Sổ tay.'],
      ['Điểm danh và phần thưởng', 'Việc điểm danh dựa trên vị trí bạn tự khai báo và câu đố tại chỗ. Phần quà là voucher giấy, đổi trực tiếp tại quầy vé tham quan phố cổ khi hoàn thành đủ điều kiện. Ban tổ chức có quyền thay đổi cơ chế điểm, phần thưởng và danh sách điểm đến.'],
      ['Miễn trừ trách nhiệm', 'Bạn tự chịu trách nhiệm về an toàn của mình khi di chuyển trong phố cổ. Ứng dụng cung cấp thông tin tham khảo và không đảm bảo tính chính xác tuyệt đối của khoảng cách, giờ mở cửa hay chỉ đường.'],
      ['Liên hệ', 'Mọi thắc mắc xin liên hệ ban tổ chức Tuần lễ Sáng tạo Hội An 2026.']
    ],
    en: [
      ['About the app', 'This app accompanies Hoi An Creative Week 2026, helping you explore heritage sites, check in and collect stamps in your own creative journal. It is free and works without any account.'],
      ['Data and privacy', 'Your journal, stamps and points are stored on your device — no account needed. GPS location is used only to check in and find the nearest ticket counter; motion sensors are used only for the walking compass. If you enable the study (off by default), the app sends only anonymous, coarse grid-cell counts — no path, no time, no identity. You can turn it off anytime on the Journal tab.'],
      ['Check-in and rewards', 'Check-in relies on your self-reported location and an on-site quiz. Rewards are paper vouchers, redeemed in person at any ancient-town ticket counter once you qualify. The organizer may change the points scheme, rewards and list of sites.'],
      ['Disclaimer', 'You are responsible for your own safety while moving through the ancient town. The app provides reference information and does not guarantee the accuracy of distances, opening hours or directions.'],
      ['Contact', 'For questions, please contact the Hoi An Creative Week 2026 organizers.']
    ]
  };
  const sections = $derived(SECTIONS[i18n.lang] ?? SECTIONS.en);
</script>

<PageShell title={s('terms_title')} back={true}>
  <div class="terms-page">
    {#each sections as [h, p] (h)}
      <section>
        <h2>{h}</h2>
        <p>{p}</p>
      </section>
    {/each}
  </div>
</PageShell>

<style>
  .terms-page { display: flex; flex-direction: column; gap: 20px; padding-bottom: 32px; max-width: 60ch; }
  .terms-page h2 { margin: 0 0 6px; font-size: 1.05rem; font-weight: 700; color: var(--ink); }
  .terms-page p { margin: 0; color: var(--ink); line-height: 1.6; }
</style>
