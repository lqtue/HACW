<script>
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import IconList from '$lib/components/IconList.svelte';
  import { installSteps, shareSheetInstall } from '$lib/install.js';
  import { s } from '$lib/strings.js';

  // "Download the app": installing it is what makes the whole thing work with no
  // signal — the service worker already precaches every page, photo-free asset and
  // the content JSON. Chrome/Android gives us a real prompt; iOS Safari has no API
  // for it. Either way the button opens a guidance sheet with the right steps.
  let prompt = $state(null);
  let installed = $state(false);
  let open = $state(false); // guidance sheet
  // ?install=1 forces the button visible for inspection (screens.html board,
  // desktop web) where no beforeinstallprompt fires and it's not iOS.
  let force = $state(false);

  const standalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  onMount(() => {
    installed = standalone();
    // ?install=1 forces the button visible; ?install=open also opens the guidance
    // sheet on load (both for the screens.html board).
    const flag = new URLSearchParams(location.search).get('install');
    force = flag === '1' || flag === 'open';
    if (flag === 'open') open = true;
    const onPrompt = (e) => {
      e.preventDefault();
      prompt = e;
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => (installed = true));
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  });

  async function installNow() {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    prompt = null;
    open = false;
  }
</script>

{#if !installed && (force || prompt || shareSheetInstall())}
  <button class="btn ghost" style="width: 100%" onclick={() => (open = true)}>{s('install')}</button>
{/if}

{#if open}
  <div class="scrim" onclick={() => (open = false)} role="presentation">
    <div class="sheet" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <h2>{s('install')}</h2>
      <!-- the same numbered steps + screenshots the onboarding install screen shows -->
      <IconList items={installSteps(base)} />
      {#if prompt}
        <button class="btn" style="width: 100%" onclick={installNow}>{s('install_now')}</button>
      {/if}
      <button class="btn ghost" style="width: 100%" onclick={() => (open = false)}>{s('close_btn')}</button>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed; inset: 0; z-index: 50;
    display: flex; align-items: flex-end; justify-content: center;
    background: rgba(0, 0, 0, 0.4);
  }
  .sheet {
    width: 100%; max-width: 540px;
    background: var(--paper); color: var(--ink);
    border-radius: 20px 20px 0 0;
    padding: 24px 20px calc(24px + env(safe-area-inset-bottom));
    display: flex; flex-direction: column; gap: 12px;
    max-height: 85dvh; overflow-y: auto;   /* the two screenshots make this sheet tall */
  }
  .sheet h2 { margin: 0; font-family: var(--font-display); font-size: var(--fs-xl); text-transform: uppercase; }
</style>
