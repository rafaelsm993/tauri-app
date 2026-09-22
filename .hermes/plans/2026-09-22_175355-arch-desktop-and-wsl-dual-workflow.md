# Run TauriFlix natively on the Arch desktop, keeping the WSL → Windows laptop flow working

> For Hermes: execute task-by-task. The user commits manually in this repo. NEVER run `git add`, `git commit`, `git push`, or `git reset`, and never create branches. "Checkpoint" means: stop, report, and let the user commit. Commands that need `sudo` or touch secrets (`.env`) are run BY THE USER. Print the exact command, wait, then verify.

Goal: one command, `./scripts/run.sh <dev|build|check|verify>`, that runs the app natively on the Arch desktop and still delegates to the Windows toolchain when run from WSL on the laptop, with a toolchain test that passes on both machines.

---

## Current context (verified read-only on the Arch desktop, 2026-09-22)

### The laptop workflow (already committed, must keep working)
- The laptop runs Windows 11. Code is edited inside WSL (Arch) on an NTFS drive (`/mnt/<drive>/...`). The app is built and run by the Windows toolchain: MSVC, Rust `x86_64-pc-windows-msvc`, Windows Node 22 and WebView2. WSLg renders in software and stutters, which is why Windows builds are used. The full rationale is in `docs/BUILD_AND_RUN.md`.
- `scripts/wdev.sh` is called from WSL.
  - It refuses to run unless the repo is under `/mnt/[a-z]/`.
  - It then runs `powershell.exe ... .\scripts\dev.ps1`, or `build.ps1` when called with `build`.
- `scripts/dev.ps1`, `scripts/build.ps1` and `scripts/verify.ps1` all do the same setup: find VS Build Tools via `vswhere`, import `vcvars64.bat`, and prepend cargo and node to PATH.
  - `dev.ps1` then runs `npm run tauri dev`.
  - `build.ps1` then runs `node node_modules\@tauri-apps\cli\tauri.js build --bundles msi,nsis`.
  - `verify.ps1` then runs `node --test scripts\verify-toolchain.test.mjs`.
- `scripts/verify-toolchain.test.mjs` has 8 tests, and all of them assume Windows:
  - `rustc` host is `x86_64-pc-windows-msvc`
  - `cmd /c where link.exe` succeeds
  - the WebView2 directory exists
  - plus `.env` keys, the Cargo profiles, the launcher files and the runbook contents
- `src-tauri/.cargo/config.toml`:
  - `target-dir = "target"`
  - `[target.x86_64-pc-windows-msvc] rustflags = ["-C","link-arg=/INCREMENTAL"]`: this is target-scoped, so Linux ignores it
  - `[net] git-fetch-with-cli = true`
- `src-tauri/build.rs` reads `../.env` and emits each `KEY=value` as `cargo:rustc-env`. `src-tauri/src/api/tmdb.rs` and `rawg.rs` use `env!("TMDB_API_KEY")` / `env!("RAWG_API_KEY")`. **Without `.env`, the Rust crate does not compile.**

### This machine (Arch/CachyOS desktop, native Linux)
- The repo is at `/mnt/FILES/Projects/tauri-app` on btrfs, so it is a normal Linux path. `wdev.sh` would reject it only by coincidence: its check is the pattern `/mnt/[a-z]/*` (single-letter drive), and `/mnt/FILES` doesn't match.
- `/proc/sys/kernel/osrelease` = `7.2.3-1-cachyos` (contains no `microsoft`, so this is not WSL).
- Session: Wayland (`WAYLAND_DISPLAY=wayland-1`, XWayland `DISPLAY=:1`). GPUs: AMD RX 9070 (discrete) and a Raphael iGPU.
- Already present:
  - node v22.23.1 and npm (`~/.local/bin`, mise)
  - pkg-config
  - `webkit2gtk-4.1` 2.52.6, `javascriptcoregtk-4.1`, `libsoup-3.0` 3.6.6, `gtk+-3.0`, `openssl`
  - `base-devel`, `curl`, `wget`, `file`, `librsvg`, `libappindicator`
