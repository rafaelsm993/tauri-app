# TauriFlix — Design System

> Tokens and styling rules. The source of truth is `src/lib/styles/variables.scss` (SCSS, compile-time) and the `:root` block of `src/lib/styles/global.css` (CSS custom properties, runtime).

## Philosophy

A dark, cinematic UI modelled on Netflix: a red primary colour, glass surfaces and smooth motion. It uses no UI framework, only CSS tokens and SCSS variables.

> Naming debt: identifiers containing `gold` (`--clr-gold*`, `--glow-gold`, `@mixin glow-gold`) are left over from an earlier gold palette. They now hold the **red** primary values. Use the names, but read them as "primary".

- `<script lang="ts">` — TypeScript for type safety
- `<style lang="scss">` — SCSS with auto-injected variables/mixins (never `@use`/`@import`)
- Reactive globals via Svelte 5 runes (`$state`, `$derived`, `$effect`)
- Animations use CSS transitions and keyframes only (no Canvas).

---

## Color Palette

| Token                                   | Hex                      | Usage                               |
| --------------------------------------- | ------------------------ | ----------------------------------- |
| `$color-bg-primary`                     | `#000000`                | Main background                     |
| `$color-bg-secondary`                   | `#0a0a0a`                | Cards, panels, skeleton             |
| `$color-primary`                        | `#E50914`                | Primary brand — Netflix Red (buttons, accents, glows) |
| `$color-accent`                         | `#B20710`                | Darker red — hover states           |
| `$color-teal`                           | `#46D369`                | Netflix Green — success state (e.g. SearchBar submitted) |
| `$color-text-main`                      | `#F5F5F1`                | Primary text (Cararra)              |
| `$color-text-muted`                     | `#B3B3B3`                | Secondary text                      |
| `$color-text-faint`                     | `#808080`                | Tertiary text, labels               |

The CSS mirrors are `--clr-bg`, `--clr-surface`, `--clr-gold` (= primary red), `--clr-accent`, `--clr-teal` and `--clr-text`/`-2`/`-3`. The status colours are `--clr-success` `#46d369`, `--clr-warning` `#f5b942` and `--clr-error` `#e50914`.

---

## Typography

| Role               | Font       | CSS Variable     | SCSS Variable   |
| ------------------ | ---------- | ---------------- | --------------- |
| Display / Titles   | Bebas Neue | `--font-display` | `$font-display` |
| Body / UI          | DM Sans    | `--font-body`    | `$font-body`    |
| Monospace / Labels | DM Mono    | `--font-mono`    | `$font-mono`    |

### Type Scale (CSS custom properties)

| Token        | Size     | Pixels |
| ------------ | -------- | ------ |
| `--size-2xs` | 0.625rem | 10px   |
| `--size-xs`  | 0.75rem  | 12px   |
| `--size-sm`  | 0.875rem | 14px   |
| `--size-md`  | 1rem     | 16px   |
| `--size-lg`  | 1.125rem | 18px   |
| `--size-xl`  | 1.375rem | 22px   |
| `--size-2xl` | 1.75rem  | 28px   |
| `--size-3xl` | 2.25rem  | 36px   |
| `--size-4xl` | 3rem     | 48px   |
| `--size-5xl` | 4rem     | 64px   |
| `--size-6xl` | 6rem     | 96px   |

Below 768px (`@media (max-width: 768px)`), `global.css` shrinks `--size-6xl` to 4rem, `--size-5xl` to 3rem and `--size-4xl` to 2.5rem.

### Line Height & Letter Spacing

| Token               | Value  |
| ------------------- | ------ |
| `--leading-tight`   | 1.1    |
| `--leading-snug`    | 1.3    |
| `--leading-normal`  | 1.5    |
| `--tracking-wide`   | 0.06em |
| `--tracking-wider`  | 0.12em |
| `--tracking-widest` | 0.2em  |

---

## Spacing

### SCSS Variables (component-scoped)

| Variable       | Value |
| -------------- | ----- |
| `$spacing-xs`  | 4px   |
| `$spacing-sm`  | 8px   |
| `$spacing-md`  | 16px  |
| `$spacing-lg`  | 24px  |
| `$spacing-xl`  | 32px  |
| `$spacing-2xl` | 48px  |

### CSS Custom Properties (global)

`--space-1` (4px) through `--space-32` (128px) — follows 4px base grid.

---

## Border Radius

