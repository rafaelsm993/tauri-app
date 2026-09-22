# Run TauriFlix natively on the Arch desktop, keeping the WSL → Windows laptop flow working

> For Hermes: execute task-by-task. **The user makes every commit. NEVER run `git add`, `git commit`, `git push` or `git reset`, and never create branches.** "Checkpoint" means stop, report, and let the user commit. Commands that need `sudo`, or that touch secrets (`.env`), are run BY THE USER: print the exact command, wait, then verify.

Goal: on the Arch desktop the project runs with plain `npm run tauri dev`. On the Windows laptop it keeps running through `./scripts/wdev.sh` from WSL. One toolchain test (`scripts/verify-toolchain.test.mjs`) checks whichever machine it runs on.

Revision 2 (2026-09-22). The user wants no wrapper on Linux. The earlier `scripts/run.sh` launcher and its test are dropped.

---

## Current context (verified read-only on the Arch desktop, 2026-09-22)

The working tree is clean at `2066edf Docs`, which already includes the docs migration and the plan files.

### Laptop workflow (committed; must keep working and must not change)
- The laptop runs Windows 11. Code is edited inside WSL on an NTFS drive (`/mnt/<drive>/...`), and built and run by the Windows toolchain: MSVC, Rust `x86_64-pc-windows-msvc`, Windows Node 22 and WebView2.
- `scripts/wdev.sh` (WSL) checks for a `/mnt/[a-z]/` path, then runs `powershell.exe ... .\scripts\dev.ps1`, or `build.ps1` with the `build` argument.
- `scripts/dev.ps1`, `build.ps1` and `verify.ps1` each load `vcvars64.bat`, put cargo and node on PATH, and then run, respectively:
  - `npm run tauri dev`
  - `tauri.js build --bundles msi,nsis`
  - `node --test scripts\verify-toolchain.test.mjs`
- `scripts/verify-toolchain.test.mjs` has 8 tests and currently assumes Windows: MSVC `rustc` host, `where link.exe`, the WebView2 directory, `.env` keys, Cargo profiles, launcher files, and runbook regexes for `x86_64-pc-windows-msvc` and `WSLg`.
- `src-tauri/.cargo/config.toml`: `target-dir = "target"`; `[target.x86_64-pc-windows-msvc]` rustflags `/INCREMENTAL`. That section applies only to the MSVC target, so the Linux build ignores it.
- `src-tauri/build.rs` bakes the keys from `../.env` into the binary with `cargo:rustc-env`. `tmdb.rs` and `rawg.rs` use `env!(...)`. **Without `.env`, the Rust crate does not compile.**

### This machine (Arch/CachyOS desktop)
- Repo: `/mnt/FILES/Projects/tauri-app` on btrfs (a native Linux path). Wayland session, AMD RX 9070 plus a Raphael iGPU.
- Present:
  - node v22.23.1 and npm (mise)
  - pkg-config
  - `webkit2gtk-4.1` 2.52.6, `javascriptcoregtk-4.1`, `libsoup-3.0`, `gtk+-3.0`, `openssl`
  - `base-devel`, `librsvg`, `libappindicator`, `curl`, `wget`, `file`
- Missing:
  - `cargo`, `rustc` and `rustup` (the `rustup` package exists in the `extra` repo; `rust` is not installed, so there is no conflict)
  - `.env`, `node_modules/`, `src-tauri/target/`
- `package-lock.json` already lists the Linux optional binaries (`@tauri-apps/cli-linux-x64-gnu`, `@rollup/rollup-linux-x64-gnu`, `@esbuild/linux-x64`). `npm ci` therefore needs no lockfile change.
- `.gitignore` ignores `.env*` except `!.env.example`, and no `.env.example` exists yet.
- There is no `.gitattributes`. Git for Windows with `autocrlf=true` could check out `wdev.sh` with CRLF endings, which breaks its shebang.
- The shell is **fish**: to set a one-off variable, use `env VAR=val cmd`, never `export`.
- Tests are run as `node --test scripts/<file>.test.mjs` from the repo root. Baseline: `no-auth` 7 plus `docs-notes` 6 = 13 passing.

