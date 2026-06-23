---
name: ci-workflows
description: The GitHub Actions setup for this Expo project — `ci.yml` (the correctness gates mirroring the local pre-push hooks) and `build.yml` (Android APK + iOS simulator artifacts), their triggers and jobs, and inspecting runs with `gh`. Use when changing CI, debugging a failed run, or finding build artifacts.
---

# CI workflows (GitHub Actions)

Two workflows live in `.github/workflows/`. Both run on stock GitHub runners
and need **no secrets** (the repo is public; the build is self-contained via
`expo prebuild`).

## `ci.yml` — correctness gates

- **Triggers:** `pull_request` + `push` to `trunk`. Concurrency cancels
  in-progress runs per ref.
- **`check`** (`Typecheck · Lint · Format · Test`): bun install → briefly start
  Metro to generate typed routes → `bun run typecheck` (tsc) → `bun run lint`
  (ESLint) → `bun run check` (Biome) → `bun run test` (Jest). This **mirrors the
  local pre-push git-hooks**, so PRs are gated server-side even if a contributor
  skipped the hooks or pushed `--no-verify`.
- **`audit`** (`Dependency audit (advisory)`): `bun audit`, `continue-on-error`
  → **non-blocking**, informational only. (See the `security-scan` skill.)
- **`lint-langs`** (`Shell · YAML · TOML`): via `nix run` — `actionlint`
  (workflows), `shellcheck` + `shfmt` (`scripts/upgrade-expo.sh`), `taplo fmt
  --check` (TOML), `yamllint` (workflows + `devenv.yaml`).

Recommended: make **`check`** a required status check on `trunk` to enforce it.

## `build.yml` — app artifacts

- **Triggers:** `push` to `trunk` + `workflow_dispatch` (Actions tab).
- **`android`** (ubuntu): `expo prebuild` → installs the matching NDK → Gradle
  `assembleRelease` for **arm64-v8a only** (compiling all four ABIs dominates
  the build, so this roughly quarters it). Uploads a (debug-signed) release APK
  as the **`android-apk`** artifact (30-day retention). Caches the bun store and
  `~/.gradle`.
- **`ios`** (macOS): selects latest Xcode → `expo prebuild` → `pod install`
  (modular headers) → `xcodebuild` Release for the **arm64 simulator** (unsigned)
  → zips the `.app`. Uploads **`ios-simulator-app`** (30-day retention). Caches
  bun + CocoaPods.

These are CI test artifacts, not store builds. **Signed / multi-ABI store
builds** come from the EAS `build-prod` profile (see the `eas-release` skill).

## Inspecting runs

```bash
gh run list --workflow=ci.yml          # recent CI runs
gh run list --workflow=build.yml       # recent build runs
gh run view <run-id>                   # job/step status for a run
gh run view <run-id> --log-failed      # logs for failed steps
gh run download <run-id>               # pull down build artifacts (APK / .app zip)
```
