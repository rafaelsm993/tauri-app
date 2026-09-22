# Build & Run TauriFlix from WSL Arch on a Windows 11 host, without performance loss

**Plan date:** 2026-09-21
**Repo:** `/mnt/c/Users/rafael.moraes/Code/tauri-app` (Windows path `C:\Users\rafael.moraes\Code\tauri-app`)
**Branch at planning time:** `docs/project-review-2026-09`, clean tree, HEAD `63a044b`
**Related docs:** `docs/PROJECT_REVIEW.md` (feature/architecture review), `.github/agents/tauriflix.agent.md` (code conventions)

---

## Goal

Make `npm run tauri dev` and `npm run tauri build` run the TauriFlix desktop app at native Windows speed and framerate while the developer keeps editing from WSL Arch, by committing to a **Windows-native (MSVC + WebView2) toolchain** driven through documented, repeatable scripts.

---

## Current context / assumptions

Everything below was verified by read-only inspection on 2026-09-21. **Do not re-derive it; do verify it with the Phase 1 tasks before changing anything.**

### Hardware / OS

| Fact | Value |
| --- | --- |
| Host | Windows 11, WSL2 kernel `6.6.87.2-microsoft-standard-WSL2` |
| WSL distro | Arch, user `kanoah`, login shell **fish** |
| CPU threads visible to WSL | 22 |
| RAM visible to WSL | 15 GiB |
| `/mnt/c/Users/rafael.moraes/.wslconfig` | exists, contains only `[wsl2]`, `networkingMode=mirrored`, `hostAddressLoopback=true` |
| `/dev/dri` | **absent** → no GPU passthrough into WSL; WSLg composites over RDP |
| WSLg | present (`/mnt/wslg`, `DISPLAY=:0`, `WAYLAND_DISPLAY=wayland-0`) |

### Toolchains

| Tool | WSL (Linux) | Windows |
| --- | --- | --- |
| node | `/home/kanoah/.local/share/mise/installs/node/24/bin/node` (v24) | `C:\Program Files\nodejs\node.exe` (**v22.15.1**) |
| npm | mise node 24 | `npm.cmd` v22 |
| cargo / rustc | **MISSING** | `C:\Users\rafael.moraes\.cargo\bin\cargo.exe` — cargo 1.93.1, rustc 1.93.1 |
| rustup default host | — | `stable-x86_64-pc-windows-msvc`, only target `x86_64-pc-windows-msvc` |
| MSVC linker | — | VS Build Tools **2019** and **2026** (`C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools`) |
| Windows SDK | — | `10.0.26100.0` (plus older) |
| WebView2 runtime | — | **installed**, `153.0.4234.48` |
| `webkit2gtk-4.1`, `libsoup3` | **NOT installed** | n/a |

### Repo state

- `src-tauri/target/` is **5.6 GB** and already contains a working Windows debug build:
  `src-tauri/target/debug/tauri-app.exe`, 20.6 MB, last linked **2026-06-05 12:58**.
  → The Windows path has demonstrably worked before. This plan restores and hardens it.
- `node_modules/` currently carries **both** platform binaries: `@esbuild/{linux-x64,win32-x64}`,
  `@rollup/rollup-{linux,win32}-*`, `@tauri-apps/cli-{linux-x64-gnu,linux-x64-musl,win32-x64-msvc}`.
  → Either OS can run Vite today. A careless `npm ci` from one side can prune the other's optionals.
- `.env` exists at repo root with `TMDB_API_KEY`, `RAWG_API_KEY`, `VITE_CLOUD_API_URL` (values redacted, gitignored).
  `src-tauri/build.rs` reads `../.env` and re-emits each key via `cargo:rustc-env`, so **the Rust build must be run with the repo root as `..` relative to `src-tauri`** (i.e. normal `npm run tauri` invocation).
- `src-tauri/tauri.conf.json`: `devUrl` `http://localhost:1420`, `frontendDist` `../build`,
  `beforeDevCommand` `npm run dev`, `beforeBuildCommand` `npm run build`, `bundle.targets` `"all"`, `csp: null`.
