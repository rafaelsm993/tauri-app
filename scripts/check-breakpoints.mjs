// Fails if a component uses a raw-px @media query instead of the $bp-* tokens / mixins.
// global.css is plain CSS (no SCSS vars) and is exempt; keep its values equal to the tokens.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAW = /@media[^{]*\b\d+px/;
const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".svelte") ? [p] : [];
  });

const hits = walk("src").flatMap((file) =>
  readFileSync(file, "utf8")
    .split("\n")
    .flatMap((line, i) => (RAW.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
);
if (hits.length) {
  console.error(
    "Raw px breakpoints — use @include respond-to(sm|md|lg|xl|2xl):\n" + hits.join("\n"),
  );
  process.exit(1);
}
console.log("breakpoints ok");