## Approach

- **No new scripts.** On Linux, the stock `npm run tauri dev` and `npm run tauri build` already work once Rust, `.env` and `node_modules` are in place. Nothing needs wrapping.
- **Laptop scripts unchanged.** The PowerShell and WSL scripts stay exactly as they are.
- **Platform-aware toolchain test.** Checks that apply to both machines always run. Windows checks carry `skip: process.platform !== "win32"`, and new Linux checks (Rust linux-gnu host, WebKitGTK via pkg-config) carry `skip: process.platform !== "linux"`. The laptop still runs the test through `verify.ps1`; the desktop runs it directly.
- **Docs.** The runbook gets a "Linux native" section.

## Files

| Action | Path |
| --- | --- |
| Create | `.env.example`, `.gitattributes` |
| Modify | `scripts/verify-toolchain.test.mjs`, `docs/BUILD_AND_RUN.md`, `README.md`, `docs/notes/Config and Stack.md`, `src-tauri/.cargo/config.toml` (comment only) |
| Untouched | `scripts/wdev.sh`, `scripts/dev.ps1`, `scripts/build.ps1`, `scripts/verify.ps1`, `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, all app source |

---

## Task 0: Baseline

```
cd /mnt/FILES/Projects/tauri-app
git status --short
node --test scripts/no-auth.test.mjs scripts/docs-notes.test.mjs 2>&1 | grep -E '^# (pass|fail)'
```
Expected: empty status, then `# pass 13`, `# fail 0`.

## Task 1: Make the toolchain test platform-aware (RED on this machine)

Replace `scripts/verify-toolchain.test.mjs` entirely:

```js
// scripts/verify-toolchain.test.mjs
// Verifies the build prerequisites for TauriFlix on whichever machine runs it.
//   Windows laptop:  PS> powershell -ExecutionPolicy Bypass -File scripts\verify.ps1
//   Arch desktop:    $ node --test scripts/verify-toolchain.test.mjs
// Windows-only checks are skipped on Linux and vice versa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(repoRoot, p), "utf8");
const has = (p) => existsSync(join(repoRoot, p));
const WIN = process.platform === "win32";
const LINUX = process.platform === "linux";

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

// ── Both machines ─────────────────────────────────────────
test("cargo is reachable and reports a stable version", () => {
  const out = run("cargo", ["--version"]);
  assert.match(out, /^cargo \d+\.\d+\.\d+/, `unexpected cargo version line: ${out}`);
});

test(".env supplies the compile-time API keys build.rs expects", () => {
  assert.ok(has(".env"), ".env is missing at the repo root (copy .env.example)");
  const env = read(".env");
  for (const key of ["TMDB_API_KEY", "RAWG_API_KEY"]) {
    assert.match(env, new RegExp(`^${key}=.+$`, "m"), `.env has no non-empty ${key}`);
  }
});

test("the Tauri CLI native binary for this platform is installed", () => {
  const pkg = WIN ? "@tauri-apps/cli-win32-x64-msvc" : "@tauri-apps/cli-linux-x64-gnu";
  assert.ok(has(`node_modules/${pkg}`), `node_modules/${pkg} missing — install dependencies on this machine`);
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

test("the build/run runbook covers both machines", () => {
  assert.ok(has("docs/BUILD_AND_RUN.md"), "docs/BUILD_AND_RUN.md is missing");
  const doc = read("docs/BUILD_AND_RUN.md");
  assert.match(doc, /x86_64-pc-windows-msvc/, "runbook does not name the MSVC target");
  assert.match(doc, /WSLg/, "runbook does not discuss the WSLg fallback");
  assert.match(doc, /## Linux native/, "runbook has no Linux-native section");
});

// ── Windows laptop only ───────────────────────────────────
test("the active rust toolchain targets x86_64-pc-windows-msvc", { skip: !WIN }, () => {
  const out = run("rustc", ["-vV"]);
  assert.match(out, /host: x86_64-pc-windows-msvc/, `rustc is not MSVC-hosted:\n${out}`);
});

test("the MSVC linker is on PATH", { skip: !WIN }, () => {
  const out = run("cmd", ["/c", "where", "link.exe"]);
  assert.match(out, /link\.exe/i, `link.exe not found on PATH:\n${out}`);
});

test("a WebView2 runtime is installed", { skip: !WIN }, () => {
  const base = "C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application";
  assert.ok(existsSync(base), `WebView2 runtime directory missing: ${base}`);
});

// ── Arch desktop (native Linux) only ──────────────────────
test("the active rust toolchain targets x86_64-unknown-linux-gnu", { skip: !LINUX }, () => {
  const out = run("rustc", ["-vV"]);
  assert.match(out, /host: x86_64-unknown-linux-gnu/, `rustc is not linux-gnu-hosted:\n${out}`);
});

test("WebKitGTK 4.1 stack is visible to pkg-config", { skip: !LINUX }, () => {
  for (const mod of ["webkit2gtk-4.1", "javascriptcoregtk-4.1", "libsoup-3.0", "gtk+-3.0"]) {
    assert.doesNotThrow(() => run("pkg-config", ["--exists", mod]), `pkg-config cannot find ${mod}`);
  }
});
```