- `vite.config.js`: port **1420**, `strictPort: true`, SCSS auto-injected via `additionalData: @use 'variables' as *;`.
- `src-tauri/Cargo.toml` has no `[profile.*]` sections. `src-tauri/.cargo/config.toml` does **not** exist.
- No `scripts/` directory. `docs/` contains only `PROJECT_REVIEW.md`.
- `.gitignore` already ignores `src-tauri/target/`, `build/`, `.svelte-kit/`, `node_modules/`, `.env`.

### Decisive assumption — why Windows-native, not WSL-native

Running the app inside WSL would require: installing a Linux rust toolchain, installing `webkit2gtk-4.1` +
`libsoup3` + GTK deps, compiling a second 5.6 GB target tree, and then rendering **through WSLg with no
`/dev/dri`**, i.e. software GL composited over RDP. That is exactly the "stutter" the user wants to avoid,
and it also runs Vite's file watcher over the 9p/DrvFs bridge (slow `stat` storms). The Windows toolchain is
already installed, already produced a working binary, and drives WebView2 with real GPU acceleration.

**Therefore: build and run on Windows; edit, git, and typecheck from WSL.** Both sides operate on the same
NTFS directory, so no syncing is required.

### Open decision the implementer must NOT silently make

WSL node is **v24**, Windows node is **v22.15.1**, sharing one `node_modules`. This plan standardises on the
**Windows node** for anything that executes (`dev`, `build`, `tauri`) and permits WSL node only for
`npm run check`. See Risks for the version-pinning alternative.

---

## Architecture / proposed approach

Treat Windows as the *execution* environment and WSL as the *authoring* environment over one shared NTFS
working tree. Add a `src-tauri/.cargo/config.toml` and `[profile.*]` blocks that cut link time and remove
debug-build runtime stutter, add two thin launcher scripts (`scripts/dev.ps1`, `scripts/build.ps1`) plus a
WSL passthrough (`scripts/wdev.sh`) so `npm run tauri dev` can be triggered from a fish prompt without
losing native speed, and codify the whole thing in `docs/BUILD_AND_RUN.md`. A Node-based toolchain
verification test (`scripts/verify-toolchain.test.mjs`) is written **first**, fails **first**, and becomes
the regression gate.

---

## Step-by-step tasks

Conventions used below:

- `WSL$` — run in the WSL Arch shell (fish), cwd `/mnt/c/Users/rafael.moraes/Code/tauri-app`.
- `PS>` — run in **Windows PowerShell**, cwd `C:\Users\rafael.moraes\Code\tauri-app`.
  Open one with: `WSL$ powershell.exe -NoExit -Command "cd C:\Users\rafael.moraes\Code\tauri-app"`
- Commit after every phase. Commit messages are given verbatim.

---

### Phase 0 — Baseline and safety net

#### Task 0.1 — Confirm clean tree and record the starting commit

```
WSL$ cd /mnt/c/Users/rafael.moraes/Code/tauri-app
WSL$ git status --short
WSL$ git branch --show-current
WSL$ git log -1 --format='%h %s'
```

Expected: `git status --short` prints **nothing**; branch prints `docs/project-review-2026-09`;
log prints `63a044b docs(plan): preserve executed review plan with corrected assumptions`.

If the tree is dirty, **stop** and ask the user before continuing.

#### Task 0.2 — Create the working branch

```
WSL$ git switch -c chore/wsl-windows-build-pipeline
WSL$ git branch --show-current
```

Expected output: `chore/wsl-windows-build-pipeline`.

#### Task 0.3 — Verify `.env` is present and still ignored

```
WSL$ test -f .env && echo ENV_PRESENT
WSL$ git check-ignore -v .env
WSL$ sed 's/=.*/=<redacted>/' .env
```

Expected: `ENV_PRESENT`; `git check-ignore` prints a line containing `.gitignore` and `.env`;
the `sed` output lists exactly `TMDB_API_KEY=<redacted>`, `RAWG_API_KEY=<redacted>`,
`VITE_CLOUD_API_URL=<redacted>`.

**Never print raw `.env` values into a terminal transcript, commit message, or chat reply.**

---

### Phase 1 — TDD: the toolchain verification test