- **Missing:**
  - `cargo`, `rustc` and `rustup` (the `rustup` package is available in `extra` / `cachyos-extra-znver4`, and `rust` is not installed, so there is no conflict)
  - `.env`
  - `node_modules/`
  - `src-tauri/target/`
- `package-lock.json` already contains the Linux optional binaries (`@tauri-apps/cli-linux-x64-gnu`, `@rollup/rollup-linux-x64-gnu`, `@esbuild/linux-x64`), so `npm ci` works here without changing the lockfile.
- `.gitignore` ignores `.env` and `.env.*` but whitelists `!.env.example`. No `.env.example` exists yet.
- The user's shell is **fish**. Scripts use a `#!/usr/bin/env bash` shebang, so they run fine. In fish, set a one-off variable with `env VAR=val ./cmd` (or `VAR=val ./cmd` on fish ≥ 3.1). Never use `export`.
- Working tree right now: uncommitted changes from the previous session (`README.md`, `docs/BUILD_AND_RUN.md`, `docs/notes/`, `scripts/docs-notes.test.mjs`, the earlier plan file). Task 0 handles this.
- There is no `test` npm script. Tests are run as `node --test scripts/<file>.test.mjs` from the repo root. Existing guards: `scripts/no-auth.test.mjs` (7 tests) and `scripts/docs-notes.test.mjs` (6 tests).

## Architecture / approach

Add one bash entry point, `scripts/run.sh`. It detects WSL (via `microsoft` in `/proc/sys/kernel/osrelease`, overridable with `TF_PLATFORM=linux|wsl`) and maps each subcommand to one concrete command:
- On WSL it delegates to the existing `scripts/wdev.sh`, which gains a `verify` mode.
- On native Linux it runs the Tauri CLI directly with the Linux toolchain.

`scripts/verify-toolchain.test.mjs` becomes platform-aware with `node:test`'s `skip:` option: MSVC/WebView2 checks run only on `win32`, and Rust-gnu/WebKitGTK checks run only on `linux`. The same file, driven by `verify.ps1`, still guards the laptop. The PowerShell scripts are not touched, so the laptop keeps behaving exactly as it does today.

The Linux release build uses `--no-bundle` (a bare binary). `.deb`/`.rpm`/AppImage bundles aren't useful on Arch, so they are left out (YAGNI).

## Files

| Action | Path |
| --- | --- |
| Create | `scripts/run.sh`, `scripts/run.test.mjs`, `.env.example`, `.gitattributes` |
| Modify | `scripts/wdev.sh`, `scripts/verify-toolchain.test.mjs`, `src-tauri/.cargo/config.toml` (comment only), `docs/BUILD_AND_RUN.md`, `README.md`, `docs/notes/Config and Stack.md` |
| Untouched | `scripts/dev.ps1`, `scripts/build.ps1`, `scripts/verify.ps1`, `src-tauri/Cargo.toml`, all app source |

---

## Task 0: Isolate from the previous session's work

Run:
```
cd /mnt/FILES/Projects/tauri-app
git status --short
```
If the docs migration files (`README.md`, `docs/BUILD_AND_RUN.md`, `docs/notes/`, `scripts/docs-notes.test.mjs`) are still listed, STOP and ask the user to commit them first. Suggested message: `docs(notes): migrate Obsidian notes rewritten for the current app`. This task edits two of the same files, and mixing the two changes makes review painful.

Then:
```
node --test scripts/no-auth.test.mjs scripts/docs-notes.test.mjs 2>&1 | grep -E '^# (pass|fail)'
```
Expected: `# pass 13`, `# fail 0`.

## Task 1: Failing test for the launcher's dispatch table

Create `scripts/run.test.mjs`:

