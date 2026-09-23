<script lang="ts">
  // 16:9 YouTube embed.
  let { videoKey, name } = $props<{ videoKey: string; name: string }>();
</script>

<div class="trailer-wrapper">
  <iframe
    src="https://www.youtube.com/embed/{videoKey}?rel=0&modestbranding=1"
    title={name}
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
  ></iframe>
</div>

<style lang="scss">
  .trailer-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: $radius-md;
    overflow: hidden;
    background: $color-bg-secondary;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: box-shadow $dur-normal $ease-out-expo;

    &:hover {
      box-shadow:
        0 0 0 2px $color-primary,
        0 8px 32px rgba(0, 0, 0, 0.5);
    }

    iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
    }
  }
</style>
