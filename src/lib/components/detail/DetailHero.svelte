<script lang="ts">
  // Backdrop image with title, tagline and the back button.
  let { title, tagline, backdropUrl, onBack } = $props<{
    title: string;
    tagline: string;
    backdropUrl: string | null;
    onBack: () => void;
  }>();
</script>

<div class="hero">
  {#if backdropUrl}
    <img src={backdropUrl} alt="" class="hero-img" />
  {/if}
  <div class="hero-fade"></div>
  <div class="hero-content">
    <button class="back-btn" onclick={onBack}>← Voltar</button>
    <h1 class="hero-title">{title}</h1>
    {#if tagline}
      <p class="hero-tagline">{tagline}</p>
    {/if}
  </div>
</div>

<style lang="scss">
  .hero {
    position: relative;
    z-index: 2;
    width: 100%;
    height: 420px;
    overflow: hidden;
  }

  .hero-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hero-fade {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      $color-bg-primary 0%,
      transparent 50%,
      rgba($color-bg-primary, 0.4) 100%
    );
  }

  .hero-content {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: $spacing-xl $spacing-xl $spacing-lg;
    max-width: 1440px;
    margin-inline: auto;
  }

  .back-btn {
    background: rgba($color-bg-secondary, 0.7);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: $color-text-main;
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    font-size: 0.82rem;
    cursor: pointer;
    margin-bottom: $spacing-md;
    transition: background $dur-fast;
    &:hover {
      background: rgba($color-bg-secondary, 0.9);
    }
  }

  .hero-title {
    font-family: $font-display;
    font-size: 2.8rem;
    line-height: 1.1;
    color: $color-text-main;
    margin: 0;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
  }

  .hero-tagline {
    font-size: 0.92rem;
    color: $color-text-muted;
    font-style: italic;
    margin: $spacing-xs 0 0;
  }

  @include respond-to(md) {
    .hero {
      height: 300px;
    }
    .hero-title {
      font-size: 1.8rem;
    }
  }
</style>