```js
// scripts/run.test.mjs
// Dispatch table of scripts/run.sh, checked via --dry-run (no side effects).
// Run from the repo root on Linux or WSL:  node --test scripts/run.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function dryRun(args, platform) {
  const env = { ...process.env };
  delete env.TF_PLATFORM;
  if (platform) env.TF_PLATFORM = platform;
  return spawnSync("bash", ["scripts/run.sh", "--dry-run", ...args], {
    encoding: "utf8",
    env,
  });
}

const CASES = [
  ["linux", "dev", "npm run tauri dev"],
  ["linux", "build", "npx tauri build --no-bundle"],
  ["linux", "check", "npm run check"],
  ["linux", "verify", "node --test scripts/verify-toolchain.test.mjs"],
  ["wsl", "dev", "scripts/wdev.sh dev"],
  ["wsl", "build", "scripts/wdev.sh build"],
  ["wsl", "check", "npm run check"],
  ["wsl", "verify", "scripts/wdev.sh verify"],
];

for (const [platform, sub, expected] of CASES) {
  test(`${platform} ${sub} -> ${expected}`, () => {
    const r = dryRun([sub], platform);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), expected);
  });
}

test("subcommand defaults to dev", () => {
  assert.equal(dryRun([], "linux").stdout.trim(), "npm run tauri dev");
});

test("unknown subcommand exits 2 with usage", () => {
  const r = dryRun(["deploy"], "linux");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage:/);
});

test("auto-detects WSL vs native Linux from the kernel release", () => {
  const isWsl = /microsoft/i.test(
    readFileSync("/proc/sys/kernel/osrelease", "utf8"),
  );
  const expected = isWsl ? "scripts/wdev.sh dev" : "npm run tauri dev";
  assert.equal(dryRun(["dev"]).stdout.trim(), expected);
});
```

Run: `node --test scripts/run.test.mjs 2>&1 | grep -E '^# (pass|fail)'`
Expected: `# pass 0`, `# fail 11`. The script doesn't exist yet, so bash exits 127.

## Task 2: Implement `scripts/run.sh`

Create `scripts/run.sh`:

```bash
#!/usr/bin/env bash
# scripts/run.sh — single entry point for both development machines.
#   Arch desktop (native Linux): runs Tauri here with the Linux toolchain.
#   Windows laptop (WSL):        delegates to the Windows toolchain via scripts/wdev.sh.
# Usage:  ./scripts/run.sh [--dry-run] [dev|build|check|verify]
# Force a platform with TF_PLATFORM=linux|wsl (fish: env TF_PLATFORM=wsl ./scripts/run.sh).
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

dry_run=0
if [ "${1:-}" = "--dry-run" ]; then dry_run=1; shift; fi
sub="${1:-dev}"

if [ -n "${TF_PLATFORM:-}" ]; then
  platform="$TF_PLATFORM"
elif grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null; then
  platform="wsl"
else
  platform="linux"
fi

case "$platform:$sub" in
  linux:dev)    argv=(npm run tauri dev) ;;
  linux:build)  argv=(npx tauri build --no-bundle) ;;
  linux:verify) argv=(node --test scripts/verify-toolchain.test.mjs) ;;
  wsl:dev)      argv=(scripts/wdev.sh dev) ;;
  wsl:build)    argv=(scripts/wdev.sh build) ;;
  wsl:verify)   argv=(scripts/wdev.sh verify) ;;
  linux:check | wsl:check) argv=(npm run check) ;;
  *)
    echo "usage: $0 [--dry-run] [dev|build|check|verify]   (platform: $platform)" >&2
    exit 2
    ;;
esac

if [ "$dry_run" = 1 ]; then
  echo "${argv[*]}"
  exit 0
fi

# Friendly preflight for native runs; the raw failures are cryptic
# (env!() compile error from build.rs, or "tauri: not found").
if [ "$platform" = linux ] && [ "$sub" != check ]; then
  [ -f .env ] || { echo "error: .env missing — copy .env.example to .env and fill in TMDB_API_KEY / RAWG_API_KEY" >&2; exit 1; }
  [ -d node_modules ] || { echo "error: node_modules missing — run: npm ci" >&2; exit 1; }
fi

exec "${argv[@]}"
```

Then run: `chmod +x scripts/run.sh` (git records it as mode 100755, the same as `wdev.sh`).

Verify:
```
bash -n scripts/run.sh && echo SYNTAX_OK
node --test scripts/run.test.mjs 2>&1 | grep -E '^# (pass|fail)'
```
Expected: `SYNTAX_OK`, then `# pass 11`, `# fail 0`.

## Task 3: Give `scripts/wdev.sh` a `verify` mode