This phase writes the failing test **before** any config exists, per the TDD cycle.

#### Task 1.1 — Create `scripts/verify-toolchain.test.mjs` (RED)

Create the directory and file. Full content, copy-paste verbatim:

```js
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
```

#### Task 1.2 — Run the test and confirm it FAILS for the right reasons (RED)

```
WSL$ '/mnt/c/Program Files/nodejs/node.exe' --test scripts/verify-toolchain.test.mjs
```

Expected: process exits **non-zero**. The first five tests (`cargo`, `rustc`, `link.exe`, WebView2, `.env`)
may pass or fail depending on PATH; the last three (`cargo dev profile`, `launcher scripts`, `runbook`)
**must** fail with messages naming `src-tauri/.cargo/config.toml`, `scripts/dev.ps1`, and
`docs/BUILD_AND_RUN.md`.

If `cargo --version` fails with `ENOENT` from WSL, that is expected and is fixed in Phase 2 — the test is
designed to be run from **Windows**. Re-run it there later; for now, only the last three failures matter.

#### Task 1.3 — Commit the failing test

```
WSL$ git add scripts/verify-toolchain.test.mjs
WSL$ git commit -m "test(build): add failing Windows toolchain verification test"
WSL$ git log -1 --format='%h %s'
```

Expected: a new commit hash with the message above.

---

### Phase 2 — Make the Windows toolchain reachable and reproducible

#### Task 2.1 — Confirm the MSVC Build Tools installation path

```
WSL$ '/mnt/c/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe' -products '*' -property installationPath
```

Expected output (two lines):

```
C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools
C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools
```

Use the **`18\BuildTools`** (VS 2026) path everywhere below. If only the 2019 line appears, substitute it
and note the deviation in `docs/BUILD_AND_RUN.md`.

#### Task 2.2 — Verify the MSVC developer shell actually resolves `link.exe`

```
WSL$ cmd.exe /c "\"C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat\" >nul && where link.exe && cl 2>&1 | findstr /C:Microsoft"
```

Expected: a path ending in `...\VC\Tools\MSVC\<version>\bin\Hostx64\x64\link.exe`, followed by a
`Microsoft (R) C/C++ Optimizing Compiler` banner line.

If `vcvars64.bat` does not exist, the "Desktop development with C++" workload is missing. Stop and tell
the user to install it via the Visual Studio Installer — **do not** attempt a silent workload install.

#### Task 2.3 — Sanity-check cargo against the existing target directory

```
WSL$ cd src-tauri && cargo.exe check --locked 2>&1 | tail -5 && cd ..
```

Expected: last line resembles `Finished \`dev\` profile [unoptimized + debuginfo] target(s) in Xs` with
exit code 0. (A previous run of this completed in ~36 s against the warm 5.6 GB target dir.)

If this fails with a linker error, Task 2.2 did not actually put MSVC on PATH for this process — that is
expected and harmless for `cargo check`; proceed, and rely on `scripts/dev.ps1` (Task 3.1) which enters the
developer shell explicitly.

---

### Phase 3 — Cargo profile tuning (kills the two real performance problems)

Two distinct problems are being solved here:

1. **Slow rebuilds** — default dev profile emits full debuginfo and links with the slow default linker.
2. **Stuttering UI in dev** — dependencies (`reqwest`, `rusqlite`, `serde_json`, image/TLS code) compiled at
   `opt-level = 0` are 10–100× slower at runtime. This is the single biggest cause of "the dev build feels
   janky but the release build is fine".

#### Task 3.1 — Create `src-tauri/.cargo/config.toml`

New file, full content:

```toml
# src-tauri/.cargo/config.toml
# Windows-native build settings for TauriFlix.
# The MSVC toolchain is the only supported target on this machine; see docs/BUILD_AND_RUN.md.

[build]
# Keep the (large) incremental artefacts on the same NTFS volume as the source.
# Do NOT relocate this to a WSL ext4 path: cargo.exe would then write across the
# 9p bridge and every rebuild would slow down instead of speeding up.
target-dir = "target"

[target.x86_64-pc-windows-msvc]
# /INCREMENTAL speeds up relinking of the 20 MB debug binary.
rustflags = ["-C", "link-arg=/INCREMENTAL"]

[net]
git-fetch-with-cli = true
```

