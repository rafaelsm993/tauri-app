<script lang="ts">
  import "$lib/styles/global.css";
  import AppBackground from "$lib/components/ui/AppBackground.svelte";
  import type { Snippet } from "svelte";

  let { children } = $props<{ children: Snippet }>();
</script>

<AppBackground />
<div class="app-content">
  {@render children()}
</div>