Run:
```
node --test scripts/verify-toolchain.test.mjs 2>&1 | grep -E '^(not )?ok|^# (pass|fail|skipped)'
```
Expected RED, with 11 tests:
- `not ok`: cargo, `.env`, Tauri CLI binary, runbook, linux-gnu host (5 tests)
- `ok`: cargo profile, Windows launcher scripts, WebKitGTK (3 tests)
- `# skipped 3` (the Windows checks)

The tasks below turn the 5 failures green.

## Task 2: `.env.example` and LF guard for shell scripts

Create `.env.example`:
```
# Copy to .env (never commit .env). src-tauri/build.rs bakes these into the
# Rust binary at compile time; both must be non-empty or the crate won't build.
TMDB_API_KEY=
RAWG_API_KEY=
```

Create `.gitattributes`:
```
*.sh text eol=lf
```

Verify:
```
git check-ignore -q .env.example || echo NOT_IGNORED
git check-attr eol scripts/wdev.sh
```
Expected: `NOT_IGNORED`, then `scripts/wdev.sh: eol: lf`.

## Task 3: Install Rust (USER runs; needs sudo)

Tell the user:
```
sudo pacman -S --needed rustup
rustup default stable
```
Verify:
```
rustc -vV | grep host
cargo --version
```
Expected: `host: x86_64-unknown-linux-gnu` and `cargo 1.x.y (...)`.

## Task 4: `.env` on the desktop (USER does it; secret)

The agent never reads, prints or writes key values. The user copies the laptop's repo-root `.env` over a private channel, or runs `cp .env.example .env` and pastes the keys in.

Verify without printing values:
```
grep -cE '^(TMDB_API_KEY|RAWG_API_KEY)=.+' .env
git check-ignore -q .env && echo IGNORED
```
Expected: `2`, then `IGNORED`.

## Task 5: Install JS dependencies

Run: `npm ci`. It must end with `added N packages`. Then run `git status --short package-lock.json`, which must print nothing. Use `npm ci`, not `npm install`, so the lockfile shared with the laptop never changes.

Verify: `ls node_modules/@tauri-apps/cli-linux-x64-gnu/package.json` prints the path.

## Task 6: First Rust compile (slow once)

```
cd src-tauri; cargo check --locked; cd ..
```
Expected: `Finished \`dev\` profile ...`. The first run takes several minutes because dependencies build at `opt-level = 3`. If it fails with `environment variable TMDB_API_KEY not defined at compile time`, redo Task 4.

Then:
```
node --test scripts/verify-toolchain.test.mjs 2>&1 | grep -E '^not ok|^# (pass|fail|skipped)'
```
Expected: only `not ok ... runbook covers both machines` remains, with `# pass 7`, `# fail 1`, `# skipped 3`.

## Task 7: Run the app natively (manual smoke test)

