<script>
  import { onMount } from 'svelte';
  import { s } from '$lib/strings.js';

  // "Download the app": installing it is what makes the whole thing work with no
  // signal — the service worker already precaches every page, photo-free asset and
  // the content JSON. Chrome/Android gives us a real prompt; iOS Safari has no API
  // for it, so there we can only show the Share -> Add to Home Screen instruction.
  let prompt = $state(null);
  let installed = $state(false);
  let showIos = $state(false);

  const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  onMount(() => {
    installed = standalone();
    const onPrompt = (e) => {
      e.preventDefault();
      prompt = e;
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => (installed = true));
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  });

  async function install() {
    if (prompt) {
      prompt.prompt();
      await prompt.userChoice;
      prompt = null;
    } else if (isIos()) {
      showIos = true;
    }
  }
</script>

{#if !installed && (prompt || showIos || (typeof navigator !== 'undefined' && isIos()))}
  <div class="install">
    <button class="btn secondary" onclick={install} style="width: 100%">{s('install')}</button>
    <small class="muted">{showIos ? s('install_ios') : s('install_why')}</small>
  </div>
{/if}

<style>
  .install {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: center;
  }
</style>