On WSL, `run.sh verify` delegates to `wdev.sh verify`, which lets the Windows-path translation stay in one place. Replace lines 16–17 of `scripts/wdev.sh`:

```bash
script="dev.ps1"
[ "${1:-dev}" = "build" ] && script="build.ps1"
```
with:
```bash
case "${1:-dev}" in
  dev)    script="dev.ps1" ;;
  build)  script="build.ps1" ;;
  verify) script="verify.ps1" ;;
  *) echo "usage: $0 [dev|build|verify]" >&2; exit 2 ;;
esac
```
Also change the usage comment (lines 5–6) to:
```
# Usage:  WSL$ ./scripts/wdev.sh          (dev)
#         WSL$ ./scripts/wdev.sh build    (release bundles)
#         WSL$ ./scripts/wdev.sh verify   (toolchain test inside the MSVC env)
```

Verify (the `/mnt/[a-z]` guard makes a real run exit 1 on this machine, which is expected here and proves the guard still fires):
```
bash -n scripts/wdev.sh && echo SYNTAX_OK
bash scripts/wdev.sh verify; echo "exit=$?"
```
Expected: `SYNTAX_OK`, then `error: repo must live on a Windows drive (/mnt/<drive>/...), got: /mnt/FILES/Projects/tauri-app` and `exit=1`.

## Task 4: Make the toolchain test platform-aware (RED on this machine)

Replace `scripts/verify-toolchain.test.mjs` entirely:

```js
// scripts/verify-toolchain.test.mjs
// Verifies the build prerequisites for TauriFlix on whichever machine runs it.
//   Windows laptop (via WSL):  WSL$ ./scripts/run.sh verify   (runs scripts/verify.ps1 → Windows node)
//   Arch desktop:              $ ./scripts/run.sh verify       (runs this file with Linux node)
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

// ── Both platforms ────────────────────────────────────────
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
  assert.ok(has(`node_modules/${pkg}`), `node_modules/${pkg} missing — run npm ci on this machine`);
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

test("the launcher scripts exist", () => {
  for (const f of ["scripts/run.sh", "scripts/wdev.sh", "scripts/dev.ps1", "scripts/build.ps1"]) {
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

Run: `node --test scripts/verify-toolchain.test.mjs 2>&1 | grep -E '^not ok|^# (pass|fail|skipped)'`
Expected RED on this machine, with 11 tests total:
- `not ok ... cargo is reachable` (not installed)
- `not ok ... .env supplies ...`
- `not ok ... Tauri CLI native binary ...` (no node_modules)
- `not ok ... launcher scripts exist`, unless Task 2 is done, in which case it is ok
- `not ok ... runbook covers both machines` (no Linux section yet)
- `not ok ... x86_64-unknown-linux-gnu`
- `ok ... WebKitGTK 4.1 stack` and `ok ... cargo dev profile`
- `# skipped 3`

Tasks 5–9 turn the failures green one at a time.

## Task 5: `.env.example` and line-ending guard

Create `.env.example`:
```
# Copy to .env (never commit .env). src-tauri/build.rs bakes these into the
# Rust binary at compile time; both must be non-empty or the crate won't build.
TMDB_API_KEY=
RAWG_API_KEY=
```

Create `.gitattributes`. It stops Git for Windows with `core.autocrlf=true` from checking out shell scripts with CRLF, which breaks `#!/usr/bin/env bash` with `bad interpreter: /usr/bin/env: 'bash\r'`:
```
*.sh text eol=lf
```

Verify:
```
git check-ignore -v .env.example || echo NOT_IGNORED
git check-attr eol scripts/run.sh scripts/wdev.sh
```
Expected: `NOT_IGNORED`, then `scripts/run.sh: eol: lf` and `scripts/wdev.sh: eol: lf`.

## Task 6: Install Rust on the desktop (USER runs; needs sudo)

Tell the user to run these in their own terminal:
```
sudo pacman -S --needed rustup
rustup default stable
```
Verify (agent may run):
```
rustc -vV | grep host
cargo --version
```
Expected: `host: x86_64-unknown-linux-gnu` and `cargo 1.x.y (...)`. If `rustc` is not found in a fish session, open a new terminal: `/usr/bin` already holds the rustup proxies, so no PATH edit should be needed.