Run: `npm run tauri dev`
Expected in the terminal: Vite reports `ready` on `http://localhost:1420/`, then `Running \`target/debug/tauri-app\``.

Check by hand:
1. A native window titled `tauri-app` opens with the dark red UI.
2. Movies shows genre carousels with posters (the TMDB key is baked in).
3. Jogos loads (RAWG key); Anime and Livros load (these APIs need no key).
4. Clicking a card opens the detail page, and "← Voltar" returns.
5. An edit in `src/routes/+page.svelte` hot-reloads. Revert it afterwards.
6. `Ctrl+C` stops both Vite and the app.

If the window is blank or white, or the log shows `DMABUF`/`GBM` errors (a WebKitGTK issue on Wayland with AMD), retry with:
```
env WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri dev
```
Record the result for the troubleshooting row in Task 8. Do not bake the variable into `package.json` or the config.

## Task 8: Runbook (`docs/BUILD_AND_RUN.md`)

1. Replace lines 1–10 (the H1 through "One shared NTFS working tree, no sync step.") with:

````markdown
# Building and running TauriFlix

| Machine | Run (hot reload) | Release | Toolchain check |
| --- | --- | --- | --- |
| Arch desktop (native Linux) | `npm run tauri dev` | `npm run tauri build -- --no-bundle` | `node --test scripts/verify-toolchain.test.mjs` |
| Windows 11 laptop (edit in WSL) | `./scripts/wdev.sh` | `./scripts/wdev.sh build` | `PS> powershell -ExecutionPolicy Bypass -File scripts\verify.ps1` |

`src-tauri/target/`, `node_modules/` and `.env` belong to each machine. They are never shared or committed.

## Linux native (Arch desktop)

One-time setup:

```
sudo pacman -S --needed rustup webkit2gtk-4.1 libsoup3 base-devel openssl librsvg
rustup default stable
cp .env.example .env        # then fill in TMDB_API_KEY and RAWG_API_KEY
npm ci                      # not `npm install`: keeps the shared lockfile unchanged
node --test scripts/verify-toolchain.test.mjs   # expect: # pass 8, # skipped 3
```

- `npm run tauri build -- --no-bundle` produces `src-tauri/target/release/tauri-app`. No .deb or AppImage is built; run the binary directly.
- On Wayland, if the window is blank or white, run `env WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri dev`. As a last resort, also add `GDK_BACKEND=x11`.

## Windows laptop (WSL → Windows)

Edit code in WSL. Build and run on Windows. One shared NTFS working tree, no sync step.
````

   The old line `WSL$ ./scripts/wdev.sh ...` from the TL;DR now lives in the table. The existing sections from "Why Windows-native and not WSL-native" onward stay unchanged, including the `x86_64-pc-windows-msvc` and `WSLg` text that the test matches.

2. In "Troubleshooting", append three rows:
```
| `bad interpreter: /usr/bin/env: 'bash\r'`    | script checked out with CRLF | `.gitattributes` forces LF; re-checkout: `git checkout -- scripts/wdev.sh` |
| Blank/white window on Arch (Wayland)         | WebKitGTK DMA-BUF renderer   | `env WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri dev` |
| `TMDB_API_KEY not defined at compile time`   | no `.env` on this machine    | `cp .env.example .env`, fill in the keys, rebuild |
```

3. Replace lines 1–3 of `src-tauri/.cargo/config.toml` with:
```
# src-tauri/.cargo/config.toml
# Build settings shared by both machines (see docs/BUILD_AND_RUN.md).
# The MSVC-only flags below are target-scoped and ignored by the Linux build.
```

Verify:
```
node --test scripts/verify-toolchain.test.mjs 2>&1 | grep -E '^# (pass|fail|skipped)'
```
Expected: `# pass 8`, `# fail 0`, `# skipped 3`.

## Task 9: README and notes pointers