#### Task 3.2 — Append profile sections to `src-tauri/Cargo.toml`

Append the following **to the end of** `src-tauri/Cargo.toml` (do not modify the existing
`[package]`, `[lib]`, `[build-dependencies]`, or `[dependencies]` sections):

```toml

# ── Build profiles ────────────────────────────────────────
# Rationale (see docs/BUILD_AND_RUN.md):
#  * dev: minimal debuginfo + many codegen units => fast incremental links.
#  * dev.package."*": optimise DEPENDENCIES only. Our own crate stays debuggable,
#    but reqwest/rusqlite/serde run at full speed, which removes dev-mode UI stutter.
#  * release: LTO + single codegen unit + stripped symbols for a small, fast bundle.

[profile.dev]
incremental = true
debug = 1
codegen-units = 256

[profile.dev.package."*"]
opt-level = 3
debug = false

[profile.release]
lto = "thin"
codegen-units = 1
panic = "abort"
strip = "symbols"
```

#### Task 3.3 — Verify the tuned dev profile compiles and relinks

```
WSL$ cd src-tauri && cargo.exe check --locked 2>&1 | tail -3 && cd ..
```

Expected: exit 0, `Finished` line. The **first** run after Task 3.2 recompiles every dependency at
`opt-level = 3` and will take several minutes (5–15 min on 22 threads); this is a one-time cost and is
expected. Subsequent runs are incremental.

Do not interrupt it. If it must be re-run, the cache makes it fast.

#### Task 3.4 — Commit the profile work

```
WSL$ git add src-tauri/.cargo/config.toml src-tauri/Cargo.toml
WSL$ git commit -m "perf(build): tune cargo dev/release profiles for MSVC target"
WSL$ git status --short
```

Expected: empty `git status --short` output.

---

### Phase 4 — Launcher scripts

#### Task 4.1 — Create `scripts/dev.ps1`

New file, full content:

```powershell
# scripts/dev.ps1
# Starts TauriFlix in development mode with the MSVC toolchain on PATH.
# Usage (from Windows PowerShell, repo root):
#   PS> powershell -ExecutionPolicy Bypass -File scripts\dev.ps1
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$vsWhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vsWhere)) { throw "vswhere.exe not found. Install Visual Studio Build Tools." }

$vsPath = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vsPath) { throw "No VC++ build tools found. Install the 'Desktop development with C++' workload." }

# Import the MSVC environment into this PowerShell session.
$vcvars = Join-Path $vsPath "VC\Auxiliary\Build\vcvars64.bat"
cmd /c "`"$vcvars`" >nul && set" | ForEach-Object {
  if ($_ -match "^([^=]+)=(.*)$") { Set-Item -Path "Env:$($matches[1])" -Value $matches[2] }
}

$env:PATH = "$env:USERPROFILE\.cargo\bin;C:\Program Files\nodejs;$env:PATH"

Write-Host "cargo : $((cargo --version))"
Write-Host "node  : $((node --version))"
Write-Host "Starting `npm run tauri dev` ..."
npm run tauri dev
```

#### Task 4.2 — Create `scripts/build.ps1`

New file, full content:

```powershell
# scripts/build.ps1
# Produces a release build and Windows bundles (MSI + NSIS) for TauriFlix.
# Usage (from Windows PowerShell, repo root):
#   PS> powershell -ExecutionPolicy Bypass -File scripts\build.ps1
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$vsWhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vsWhere)) { throw "vswhere.exe not found. Install Visual Studio Build Tools." }

$vsPath = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vsPath) { throw "No VC++ build tools found. Install the 'Desktop development with C++' workload." }

