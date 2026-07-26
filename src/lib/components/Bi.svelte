<script>
  // One { vi, en } content field as a pair of boxes. Every translatable field in
  // the editors is this, so the vi/en discipline is visible rather than remembered.
  /** @type {{ field: { vi: string, en: string }, label: string, rows?: number }} */
  let { field, label, rows = 1 } = $props();
</script>

<label class="ed-row">
  <span>{label} <em>vi</em></span>
  <textarea {rows} bind:value={field.vi}></textarea>
</label>
<label class="ed-row">
  <span>{label} <em>en</em></span>
  <textarea {rows} bind:value={field.en}></textarea>
</label>
