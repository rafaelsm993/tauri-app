<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let alive = false;
  let W = 0;
  let H = 0;

  let mx = 0, my = 0;
  let tx = 0, ty = 0;
  let px = 0, py = 0;
  let speed = 0;
  let moving = false;
  let moveTimer: ReturnType<typeof setTimeout>;

  const MAX_P = 60;
  const particles: { x: number; y: number; vx: number; vy: number; life: number; ml: number; s: number; hue: number; on: boolean }[] = [];
  for (let i = 0; i < MAX_P; i++) {
    particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, ml: 1, s: 1, hue: 42, on: false });
  }

  const MAX_R = 3;
  const ripples: { x: number; y: number; r: number; mr: number; life: number; on: boolean }[] = [];
  for (let i = 0; i < MAX_R; i++) {
    ripples.push({ x: 0, y: 0, r: 0, mr: 120, life: 0, on: false });
  }

  function emitParticle(x: number, y: number) {
    for (const p of particles) {
      if (!p.on) {
        const a = Math.random() * 6.283;
        const v = Math.random() * 1.2 + 0.3;
        p.x = x; p.y = y;
        p.vx = Math.cos(a) * v;
        p.vy = Math.sin(a) * v - 0.15;
        p.life = 1; p.ml = 45 + Math.random() * 45;
        p.s = Math.random() * 2 + 0.5;
        p.hue = [42, 170, 16][Math.floor(Math.random() * 3)];
        p.on = true;
        return;
      }
    }
  }

  function emitRipple(x: number, y: number) {
    for (const r of ripples) {
      if (!r.on) { r.x = x; r.y = y; r.r = 0; r.mr = 120; r.life = 1; r.on = true; return; }
    }
  }

  function resize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    if (!alive || !ctx) return;

    const dvx = tx - px, dvy = ty - py;
    speed = Math.sqrt(dvx * dvx + dvy * dvy);
    px = tx; py = ty;

    const ease = moving ? 0.08 : 0.03;
    mx += (tx - mx) * ease;
    my += (ty - my) * ease;

    ctx.clearRect(0, 0, W, H);

    // Mouse spotlight — strong enough to be clearly visible
    const spotR = 320 + Math.min(speed * 3, 160);
    const spotA = 0.25 + Math.min(speed * 0.008, 0.15);
    const sg = ctx.createRadialGradient(mx, my, 0, mx, my, spotR);
    sg.addColorStop(0, `rgba(232,184,75,${spotA.toFixed(3)})`);
    sg.addColorStop(0.35, `rgba(232,184,75,${(spotA * 0.3).toFixed(3)})`);
    sg.addColorStop(1, 'rgba(232,184,75,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H);

    // Secondary teal halo offset from cursor
    const tealA = 0.12 + Math.min(speed * 0.004, 0.08);
    const tg = ctx.createRadialGradient(mx + 40, my + 30, 0, mx + 40, my + 30, spotR * 0.7);
    tg.addColorStop(0, `rgba(61,217,196,${tealA.toFixed(3)})`);
    tg.addColorStop(0.4, `rgba(61,217,196,${(tealA * 0.2).toFixed(3)})`);
    tg.addColorStop(1, 'rgba(61,217,196,0)');
    ctx.fillStyle = tg;
    ctx.fillRect(0, 0, W, H);

    // Particles
    for (const p of particles) {
      if (!p.on) continue;
      p.x += p.vx; p.y += p.vy;
      p.vy -= 0.01; p.vx *= 0.98;
      p.life -= 1 / p.ml;
      if (p.life <= 0) { p.on = false; continue; }
      const r = p.s * p.life;
      if (r < 0.2) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, 6.283);
      ctx.fillStyle = `hsla(${p.hue},75%,62%,${(p.life * 0.6).toFixed(2)})`;
      ctx.fill();
    }

    // Ripples
    for (const rp of ripples) {
      if (!rp.on) continue;
      rp.r += (rp.mr - rp.r) * 0.06;
      rp.life -= 0.02;
      if (rp.life <= 0) { rp.on = false; continue; }
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, 6.283);
      ctx.strokeStyle = `rgba(232,184,75,${(rp.life * 0.4).toFixed(2)})`;
      ctx.lineWidth = 1.5 * rp.life;
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }

  function onMove(e: MouseEvent) {
    tx = e.clientX; ty = e.clientY;
    moving = true;
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => { moving = false; }, 180);
    if (speed > 12 && Math.random() < 0.25) emitParticle(e.clientX, e.clientY);
  }

  function onClick(e: MouseEvent) {
    for (let i = 0; i < 8; i++) emitParticle(e.clientX, e.clientY);
    emitRipple(e.clientX, e.clientY);
  }

  onMount(() => {
    alive = true;
    mx = tx = px = window.innerWidth / 2;
    my = ty = py = window.innerHeight / 2;
    ctx = canvas.getContext('2d');
    console.log('[bg] mount — canvas:', canvas.offsetWidth, 'x', canvas.offsetHeight, 'ctx:', !!ctx, 'dpr:', window.devicePixelRatio);
    resize();
    requestAnimationFrame(draw);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('click', onClick);
    window.addEventListener('resize', resize);
  });

  onDestroy(() => {
    alive = false;
    clearTimeout(moveTimer);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('click', onClick);
    window.removeEventListener('resize', resize);
  });
</script>

<div class="bg-layer" aria-hidden="true">
  <div class="bg-orb bg-orb-1"></div>
  <div class="bg-orb bg-orb-2"></div>
  <div class="bg-orb bg-orb-3"></div>
  <canvas bind:this={canvas} class="bg-canvas"></canvas>
  <div class="bg-vignette"></div>
</div>
