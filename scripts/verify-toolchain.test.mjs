// scripts/verify-toolchain.test.mjs
// Verifies the Windows-native build prerequisites for TauriFlix.
// Run from the repo root with the WINDOWS node:
//   PS> node scripts\verify-toolchain.test.mjs
// or from WSL:
//   WSL$ '/mnt/c/Program Files/nodejs/node.exe' scripts/verify-toolchain.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(repoRoot, p), "utf8");
const has = (p) => existsSync(join(repoRoot, p));

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

test("cargo is reachable and reports a stable version", () => {
  const out = run("cargo", ["--version"]);
  assert.match(out, /^cargo \d+\.\d+\.\d+/, `unexpected cargo version line: ${out}`);
});

test("the active rust toolchain targets x86_64-pc-windows-msvc", () => {
  const out = run("rustc", ["-vV"]);
  assert.match(out, /host: x86_64-pc-windows-msvc/, `rustc is not MSVC-hosted:\n${out}`);
});

test("the MSVC linker is on PATH", () => {
  const out = run("cmd", ["/c", "where", "link.exe"]);
  assert.match(out, /link\.exe/i, `link.exe not found on PATH:\n${out}`);
});

test("a WebView2 runtime is installed", () => {
  const base = "C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application";
  assert.ok(existsSync(base), `WebView2 runtime directory missing: ${base}`);
});

test(".env supplies the compile-time API keys build.rs expects", () => {
  assert.ok(has(".env"), ".env is missing at the repo root");
  const env = read(".env");
  for (const key of ["TMDB_API_KEY", "RAWG_API_KEY"]) {
    assert.match(env, new RegExp(`^${key}=.+$`, "m"), `.env has no non-empty ${key}`);
  }
});

test("cargo dev profile is tuned for fast links and smooth runtime", () => {
  assert.ok(has("src-tauri/.cargo/config.toml"), "src-tauri/.cargo/config.toml is missing");
  const cargoToml = read("src-tauri/Cargo.toml");
  assert.match(cargoToml, /\[profile\.dev\]/, "Cargo.toml has no [profile.dev] section");
  assert.match(
    cargoToml,
    /\[profile\.dev\.package\."\*"\]\s*\nopt-level = 3/,
    "dependencies are not optimised in the dev profile (causes UI stutter)",
  );
  assert.match(cargoToml, /\[profile\.release\]/, "Cargo.toml has no [profile.release] section");
});

test("the Windows launcher scripts exist", () => {
  for (const f of ["scripts/dev.ps1", "scripts/build.ps1", "scripts/wdev.sh"]) {
    assert.ok(has(f), `${f} is missing`);
  }
});

test("the build/run runbook is documented", () => {
  assert.ok(has("docs/BUILD_AND_RUN.md"), "docs/BUILD_AND_RUN.md is missing");
  const doc = read("docs/BUILD_AND_RUN.md");
  assert.match(doc, /x86_64-pc-windows-msvc/, "runbook does not name the MSVC target");
  assert.match(doc, /WSLg/, "runbook does not discuss the WSLg fallback");
});