- In `README.md`, "Getting Started": replace the block from `npm install` to `npm run tauri dev` with:
  ```
  cp .env.example .env   # fill in TMDB_API_KEY and RAWG_API_KEY
  npm ci
  npm run tauri dev      # Arch desktop; on the Windows laptop use ./scripts/wdev.sh from WSL
  ```
  Also update the "Environment Variables" paragraph: change "Set these in a project-root `.env`" to "Copy `.env.example` to `.env` at the project root and fill these in".
- In `docs/notes/Config and Stack.md` §7, remove the sentence fragment "(gitignored; there is no `.env.example` yet)" and write "(gitignored; template: `.env.example`)".
- In `docs/notes/Config and Stack.md` §8, "Linux native" Arch bullet: change the package list to `rustup webkit2gtk-4.1 libsoup3 base-devel openssl librsvg`, which drops `patchelf` (only AppImage bundling needs it). Append: "Setup and troubleshooting: [BUILD_AND_RUN.md](../BUILD_AND_RUN.md)."

Verify: `node --test scripts/docs-notes.test.mjs 2>&1 | grep -E '^# (pass|fail)'` → `# pass 6`, `# fail 0`.

## Task 10: Release build on the desktop

```
npm run tauri build -- --no-bundle
ls -lh src-tauri/target/release/tauri-app
./src-tauri/target/release/tauri-app
```
Expected:
- the build ends with `Finished \`release\` profile` and no `Bundling` lines
- the binary is roughly 10–20 MB
- the app opens and Movies load with no Vite running, which proves the frontend is embedded

The laptop's "npm shim mangles `--bundles`" problem is specific to Windows `.cmd` shims and does not happen on Linux. If `--no-bundle` still reaches cargo here, use `npx tauri build --no-bundle` and note it in the runbook.

## Task 11: Full desktop verification

```
node --test scripts/verify-toolchain.test.mjs scripts/no-auth.test.mjs scripts/docs-notes.test.mjs 2>&1 | grep -E '^# (pass|fail|skipped)'
npm run check 2>&1 | tail -1
npm run build 2>&1 | tail -2
git status --short
```
Expected:
- tests: `# pass 21` (8 + 7 + 6), `# fail 0`, `# skipped 3`
- `svelte-check found 0 errors and 0 warnings`
- `✓ built` / `Wrote site to "build"`
- git status shows only:
  - `M README.md`, `M docs/BUILD_AND_RUN.md`, `M docs/notes/Config and Stack.md`
  - `M scripts/verify-toolchain.test.mjs`, `M src-tauri/.cargo/config.toml`
  - `?? .env.example`, `?? .gitattributes`

  There must be no `package-lock.json` change and no `.env`.

## Checkpoint

Stop and report to the user. Do NOT commit. A message the user may use: `chore(build): native Arch workflow alongside the WSL → Windows flow`.

## Task 12: Laptop check (user, next time on Windows; can't be done from here)

After pulling inside WSL:
1. `git check-attr eol scripts/wdev.sh` → `eol: lf`.
2. `PS> powershell -ExecutionPolicy Bypass -File scripts\verify.ps1` → `# pass 9`, `# skipped 2`, `# fail 0`.
3. `./scripts/wdev.sh` opens the app as before, and `./scripts/wdev.sh build` produces MSI and NSIS installers.
4. Keep the laptop rule: install dependencies from Windows (`PS> npm install`), never `npm ci` from WSL.

---

## Risks, tradeoffs, open questions

- **Wayland + dual AMD GPU:** the most likely first-run failure is a blank webview. The fix is a documented environment variable, not a code change. `DRI_PRIME=1` may matter if the webview lands on the iGPU; that is untested.
- **Shared lockfile:** `npm ci` on Arch never rewrites it. A deliberate `npm install <pkg>` on either machine is fine, because npm records optional binaries for all platforms.
- **No Linux package:** `--no-bundle` is intentional. A `PKGBUILD` or AppImage would be separate work.
- **Keys compiled in:** each machine needs its own `.env`, and a changed key means a rebuild.
- **Known debt, out of scope:** the three PowerShell scripts still duplicate the vcvars block, and four tracked files have CRLF endings. `.gitattributes` pins only `*.sh` so unrelated files don't get renormalised.
