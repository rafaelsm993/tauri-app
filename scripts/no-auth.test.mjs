// scripts/no-auth.test.mjs
// Structural guard: the app must contain only Home + Detail, with no
// account, login, or watchlist code in either stack.
// Run from the repo root:  node --test scripts/no-auth.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), "utf8");

function walk(dir, out = []) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs)) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

const DELETED_FILES = [
  "src/routes/auth/+page.svelte",
  "src/routes/watchlist/+page.svelte",
  "src/lib/api/auth.ts",
  "src/lib/api/cloud.ts",
  "src/lib/api/watchlist.ts",
  "src/lib/stores/user.svelte.ts",
  "src/lib/stores/watchlist.svelte.ts",
  "src/lib/components/ui/UserButton.svelte",
  "src/lib/components/ui/WatchlistButton.svelte",
  "src-tauri/src/api/auth.rs",
  "src-tauri/src/api/watchlist.rs",
  "src-tauri/tauriflix.db",
];

test("deleted files are gone", () => {
  for (const f of DELETED_FILES) {
    assert.equal(existsSync(join(root, f)), false, `${f} should be deleted`);
  }
});

test("only home and detail routes remain", () => {
  const routes = walk("src/routes").sort();
  assert.deepEqual(routes, [
    "src/routes/+layout.svelte",
    "src/routes/+layout.ts",
    "src/routes/+page.svelte",
    "src/routes/media/[type]/[id]/+page.svelte",
  ]);
});

test("no auth or watchlist symbols in frontend source", () => {
  const banned = [
    "userStore",
    "AuthAPI",
    "CloudAPI",
    "WatchlistAPI",
    "watchlistStore",
    "UserButton",
    "WatchlistButton",
    "VITE_CLOUD_API_URL",
  ];
  for (const file of walk("src")) {
    const body = read(file);
    for (const symbol of banned) {
      assert.ok(!body.includes(symbol), `${file} still references ${symbol}`);
    }
  }
});

test("rust registers only media proxy commands", () => {
  const lib = read("src-tauri/src/lib.rs");
  for (const symbol of ["auth_", "watchlist", "DbConn", "greet", "rusqlite"]) {
    assert.ok(!lib.includes(symbol), `lib.rs still references ${symbol}`);
  }
});

test("rusqlite dependency is removed", () => {
  assert.ok(!read("src-tauri/Cargo.toml").includes("rusqlite"));
});

test("api module registry lists only providers", () => {
  const mod = read("src-tauri/src/api/mod.rs").trim().split("\n").sort();
  assert.deepEqual(mod, ["pub mod anilist;", "pub mod itunes;", "pub mod rawg;", "pub mod tmdb;"]);
});

test("User and WatchlistStatus types are gone from media.ts", () => {
  const types = read("src/lib/types/media.ts");
  assert.ok(!types.includes("interface User"));
  assert.ok(!types.includes("WatchlistStatus"));
});