## Task 7: Put `.env` on the desktop (USER does it; secret)

The agent must NOT read, print or create key values. The user copies the laptop's repo-root `.env` over a private channel (for example `scp` from the laptop, or a password manager) to `/mnt/FILES/Projects/tauri-app/.env`. Alternatively: `cp .env.example .env` and paste in the keys.

Verify without printing values:
```
grep -cE '^(TMDB_API_KEY|RAWG_API_KEY)=.+' .env
git check-ignore -q .env && echo IGNORED
```
Expected: `2`, then `IGNORED`.

## Task 8: Install JS dependencies (desktop)

Run: `npm ci`
Expected: ends with `added N packages`, and `git status --short package-lock.json` prints nothing. Use `npm ci`, **not** `npm install`, so the lockfile shared with the laptop never churns.

Verify:
```
ls node_modules/@tauri-apps/cli-linux-x64-gnu/package.json
npx tauri build --help | grep -- --no-bundle
```
Expected: the path is echoed, and a help line containing `--no-bundle` appears. If the flag is missing, the installed CLI is not v2.10.x: stop and report.

## Task 9: First Rust compile (slow once)

Run: `cd src-tauri && cargo check --locked; cd ..`
Expected: `Finished \`dev\` profile ... target(s) in ...`. The first run takes several minutes because dependencies are built at `opt-level = 3`. If it errors with `environment variable TMDB_API_KEY not defined at compile time`, Task 7 is not done.

Then run the toolchain test again:
```
./scripts/run.sh verify 2>&1 | grep -E '^not ok|^# (pass|fail|skipped)'
```
Expected: only `not ok ... runbook covers both machines` remains (fixed in Task 11), then `# pass 7`, `# fail 1`, `# skipped 3`.

## Task 10: Run the app natively (manual smoke test)

Run: `./scripts/run.sh dev`
Expected terminal output: Vite `ready` on `http://localhost:1420/`, then cargo `Running \`target/debug/tauri-app\``.

Check these by hand:
1. A native window titled `tauri-app` opens (800×600) with the dark red TauriFlix UI.
2. The Movies tab shows genre carousels with posters (this proves the TMDB key was baked in).
3. Switching to Jogos (games) loads posters (RAWG key), and Anime/Livros load (keyless APIs).
4. Clicking a card opens the detail page, and "← Voltar" returns.
5. Editing a string in `src/routes/+page.svelte` hot-reloads without restarting the window. Revert the edit.
6. `Ctrl+C` in the terminal closes both Vite and the app.

If the window is blank or white, or the log shows `DMABUF`/`GBM` errors (a known WebKitGTK issue on some Wayland + AMD setups), retry with:
```
env WEBKIT_DISABLE_DMABUF_RENDERER=1 ./scripts/run.sh dev
```
If that fixes it, record this in the runbook's troubleshooting table (Task 11). Do NOT hardcode it into `run.sh` unless the user confirms it is needed every time.

## Task 11: Update the runbook (`docs/BUILD_AND_RUN.md`)

1. Replace the H1 and TL;DR (lines 1–10) with:

````markdown
# Building and running TauriFlix

Two supported machines, one command:

```
./scripts/run.sh            # dev mode, hot reload
./scripts/run.sh build      # release build
./scripts/run.sh check      # svelte-check
./scripts/run.sh verify     # toolchain test for this machine
```

`scripts/run.sh` detects the machine by checking `/proc/sys/kernel/osrelease`:

| Machine | Detected as | What actually runs |
| --- | --- | --- |
| Arch desktop (native Linux) | `linux` | Tauri CLI locally: Rust `x86_64-unknown-linux-gnu` + WebKitGTK 4.1 |
| Windows 11 laptop, editing in WSL | `wsl` | `scripts/wdev.sh` → PowerShell → MSVC + WebView2 on Windows |

Force a platform with `TF_PLATFORM=linux|wsl` (in fish: `env TF_PLATFORM=wsl ./scripts/run.sh dev`).
Add `--dry-run` to print the command without running it.