$vcvars = Join-Path $vsPath "VC\Auxiliary\Build\vcvars64.bat"
cmd /c "`"$vcvars`" >nul && set" | ForEach-Object {
  if ($_ -match "^([^=]+)=(.*)$") { Set-Item -Path "Env:$($matches[1])" -Value $matches[2] }
}

$env:PATH = "$env:USERPROFILE\.cargo\bin;C:\Program Files\nodejs;$env:PATH"

if (-not (Test-Path ".env")) { throw ".env is missing; build.rs needs TMDB_API_KEY and RAWG_API_KEY." }

npm run tauri build -- --bundles msi,nsis
Write-Host "Bundles written to src-tauri\target\release\bundle\"
```

#### Task 4.3 — Create `scripts/wdev.sh` (the WSL entry point)

New file, full content:

```bash
#!/usr/bin/env bash
# scripts/wdev.sh
# Launches the Windows-native dev build from a WSL shell.
# The app process, Vite, and cargo all run on Windows; WSL only issues the command.
# Usage:  WSL$ ./scripts/wdev.sh          (dev)
#         WSL$ ./scripts/wdev.sh build    (release bundles)
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$repo_root" in
  /mnt/[a-z]/*) ;;
  *) echo "error: repo must live on a Windows drive (/mnt/<drive>/...), got: $repo_root" >&2; exit 1 ;;
esac

win_root="$(wslpath -w "$repo_root")"
script="dev.ps1"
[ "${1:-dev}" = "build" ] && script="build.ps1"

exec powershell.exe -NoProfile -ExecutionPolicy Bypass \
  -Command "cd '$win_root'; .\\scripts\\$script"
```

#### Task 4.4 — Make the shell script executable and commit

```
WSL$ chmod +x scripts/wdev.sh
WSL$ git add scripts/dev.ps1 scripts/build.ps1 scripts/wdev.sh
WSL$ git update-index --chmod=+x scripts/wdev.sh
WSL$ git commit -m "chore(build): add Windows dev/build launchers and WSL passthrough"
WSL$ git ls-files -s scripts/wdev.sh
```

Expected: the `git ls-files -s` line starts with mode `100755`.

---

### Phase 5 — Documentation (`docs/BUILD_AND_RUN.md`)

#### Task 5.1 — Create `docs/BUILD_AND_RUN.md`

New file, full content:

```markdown
# Building and running TauriFlix from WSL Arch on Windows 11

## TL;DR

```
WSL$ ./scripts/wdev.sh          # dev mode, hot reload
WSL$ ./scripts/wdev.sh build    # release MSI + NSIS bundles
```

Edit code in WSL. Build and run on Windows. One shared NTFS working tree, no sync step.

## Why Windows-native and not WSL-native

| | Windows (MSVC + WebView2) | WSL (GTK + WebKitGTK via WSLg) |
| --- | --- | --- |
| Rust toolchain | installed (`stable-x86_64-pc-windows-msvc`) | not installed |
| Webview deps | WebView2 runtime installed | `webkit2gtk-4.1`, `libsoup3` not installed |
| GPU | native D3D acceleration | `/dev/dri` absent → software GL over RDP |
| File watching | native NTFS (fast) | DrvFs/9p bridge (slow `stat` storms) |
| Target dir size | 5.6 GB, already warm | a second 5.6 GB tree |

WSLg with no `/dev/dri` renders the webview in software and composites it over RDP. That is the source of
the stutter this setup avoids. The Windows toolchain already produced a working binary
(`src-tauri/target/debug/tauri-app.exe`), so it is the supported path.

## One-time prerequisites (Windows side)

- Visual Studio Build Tools with the **Desktop development with C++** workload
  (`C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools`).
- Rust via rustup, host triple `x86_64-pc-windows-msvc`.
- Node.js (`C:\Program Files\nodejs`, currently v22.15.1).
- Microsoft Edge WebView2 Runtime (already present).
- A repo-root `.env` containing `TMDB_API_KEY`, `RAWG_API_KEY`, `VITE_CLOUD_API_URL`.
  `src-tauri/build.rs` reads `../.env` and re-exports each key via `cargo:rustc-env`.

Verify all of it at once:

```
PS> node scripts\verify-toolchain.test.mjs
```

## Daily workflow

| Task | Where | Command |
| --- | --- | --- |
| Edit, git, review | WSL | your editor |
| TypeScript/Svelte check | WSL | `npm run check` |
| Run the app | WSL → Windows | `./scripts/wdev.sh` |
| Release bundles | WSL → Windows | `./scripts/wdev.sh build` |
| Rust typecheck | WSL | `cd src-tauri && cargo.exe check --locked` |

## Performance notes

- `src-tauri/Cargo.toml` sets `[profile.dev.package."*"] opt-level = 3`. Dependencies are optimised while
  our own crate stays debuggable. This removes dev-mode UI stutter; the cost is one long first build.
- `[profile.dev] debug = 1` + `codegen-units = 256` + `/INCREMENTAL` keep relinks of the ~20 MB debug
  binary fast.
- `src-tauri/.cargo/config.toml` pins `target-dir = "target"`. **Do not** move it to a WSL ext4 path —
  `cargo.exe` would then write across the 9p bridge and rebuilds would get slower, not faster.
- Vite dev server: port **1420**, `strictPort: true`. If startup fails with `Port 1420 is already in use`,
  a previous run is still alive: `PS> Get-NetTCPConnection -LocalPort 1420 | Select-Object OwningProcess`.
- `.wslconfig` uses `networkingMode=mirrored`, so `http://localhost:1420` resolves identically from both
  sides. Keep it that way; NAT mode would break cross-side access to the dev server.

