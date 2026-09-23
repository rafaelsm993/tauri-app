<script lang="ts">
  import "$lib/styles/global.css";
  import AppBackground from "$lib/components/ui/AppBackground.svelte";
  import type { Snippet } from "svelte";
  import { attachConsole } from "@tauri-apps/plugin-log";

  let { children } = $props<{ children: Snippet }>();

  $effect(() => {
    let detach: (() => void) | undefined;
    attachConsole().then((fn) => {
      detach = fn;
    });
    return () => detach?.();
  });
</script>

<AppBackground />
<div class="app-content">
  {@render children()}
</div>
