---
name: upgrade-expo-sdk
description: Upgrade this project's Expo SDK / React Native version, plus the matching devenv Android toolchain pins, in our devenv + bun setup. Use when bumping the Expo SDK, updating React Native, "trying the latest Expo", or refreshing dependencies to a new SDK. Covers the two-track dependency model (expo install vs caret tooling), where the Android NDK/SDK versions actually come from, and the devenv git-hooks / allowUnfree gotchas.
---

# Upgrade Expo SDK (devenv + bun)

A playbook for moving this app to a newer Expo SDK. There is a companion script,
`scripts/upgrade-expo.sh <target-major>`, that performs the mechanical steps and
prints the values you need; this skill is the reasoning around it.

## Project shape (why this isn't a generic upgrade)

- **Managed Expo workflow.** `android/` and `ios/` are gitignored and generated
  by `expo prebuild`. So the native Android versions (compileSdk, buildTools,
  ndk) are **not in the repo** — they come from the installed Expo SDK / RN, and
  we mirror them by hand into `devenv.nix` so local builds find the right tools.
- **bun** is the package manager (via `languages.javascript.bun` in devenv).
- **devenv** provides the shell; `bun`/`expo` only exist inside `devenv shell`.
  Run project commands as `devenv shell -- bash -c '...'`.
- Config is `app.config.js` (dynamic) spreading `app.json` (static). The
  `plugins` array lives in `app.json` and flows through.

## The dependency philosophy (two tracks — no wildcards)

| Track | Packages | How to update |
| --- | --- | --- |
| **Expo-governed** | `expo`, `expo-*`, `react`, `react-dom`, `react-native`, RN community libs (`react-native-gesture-handler`, `reanimated`, `screens`, `safe-area-context`, `webview`, `view-shot`, `web`), `@react-native-google-signin/*`, `@expo/vector-icons`, `@types/react`, `eslint-config-expo`, `@babel/core` | **`expo install` only.** It picks the SDK-validated version (which is often *not* npm-latest). Never hand-edit. |
| **Free tooling** | `eslint`, `typescript`, `@expo/ngrok`, `dom-to-image` | Caret ranges + `bun update`. But **pin back any major the SDK toolchain can't handle yet.** |

Do **not** switch package.json to `"*"` ranges. `expo-doctor` validates the
Expo-governed set against the SDK's `bundledNativeModules.json`; wildcards make
`bun update` pull SDK-incompatible versions and break native builds silently.

## Steps

1. **Make sure the devenv eval is healthy.** If a recent `devenv update` broke it:
   - `git-hooks` assertion → `devenv inputs add git-hooks github:cachix/git-hooks.nix --follows nixpkgs`
   - then confirm `devenv.yaml` still has `allowUnfree: true` (the inputs-add
     command has rewritten it to the **ignored** `allow_unfree`, which then
     blocks the unfree `android-sdk-cmdline-tools`).
2. **One lockfile.** Remove a stale `yarn.lock` (bun is canonical; bun even tells
   you to). Keep only `bun.lock`.
3. **Bump the SDK:** `bunx expo install expo@^<major>.0.0` then
   `bunx expo install --fix` (realigns every Expo-governed dep).
4. **Governed devDeps:** `bunx expo install @types/react eslint-config-expo`.
5. **Clean reinstall** to dedupe native modules: `rm -rf node_modules bun.lock && bun install`.
6. **Update `devenv.nix` Android pins** to the new SDK. Source of truth:
   - NDK → `node_modules/react-native/gradle/libs.versions.toml` (`ndkVersion`).
   - compileSdk / targetSdk → `node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle` (`safeExtGet("compileSdkVersion", N)`).
   - buildTools → AGP default `"<compileSdk>.0.0"`.
   None of the three can be dropped (devenv's defaults diverge), but the delta is
   usually 1–2 lines. Re-enter `devenv shell` to realize them.
7. **Validate:** `bunx expo-doctor` (authoritative), then `tsc --noEmit` and
   `eslint .` (report). Run `bun dev` once to regenerate typed-route types
   (`.expo/types`, `expo-env.d.ts`) before trusting `tsc`.

## Gotchas seen going 53 → 56 (RN 0.79 → 0.85)

- **Toolchain majors outran the SDK:** had to pin `@babel/core` back to `^7.x`
  (SDK requires it), `eslint` to `^9` (ESLint 10 removed `context.getFilename()`,
  crashing `eslint-plugin-react`), `typescript` to `~5.9`.
- **Reanimated 4** split out a peer: `bunx expo install react-native-worklets`.
- **expo-router dropped react-navigation compat (SDK 56):** removed the unused
  direct `@react-navigation/*` deps (no code imported them).
- **app.json schema:** removed `newArchEnabled` and android `edgeToEdgeEnabled`
  (both always-on now); added `expo-font`/`expo-image`/`expo-status-bar`/
  `expo-web-browser` to the `plugins` array.
- **NDK didn't change** (RN 0.79 and 0.85 both use `27.1.12297006`); only
  buildTools/platform moved 35 → 36.
- Pre-existing `tsc`/`eslint` errors in app code are separate from the upgrade —
  don't attribute them to it.