## node_modules is shared between two Node versions

WSL runs Node 24 (mise); Windows runs Node 22.15.1. They share one `node_modules`, which currently holds
both `@esbuild/{linux-x64,win32-x64}` and both `@rollup` platform packages.

Rule: **install dependencies from Windows** (`PS> npm install`). If a WSL-side install ever prunes the
Windows optional binaries, the symptom is
`Cannot find module @rollup/rollup-win32-x64-msvc`. Recovery:

```
PS> Remove-Item -Recurse -Force node_modules
PS> npm install
```

## WSLg fallback (only if you must run a Linux build)

Not supported by these scripts, and expect software rendering. It requires:

```
WSL$ sudo pacman -S --needed webkit2gtk-4.1 libsoup3 base-devel curl wget file openssl \
       appmenu-gtk-module libappindicator-gtk3 librsvg
WSL$ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
WSL$ WEBKIT_DISABLE_COMPOSITING_MODE=1 npm run tauri dev
```

`WEBKIT_DISABLE_COMPOSITING_MODE=1` is required under WSLg or the window renders black. Use this only for
verifying Linux-specific behaviour, never for day-to-day development on this machine.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `link.exe not found` | MSVC env not loaded | use `scripts/dev.ps1`, which runs `vcvars64.bat` |
| `error: linker 'cc' not found` | Linux cargo invoked | use `cargo.exe`, not `cargo` |
| Black app window | WSLg software rendering | build on Windows instead |
| `Port 1420 is already in use` | stale Vite process | kill the owning PID (see above) |
| `Cannot find module @rollup/rollup-win32-x64-msvc` | cross-platform npm prune | reinstall from Windows |
| Blank media grid, 401s | `.env` keys missing at compile time | confirm `.env`, then rebuild (`build.rs` bakes them in) |
```

#### Task 5.2 — Link the runbook from `README.md`

In `README.md`, immediately after the existing line that links to the project review, add:

```markdown
Build and run on WSL + Windows 11: see [Build and run runbook](docs/BUILD_AND_RUN.md).
```

Verify:

```
WSL$ grep -n "BUILD_AND_RUN" README.md
```

Expected: exactly one matching line.

#### Task 5.3 — Commit the documentation

```
WSL$ git add docs/BUILD_AND_RUN.md README.md
WSL$ git commit -m "docs(build): document the WSL-to-Windows build and run workflow"
```

---

### Phase 6 — GREEN: make the verification test pass

#### Task 6.1 — Run the test from Windows

```
WSL$ powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "cd C:\Users\rafael.moraes\Code\tauri-app; `$env:PATH = \"`$env:USERPROFILE\.cargo\bin;C:\Program Files\nodejs;`$env:PATH\"; node --test scripts\verify-toolchain.test.mjs"
```

Expected tail of output:

```
# pass 8
# fail 0
```

If `the MSVC linker is on PATH` fails here, that is acceptable **only** when the test is run outside the
developer shell — re-run it from a session started by `scripts/dev.ps1`. All other tests must pass
unconditionally.

#### Task 6.2 — Commit the green state

```
WSL$ git commit --allow-empty -m "test(build): toolchain verification passes on the Windows target"
```

---

### Phase 7 — Actually build and run the app

#### Task 7.1 — Frontend-only check (fast, catches Svelte/TS errors before Rust)

```
WSL$ npm run check
```

Expected: `svelte-check found 0 errors and 0 warnings` (this was the state at HEAD `63a044b`).

#### Task 7.2 — Frontend production build

```
WSL$ npm run build
WSL$ ls build/app.html build/_app
```

Expected: Vite prints a `✓ built in ...` summary and exits 0; `build/app.html` exists (this is the
`adapter-static` SPA fallback named in `svelte.config.js`).

#### Task 7.3 — First dev run

```
WSL$ ./scripts/wdev.sh
```

Expected sequence in the PowerShell window:
1. `cargo : cargo 1.93.1 (...)` and `node  : v22.15.1`
2. Vite: `Local: http://localhost:1420/`
3. Cargo compiles (long on the first run after Phase 3, then incremental)
4. A native window titled **tauri-app**, 800×600, opens on the Windows desktop.