## Linux native (Arch desktop)

One-time setup:

```
sudo pacman -S --needed rustup webkit2gtk-4.1 libsoup3 base-devel openssl librsvg
rustup default stable
cp .env.example .env        # then fill in TMDB_API_KEY and RAWG_API_KEY
npm ci                      # never `npm install`: keeps the shared lockfile stable
./scripts/run.sh verify     # expect: # pass 8, # skipped 3
```

- `./scripts/run.sh build` runs `tauri build --no-bundle`, which produces `src-tauri/target/release/tauri-app`.
  No `.deb`/AppImage is built; run the binary directly.
- Build artefacts (`src-tauri/target/`) and `node_modules/` are per machine and are never shared or committed.
- Wayland: if the window is blank or white, run `env WEBKIT_DISABLE_DMABUF_RENDERER=1 ./scripts/run.sh dev`.
  As a last resort, add `GDK_BACKEND=x11` as well.

## Windows laptop (WSL → Windows)

Edit code in WSL. Build and run on Windows. One shared NTFS working tree, no sync step.
`./scripts/run.sh dev|build|verify` calls `./scripts/wdev.sh dev|build|verify`, which still works directly.
````

2. In the "Daily workflow" table, add a first column header `Machine` and prefix the existing rows with `laptop`. Add these rows:

```
| desktop | Run the app             | Arch   | `./scripts/run.sh`                         |
| desktop | Release binary          | Arch   | `./scripts/run.sh build`                   |
| desktop | Rust typecheck          | Arch   | `cd src-tauri && cargo check --locked`     |
```

3. In "Troubleshooting", add:

```
| `bad interpreter: /usr/bin/env: 'bash\r'`    | script checked out with CRLF | `.gitattributes` forces LF; re-checkout: `git checkout -- scripts/*.sh` |
| Blank/white window on Arch (Wayland)         | WebKitGTK DMA-BUF renderer   | `env WEBKIT_DISABLE_DMABUF_RENDERER=1 ./scripts/run.sh dev` |
| `error: .env missing` / `node_modules missing` from run.sh | first run on a new machine | see "Linux native" one-time setup |
```

Leave every other section as it is. The existing test regexes for `x86_64-pc-windows-msvc` and `WSLg` must still match.

4. `src-tauri/.cargo/config.toml` lines 1–3: replace the comment with:
```
# src-tauri/.cargo/config.toml
# Build settings shared by both machines (see docs/BUILD_AND_RUN.md).
# The MSVC-only flags below are target-scoped and ignored by the Linux build.
```

Verify:
```
./scripts/run.sh verify 2>&1 | grep -E '^not ok|^# (pass|fail|skipped)'
```
Expected: `# pass 8`, `# fail 0`, `# skipped 3`.

## Task 12: README and notes pointers

- `README.md` → "Getting Started" code block: replace `npm run tauri dev` with
  ```
  cp .env.example .env   # fill in the two keys
  npm ci
  ./scripts/run.sh       # native Linux, or WSL → Windows on the laptop
  ```
  Also replace the "Building" block's `npm run tauri build` with `./scripts/run.sh build` and the comment `# see docs/BUILD_AND_RUN.md for per-machine output`.
- `docs/notes/Config and Stack.md`, section "8. System requirements", "Linux native" bullet: replace `patchelf` in the Arch package list with `libsoup3 openssl` and add a sentence: "Then `./scripts/run.sh verify`; the runbook is [BUILD_AND_RUN.md](../BUILD_AND_RUN.md)." `patchelf` is only needed for AppImage bundling, which this plan does not use.

Verify: `node --test scripts/docs-notes.test.mjs 2>&1 | grep -E '^# (pass|fail)'`. Expected: `# pass 6`, `# fail 0` (the file-path checker confirms `scripts/run.sh` exists).

## Task 13: Release build on the desktop

Run: `./scripts/run.sh build`
Expected: this ends with `Finished \`release\` profile` and **no** `Bundling` lines. Then:
```
ls -lh src-tauri/target/release/tauri-app
./src-tauri/target/release/tauri-app
```
Expected: an executable of roughly 10–20 MB (stripped, thin LTO). The window opens and Movies load without Vite running, which proves the frontend is embedded.

## Task 14: Full desktop verification

```
node --test scripts/run.test.mjs scripts/verify-toolchain.test.mjs scripts/no-auth.test.mjs scripts/docs-notes.test.mjs 2>&1 | grep -E '^# (pass|fail|skipped)'
npm run check 2>&1 | tail -1
npm run build 2>&1 | tail -2
git status --short
```
Expected:
- tests: `# pass 32` (11 + 8 + 7 + 6), `# fail 0`, `# skipped 3`
- `svelte-check found 0 errors and 0 warnings`
- `✓ built` / `Wrote site to "build"`
- git status shows only:
  - `M README.md`, `M docs/BUILD_AND_RUN.md`, `M docs/notes/Config and Stack.md`
  - `M scripts/verify-toolchain.test.mjs`, `M scripts/wdev.sh`, `M src-tauri/.cargo/config.toml`
  - `?? .env.example`, `?? .gitattributes`, `?? scripts/run.sh`, `?? scripts/run.test.mjs`
  - this plan file

  There must be NO `package-lock.json` change and NO `.env`.

## Checkpoint (desktop)

Stop and report. Suggested commit message for the user: `chore(build): cross-machine launcher for Arch desktop and WSL laptop`.

## Task 15: Laptop verification (next time the user is on Windows; cannot be done from here)

Give the user this checklist. After `git pull` inside WSL on the laptop:
1. `git check-attr eol scripts/run.sh` → `eol: lf`, and `head -1 scripts/run.sh | od -c | head -1` shows no `\r`.
2. `./scripts/run.sh --dry-run dev` → `scripts/wdev.sh dev` (auto-detected as WSL).
3. `node --test scripts/run.test.mjs`, using WSL's Linux node → `# pass 11`.
4. `./scripts/run.sh verify` → runs Windows node through `verify.ps1`; expect `# pass 9`, `# skipped 2`, `# fail 0`.
5. `./scripts/run.sh` → the Windows app opens exactly as before. `./scripts/run.sh build` → MSI and NSIS under `src-tauri\target\release\bundle\`.
6. Do **not** run `npm ci` from WSL. The laptop rule stays "install dependencies from Windows" (see the runbook section "node_modules is shared between two Node versions").

---

## Risks, tradeoffs, open questions

- **Wayland + dual AMD GPU.** WebKitGTK 2.52 on Wayland usually works, but DMA-BUF issues are the most likely first-run failure. The documented fix is an environment variable, not a code change. If the webview uses the Raphael iGPU instead of the RX 9070, `DRI_PRIME=1` may help. This is untested here, so it is only mentioned.
- **Two dev machines, one lockfile.** `npm ci` on Arch never rewrites `package-lock.json`. A deliberate `npm install <pkg>` on either machine is fine, because npm 7+ records optional binaries for all platforms. Only the laptop's shared-`node_modules` quirk needs the "install from Windows" rule.
- **No Linux bundles.** `--no-bundle` is a deliberate YAGNI. If the user later wants an installable Arch package, add a `PKGBUILD` or an AppImage (which needs `patchelf`) in separate work.
- **API keys are compiled in.** Both machines need their own `.env`, and a changed key means rebuilding. `run.sh` checks only that `.env` exists. The toolchain test checks that the keys are non-empty, without printing them.
- **Auto-detection is heuristic.** `/proc/sys/kernel/osrelease` containing `microsoft` is the standard WSL test (WSL2 kernels are `*-microsoft-standard-WSL2`). `TF_PLATFORM` is the escape hatch.
- **The PowerShell scripts repeat the vcvars block three times.** That DRY debt already exists, and this plan leaves it alone so the laptop path stays byte-identical. A follow-up could extract `scripts/msvc-env.ps1`.
- **Four tracked files have CRLF line endings** (including `src/lib/stores/ui.svelte.ts` and `src/routes/+layout.svelte`). This is harmless to both toolchains and out of scope. `.gitattributes` only pins `*.sh`, to avoid renormalising unrelated files.
- **Open question:** should `run.sh build` on Linux produce an installable package instead of a bare binary? Assumed no.
