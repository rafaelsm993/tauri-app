class UIStore {
  // Hue (0-360) of the hovered poster; null restores the default background.
  activeHue = $state<number | null>(null);

  // Particle speed multiplier (1 normal, 3 on click).
  intensity = $state<number>(1);

  // Last global click, drives the canvas shockwave.
  lastClick = $state<{ x: number; y: number; time: number } | null>(null);

  // Switches the background to the detail-page pattern.
  detailMode = $state(false);

  triggerClickPulse(x: number, y: number) {
    this.lastClick = { x, y, time: Date.now() };

    this.intensity = 3;
    setTimeout(() => {
      this.intensity = 1;
    }, 800);
  }

  setHoverHue(hue: number | null) {
    this.activeHue = hue;
  }
}

export const ui = new UIStore();