Verify inside the app:
- The media grid populates (proves `TMDB_API_KEY` reached the binary through `build.rs`).
- Right-click → Inspect Element opens devtools (`devtools: true` in `src-tauri/tauri.conf.json`).
- Editing any file under `src/` hot-reloads the window without a Rust rebuild.

If the grid is empty, open devtools → Console. A `TMDB_API_KEY` error means `.env` was not read at
compile time; `touch .env` and restart — `build.rs` declares `cargo:rerun-if-changed=../.env`.

#### Task 7.4 — Measure a warm incremental rebuild

Touch a Rust file and time the rebuild:

```
WSL$ touch src-tauri/src/lib.rs
WSL$ cd src-tauri && time cargo.exe build --locked 2>&1 | tail -2 && cd ..
```

Expected: a `Finished` line. Record the wall time in `docs/BUILD_AND_RUN.md` under "Performance notes" as
a baseline — on 22 threads with `/INCREMENTAL` and a warm cache this should be well under a minute. If it
exceeds ~3 minutes, the dependency optimisation from Task 3.2 is being rebuilt; confirm it finished once.

#### Task 7.5 — Release build and bundles

```
WSL$ ./scripts/wdev.sh build
WSL$ ls src-tauri/target/release/bundle/msi src-tauri/target/release/bundle/nsis
```

Expected: an `.msi` file and an `-setup.exe` file, both named `tauri-app_0.1.0_x64*`.

Note: `src-tauri/tauri.conf.json` sets `bundle.targets: "all"`; the script overrides it with
`--bundles msi,nsis` because the other targets (deb/rpm/appimage/dmg) cannot be produced on Windows.

#### Task 7.6 — Run the release binary and confirm it is the smooth one

```
WSL$ '/mnt/c/Users/rafael.moraes/Code/tauri-app/src-tauri/target/release/tauri-app.exe' &
```

Expected: the window opens; scrolling the media grid is visibly smooth. This is the reference for
"no stutter" — if dev mode now feels comparable, Phase 3 did its job.

#### Task 7.7 — Final commit

```
WSL$ git status --short
WSL$ git log --oneline 63a044b..HEAD
```

Expected: `git status --short` is empty (all build outputs are gitignored); the log lists the five commits
from Phases 1, 3, 4, 5, and 6.

---

## Tests / validation summary

| Gate | Command | Expected |
| --- | --- | --- |
| Toolchain | `node --test scripts\verify-toolchain.test.mjs` (Windows) | `# pass 8 / # fail 0` |
| Frontend types | `npm run check` (WSL) | `0 errors and 0 warnings` |
| Frontend build | `npm run build` (WSL) | exit 0, `build/app.html` exists |
| Rust typecheck | `cd src-tauri && cargo.exe check --locked` | exit 0, `Finished` |
| Rust format | `cd src-tauri && cargo.exe fmt --check` | **currently exits 1** — pre-existing, out of scope |
| Rust lint | `cd src-tauri && cargo.exe clippy --locked -- -D warnings` | **currently exits 101** — pre-existing, out of scope |
| Rust tests | `cd src-tauri && cargo.exe test --locked` | exit 0, **0 tests** — pre-existing gap |
| App dev run | `./scripts/wdev.sh` | native window, populated grid, HMR works |
| App release run | `./scripts/wdev.sh build` then run the exe | MSI + NSIS produced, smooth scrolling |

