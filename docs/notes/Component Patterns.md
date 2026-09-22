# TauriFlix — Component Patterns

> Conventions for the reusable UI components, with a reference entry for each.

All components use Svelte 5 syntax:

- `<script lang="ts">` with `$props`, `$state`, `$derived`, `$effect`
- `<style lang="scss">`: variables and mixins are injected automatically, so never add `@use` or `@import`
- Event attributes (`onclick`, `onsubmit`, `onscroll`), not `on:click`
- Snippets: `{#snippet Name()}…{/snippet}` + `{@render Name()}`
- Callback props (`onchange`, `onSearch`, `onCardClick`) instead of dispatched events

---

## MediaCard

- File: `src/lib/components/media/MediaCard.svelte`
- Props: `item: MediaItem`, `onclick?: () => void`

A poster card rendered as a single `<button>`. It is used in both the grid and the carousels.

- 2:3 poster with `loading="lazy"` and a shimmer while it loads. The poster fades in `onload`.
- Falls back to an icon plus the title when there is no poster or the image fails to load.
- Hover overlay (`aria-hidden`) shows:
  - type badge (`MEDIA_LABELS`) and rating
  - title, author, overview
  - year, eps/caps and review count (formatted with `pt-BR`)
- A static label under the poster shows the title and year.
- Focus: `:focus-visible` draws a `$color-primary` outline on the poster.

## CategoryTabs

- File: `src/lib/components/ui/CategoryTabs.svelte`
- Props: `active: MediaType`, `onchange: (c: MediaType) => void`

A pill tab bar with a fixed list of categories: `movie → Filmes`, `tv → Séries`, `anime → Anime`, `manga → Mangá`, `book → Livros`, `game → Jogos`. The parent owns the active state.

## GenreCarousel

- File: `src/lib/components/ui/GenreCarousel.svelte`

| Prop | Type | Required |
| --- | --- | --- |
| `title` | `string` | ✓ |
| `items` | `MediaItem[]` | ✓ |
| `loading` | `boolean` | — |
| `error` | `string` | — |
| `onCardClick` | `(item: MediaItem) => void` | ✓ |
| `onSeeMore` | `() => void` | — |

A horizontally scrolling rail of `MediaCard`s with scroll-snap.

- Arrow buttons appear when `canScrollLeft` / `canScrollRight` are true. These are `$state` values updated `onscroll` and by an `$effect` after items load. Each click scrolls about 85% of the visible width.
- While loading it shows 8 skeleton cards. Errors and empty results render inline.
- "Ver todos →" appears when `onSeeMore` is passed. The home page wires it to `switchGenre(genre.id)`.

## GenreFilter

- File: `src/lib/components/ui/GenreFilter.svelte`

| Prop | Type | Required |
| --- | --- | --- |
| `genres` | `GenreOption[]` | ✓ |
| `active` | `GenreId \| null` | ✓ |
| `loading` | `boolean` | — |
| `onchange` | `(id: GenreId \| null) => void` | ✓ |

A vertical genre list in the home sidebar.

- The first entry, "Todos", calls `onchange(null)`.
- Loading shows skeleton items.
- It renders nothing when `genres` is empty and nothing is loading.

## SearchBar

- File: `src/lib/components/ui/SearchBar.svelte`
- Props: `placeholder?: string`, `onSearch?: (q: string) => void`

A `<form>` with a search icon, a clear (×) button and focus glow.

- Submitting calls `onSearch(query.trim())`.
- The spinner (1.5s) and success pulse (2s) that follow run on **fixed timers**. They are not tied to the real request.
- Clear only empties the input. It does not call `onSearch`, so the parent keeps the previous results. The home page's "← Descobrir" link is what actually resets search.

## AppBackground

- File: `src/lib/components/ui/AppBackground.svelte`
- Props: none. Rendered once in `+layout.svelte`.

A fixed, `aria-hidden` decorative layer with three parts:

1. `.bg-area`: base colour plus radial glows.
2. `.circles`: 20 `<li>` bubbles animated with CSS `@keyframes`.
3. `.bg-vignette`.

An `$effect` watches `ui.lastClick` and adds `.pulsing` for 900ms. Nothing currently sets `lastClick`, so the pulse never fires in practice. No JavaScript animation loop runs.

---

## Pages

The routes themselves are described in [SvelteKit Special Pages](Front-end/SvelteKit%20Special%20Pages.md).

## Layout (`src/routes/+layout.svelte`)

```svelte
<AppBackground />          <!-- fixed, z-index 0 -->
<div class="app-content">  <!-- z-index 1 -->
  {@render children()}
</div>
```

The layout imports `$lib/styles/global.css`. It has no nav bar and no route guard.