| Variable / Token                 | Value  |
| -------------------------------- | ------ |
| `$radius-sm` / `--radius-sm`     | 4px    |
| `$radius-md` / `--radius-md`     | 8px    |
| `$radius-lg` / `--radius-lg`     | 14px   |
| `$radius-xl` / `--radius-xl`     | 20px   |
| `--radius-2xl`                   | 32px   |
| `$radius-full` / `--radius-full` | 9999px |

---

## Shadows & Glows

| Token           | Usage                                      |
| --------------- | ------------------------------------------ |
| `--shadow-sm`   | Subtle card shadow                         |
| `--shadow-md`   | Standard elevation                         |
| `--shadow-lg`   | Modals, dropdowns                          |
| `--shadow-xl`   | Hero sections                              |
| `--glow-gold`   | Primary (red) glow — same as `@include glow-gold` |
| `--glow-accent` / `--glow-teal` | Accent / success glows            |

---

## Motion

### Easing Curves

| SCSS Variable    | Curve                               | Character                     |
| ---------------- | ----------------------------------- | ----------------------------- |
| `$ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)`     | Smooth deceleration — primary |
| `$ease-out-back` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Overshoot — playful emphasis  |

### Durations

| SCSS Variable | Value | Usage                               |
| ------------- | ----- | ----------------------------------- |
| `$dur-fast`   | 120ms | Micro-interactions (opacity, color) |
| `$dur-normal` | 220ms | Standard transitions                |
| `$dur-slow`   | 380ms | Cards, overlays                     |
| `$dur-slower` | 600ms | Page-level animations               |

---

## Breakpoints

| SCSS Variable | Value  | Target        |
| ------------- | ------ | ------------- |
| `$bp-sm`      | 480px  | Small phones  |
| `$bp-md`      | 768px  | Tablets       |
| `$bp-lg`      | 1024px | Small laptops |
| `$bp-xl`      | 1280px | Desktops      |
| `$bp-2xl`     | 1440px | Large screens |

Usage: `@include respond-to(md) { ... }` (max-width media query)

---

## Z-Index Stack

| Layer      | Z-Index            | Element                                               |
| ---------- | ------------------ | ----------------------------------------------------- |
| Background | 0                  | `.bg-layer` — CSS bubbles, glows, vignette (`AppBackground`) |
| Content    | 1                  | `.app-content` — all page content                     |
| Film grain | 4                  | `body::before` — noise overlay (pointer-events: none) |
| Base       | `--z-base: 1`      | Default stacking                                      |
| Raised     | `--z-raised: 10`   | Cards on hover                                        |
| Overlay    | `--z-overlay: 100` | Dropdowns, tooltips                                   |
| Modal      | `--z-modal: 200`   | Modal dialogs                                         |
| Toast      | `--z-toast: 300`   | Notifications                                         |

---

## SCSS Mixins

All mixins are auto-injected — use directly in `<style lang="scss">` blocks.

| Mixin                      | Usage                             | What It Does                                          |
| -------------------------- | --------------------------------- | ----------------------------------------------------- |
| `@include glass($blur)`    | `.panel { @include glass; }`      | Frosted glass surface: translucent bg + blur + border |
| `@include card-lift`       | `.card { @include card-lift; }`   | Hover: translateY(-6px) + scale(1.02) + red glow      |
| `@include glow-gold`       | `.badge { @include glow-gold; }`  | Red (primary) box-shadow aura                         |
| `@include truncate`        | `.title { @include truncate; }`   | Single-line ellipsis                                  |
| `@include label-style`     | `.tag { @include label-style; }`  | Uppercase mono label (DM Mono, 0.7rem, `$color-primary`) |
| `@include respond-to($bp)` | `@include respond-to(md) { ... }` | Max-width media query                                 |
| `@include flex-center`     | `.box { @include flex-center; }`  | Centered flexbox                                      |
| `@include flex-between`    | `.row { @include flex-between; }` | Space-between flexbox                                 |
| `@include fill`            | `.overlay { @include fill; }`     | `position: absolute; inset: 0`                        |
| `@include sr-only`         | `.label { @include sr-only; }`    | Visually hidden, accessible                           |

---

## Component Styling Rules

1. **All styles scoped**: Use `<style lang="scss">` in every component
2. **No imports**: NEVER add `@use`, `@import`, or `@forward` — variables/mixins are auto-injected
3. **Tokens only**: Use design system variables — don't hardcode colors, spacing, or fonts
4. **CSS custom properties** for global/runtime values: `var(--clr-gold)` (primary red)
5. **SCSS variables** for component-scoped compile-time values: `$color-primary`
