<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let animFrame: number;
  let alive = false;   // guards against orphaned rAF loops after HMR


  // Mouse — safe defaults, set in onMount
  let mx = 0, my = 0;           // smoothed position
  let tx = 0, ty = 0;           // target (raw mouse)
  let pvx = 0, pvy = 0;         // previous target (for velocity)
  let speed = 0;
  let moveTO: ReturnType<typeof setTimeout>;
  let moving = false;

  // Particles & ripples
  interface P { x:number; y:number; vx:number; vy:number; life:number; ml:number; s:number; h:number }
  interface R { x:number; y:number; r:number; mr:number; life:number }
  let pts: P[] = [];
  let rps: R[] = [];

  let W = 0, H = 0;

  function resize() {
    if (!canvas) return;
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function addParticles(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 1.4 + 0.3;
      pts.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 0.2,
        life: 1, ml: 55 + Math.random()*70, s: Math.random()*2.5+0.6,
        h: [42,42,20,170][Math.floor(Math.random()*4)] });
    }
    if (pts.length > 160) pts.splice(0, pts.length - 160);
  }

  function draw() {
    if (!ctx) return;

    // velocity
    const dvx = tx - pvx, dvy = ty - pvy;
    speed = Math.sqrt(dvx*dvx + dvy*dvy);
    pvx = tx; pvy = ty;

    // smooth mouse
    const ease = moving ? 0.09 : 0.04;
    mx += (tx - mx) * ease;
    my += (ty - my) * ease;

    // single clear
    ctx.clearRect(0, 0, W, H);

    // ── Spotlight — one gradient, one fillRect ──
    const r = 300 + Math.min(speed * 3, 120);
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, r);
    g.addColorStop(0,   `rgba(232,184,75,${(0.08 + Math.min(speed*0.003, 0.06)).toFixed(3)})`);
    g.addColorStop(0.5, 'rgba(232,184,75,0.025)');
    g.addColorStop(1,   'rgba(232,184,75,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // ── Particles ──
    pts = pts.filter(p => p.life > 0);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      p.vy -= 0.012; p.vx *= 0.98;
      p.life -= 1 / p.ml;
      const rad = Math.max(0.1, p.s * p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI*2);
      ctx.fillStyle = `hsla(${p.h},80%,65%,${(p.life*0.7).toFixed(3)})`;
      ctx.fill();
    }

    // ── Ripples ──
    rps = rps.filter(r => r.life > 0);
    for (const r of rps) {
      r.r   += (r.mr - r.r) * 0.07;
      r.life -= 0.016;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(232,184,75,${(r.life*0.5).toFixed(3)})`;
      ctx.lineWidth = 2 * r.life;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * 0.5, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(61,217,196,${(r.life*0.28).toFixed(3)})`;
      ctx.lineWidth = 1.2 * r.life;
      ctx.stroke();
    }

    if (alive) animFrame = requestAnimationFrame(draw);
  }

  function onMove(e: MouseEvent) {
    tx = e.clientX; ty = e.clientY;
    moving = true;
    clearTimeout(moveTO);
    moveTO = setTimeout(() => (moving = false), 180);
    if (speed > 14 && Math.random() < 0.25) addParticles(e.clientX, e.clientY, 2);
  }

  function onClick(e: MouseEvent) {
    addParticles(e.clientX, e.clientY, 16);
    rps.push({ x: e.clientX, y: e.clientY, r: 0, mr: 160, life: 1 });
  }

  onMount(() => {
    alive = true;
    mx = tx = pvx = window.innerWidth  / 2;
    my = ty = pvy = window.innerHeight / 2;
    ctx = canvas.getContext('2d')!;
    resize();
    draw();
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('click',     onClick);
    window.addEventListener('resize',    resize);
  });

  onDestroy(() => {
    alive = true;
    cancelAnimationFrame(animFrame);
    clearTimeout(moveTO);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('click',     onClick);
    window.removeEventListener('resize',    resize);
  });
</script>

<canvas bind:this={canvas} id="bg-canvas"></canvas>
<div class="bg-orb bg-orb-1" aria-hidden="true"></div>
<div class="bg-orb bg-orb-2" aria-hidden="true"></div>
<div class="bg-orb bg-orb-3" aria-hidden="true"></div>
<div class="bg-orb bg-orb-4" aria-hidden="true"></div>
<div class="bg-vignette"     aria-hidden="true"></div>