The `fmt`, `clippy`, and zero-test findings are documented in
`docs/PROJECT_REVIEW.md` §11 and are deliberately **not** fixed by this plan (YAGNI — this plan is about
build/run ergonomics). Do not let them block Phase 7.

---

## Risks, tradeoffs, and open questions

### Risks

1. **Node version split (highest risk).** WSL Node 24 and Windows Node 22.15.1 share one `node_modules`.
   A `npm ci` or `npm install` from WSL can prune `@rollup/rollup-win32-x64-msvc` and
   `@esbuild/win32-x64`, breaking the Windows build. Mitigation: install only from Windows; recovery is
   documented in `docs/BUILD_AND_RUN.md`. **Stronger alternative, not taken here (YAGNI):** pin both sides
   to the same major via `.nvmrc` + a matching mise entry.

2. **First build after Phase 3 is long.** Setting `[profile.dev.package."*"] opt-level = 3` invalidates
   every dependency artefact in the 5.6 GB target dir. Expect 5–15 minutes once. Do not interpret this as
   a regression and do not revert the change mid-build.

3. **`panic = "abort"` in the release profile** changes behaviour if any code relies on unwinding
   (`catch_unwind`). A grep of `src-tauri/src/` for `catch_unwind` should return nothing before this is
   accepted; if it returns hits, drop that one line from `[profile.release]`.

4. **`/INCREMENTAL` with `lto` conflicts.** The rustflag is scoped to the target and applies to release
   builds too, where MSVC may warn that `/INCREMENTAL` is ignored under LTO. It is a warning, not an
   error. If it becomes noisy, move the flag under a dev-only `[profile.dev]` `rustflags` via a cargo
   config profile override.

5. **`.wslconfig` mirrored networking is load-bearing.** `hostAddressLoopback=true` is what makes
   `http://localhost:1420` work identically from both sides. Changing to NAT mode breaks cross-side access
   to the Vite dev server.

6. **Secrets on disk.** `.env` is gitignored, but `build.rs` bakes `TMDB_API_KEY` and `RAWG_API_KEY` into
   the binary via `cargo:rustc-env`. **Any shipped bundle from Phase 7.5 contains extractable API keys.**
   This is an existing design flaw recorded in `docs/PROJECT_REVIEW.md`; do not distribute the bundles.

7. **5.6 GB target dir on the Windows drive.** Combined with the release profile this can approach 8–10 GB.
   Check free space before Phase 7.5.

### Tradeoffs

- **Windows-native over WSL-native:** gives GPU-accelerated WebView2 and fast NTFS watching, at the cost of
  never exercising the Linux GTK/WebKit code path locally. Linux/macOS coverage must come from CI.
- **Optimised dependencies in dev:** trades one slow first build for smooth runtime and faster iteration
  thereafter.
- **PowerShell launchers over npm scripts:** npm scripts cannot import the MSVC environment; a `.ps1` that
  sources `vcvars64.bat` is the only reliable way, so the scripts stay thin and delegate to `npm run tauri`.

### Open questions for the user

1. **Do you also need the app to run *inside* WSL** (e.g. to test the Linux bundle), or is Windows-native
   sufficient? The WSLg path is documented but not automated; automating it is a separate plan.
2. **Should `ci.yml` and `release.yml` be moved from the repo root into `.github/workflows/`** so these
   builds are also exercised in CI? They are currently inert (finding in `docs/PROJECT_REVIEW.md`).
   Out of scope here.
3. **Is the Node version split acceptable**, or do you want both sides pinned to Node 22 (or 24) via
   `.nvmrc` + mise? This plan assumes the split stays and works around it.
