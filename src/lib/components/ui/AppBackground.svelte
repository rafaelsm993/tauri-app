<script lang="ts">
  import { onDestroy } from "svelte";
  import { ui } from "$lib/stores/ui.svelte";

  let pulsing = $state(false);
  let pulseTimer: ReturnType<typeof setTimeout>;

  $effect(() => {
    const click = ui.lastClick;
    if (click) {
      pulsing = true;
      clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => {
        pulsing = false;
      }, 900);
    }
  });

  onDestroy(() => {
    clearTimeout(pulseTimer);
  });
</script>

<div class="bg-layer" aria-hidden="true">
  <div class="bg-mesh" class:pulsing>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    <div class="orb orb-4"></div>
    <div class="orb orb-5"></div>
  </div>
  <div class="bg-noise"></div>
  <div class="bg-vignette"></div>
</div>

<style lang="scss">
  .bg-layer {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
    background: $color-bg-primary;
  }

  // ── Mesh gradient container ──
  .bg-mesh {
    position: absolute;
    inset: 0;
    filter: blur(100px) saturate(1.4);
    opacity: 0.45;
    transition:
      opacity 0.3s ease-out,
      filter 0.3s ease-out;

    &.pulsing {
      opacity: 0.7;
      filter: blur(70px) saturate(2);
    }
  }

  // ── Orbs — large drifting gradient blobs ──
  .orb {
    position: absolute;
    border-radius: 50%;
    will-change: transform;
  }

  .orb-1 {
    width: 55vmax;
    height: 55vmax;
    top: -25%;
    left: -20%;
    background: radial-gradient(
      circle,
      rgba($color-primary, 0.6) 0%,
      rgba($color-primary, 0.15) 40%,
      transparent 65%
    );
    animation: drift-1 12s ease-in-out infinite;
  }

  .orb-2 {
    width: 45vmax;
    height: 45vmax;
    bottom: -15%;
    right: -15%;
    background: radial-gradient(
      circle,
      rgba($color-accent, 0.5) 0%,
      rgba($color-accent, 0.12) 40%,
      transparent 65%
    );
    animation: drift-2 15s ease-in-out infinite;
  }

  .orb-3 {
    width: 38vmax;
    height: 38vmax;
    top: 35%;
    left: 45%;
    background: radial-gradient(
      circle,
      rgba($color-primary, 0.35) 0%,
      rgba($color-primary, 0.08) 45%,
      transparent 65%
    );
    animation: drift-3 10s ease-in-out infinite;
  }

  .orb-4 {
    width: 32vmax;
    height: 32vmax;
    top: 5%;
    right: 15%;
    background: radial-gradient(
      circle,
      rgba($color-accent, 0.3) 0%,
      rgba($color-primary, 0.06) 45%,
      transparent 65%
    );
    animation: drift-4 13s ease-in-out infinite;
  }

  .orb-5 {
    width: 40vmax;
    height: 40vmax;
    bottom: 10%;
    left: 20%;
    background: radial-gradient(
      circle,
      rgba($color-primary, 0.3) 0%,
      rgba($color-primary, 0.06) 40%,
      transparent 65%
    );
    animation: drift-5 11s ease-in-out infinite;
  }

  // ── Drift keyframes — wide, fast organic movement ──
  @keyframes drift-1 {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    20% {
      transform: translate(18vw, 12vh) scale(1.15);
    }
    40% {
      transform: translate(-8vw, 25vh) scale(0.9);
    }
    60% {
      transform: translate(15vw, -10vh) scale(1.1);
    }
    80% {
      transform: translate(-12vw, 5vh) scale(0.95);
    }
  }

  @keyframes drift-2 {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    20% {
      transform: translate(-20vw, -10vh) scale(1.12);
    }
    40% {
      transform: translate(12vw, -18vh) scale(0.88);
    }
    60% {
      transform: translate(-8vw, 14vh) scale(1.08);
    }
    80% {
      transform: translate(16vw, -4vh) scale(0.94);
    }
  }

  @keyframes drift-3 {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    25% {
      transform: translate(-22vw, 15vh) scale(1.2);
    }
    50% {
      transform: translate(16vw, -12vh) scale(0.85);
    }
    75% {
      transform: translate(-10vw, -8vh) scale(1.1);
    }
  }

  @keyframes drift-4 {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    20% {
      transform: translate(15vw, 18vh) scale(1.1);
    }
    50% {
      transform: translate(-18vw, -14vh) scale(0.9);
    }
    80% {
      transform: translate(10vw, 8vh) scale(1.05);
    }
  }

  @keyframes drift-5 {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    30% {
      transform: translate(20vw, -15vh) scale(1.15);
    }
    60% {
      transform: translate(-14vw, 20vh) scale(0.88);
    }
    85% {
      transform: translate(8vw, -6vh) scale(1.06);
    }
  }

  // ── Film grain noise ──
  .bg-noise {
    position: absolute;
    inset: -50%;
    width: 200%;
    height: 200%;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    animation: grain 8s steps(10) infinite;
    opacity: 0.5;
    z-index: 2;
  }

  @keyframes grain {
    0%,
    100% {
      transform: translate(0, 0);
    }
    10% {
      transform: translate(-5%, -10%);
    }
    20% {
      transform: translate(-15%, 5%);
    }
    30% {
      transform: translate(7%, -25%);
    }
    40% {
      transform: translate(-5%, 25%);
    }
    50% {
      transform: translate(-15%, 10%);
    }
    60% {
      transform: translate(15%, 0%);
    }
    70% {
      transform: translate(0%, 15%);
    }
    80% {
      transform: translate(3%, 25%);
    }
    90% {
      transform: translate(-10%, 10%);
    }
  }

  // ── Vignette ──
  .bg-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse 100% 100% at 50% 50%,
      transparent 30%,
      rgba($color-bg-primary, 0.5) 60%,
      rgba($color-bg-primary, 0.85) 100%
    );
    z-index: 3;
  }
</style>
