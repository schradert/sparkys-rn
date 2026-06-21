---
name: eas-release
description: Build, distribute and OTA-update this Expo app with EAS in the devenv setup — the development/preview/production variants (APP_VARIANT + eas.json), cloud vs local builds, and `eas update`. Use when building an APK/IPA, making a dev/preview/internal build, submitting to a store, or shipping an over-the-air update.
---

# EAS release (variants + builds + updates)

`eas` is provided by the devenv shell. Auth once with `eas login` (or set
`EXPO_TOKEN`). The Expo account/owner is `exponentialism` and the EAS project id
is in `app.json` (`extra.eas.projectId`).

## How variants work

`app.config.js` reads **`APP_VARIANT`** and derives the app name + bundle id:

| `APP_VARIANT` | Name | Bundle id suffix |
| --- | --- | --- |
| `development` | `InvX (Dev)` | `.dev` |
| `preview` | `InvX (Preview)` | `.preview` |
| (unset) | `InvX: Sparky's Inventory` | (none, production) |

So all three install side by side on one device. Each variant's build config and
env (notably `EXPO_PUBLIC_SPREADSHEET_ID`, which points dev at a scratch sheet
and preview/prod at the real sheet) live in [`eas.json`](../../../eas.json)
build profiles: `development`, `preview`, `production`, `ios-simulator`.

## Builds

devenv scripts wrap the common profiles (run by bare name in the shell):

```bash
build-dev          # eas build --profile development --platform all   (cloud)
build-preview      # eas build --profile preview --platform all       (cloud)
build-prod         # eas build --profile production --platform all     (cloud)
build-dev-local    # eas build --profile development --platform android --local
```

- **development** = `developmentClient: true`, internal distribution → a dev
  build that loads Metro. This is what you install to run `bun run dev` against.
- **preview** = internal distribution, Android `apk` → shareable test build.
- **production** = store build, `autoIncrement` on.
- **Local builds** need the native toolchain; Android works in the devenv shell,
  iOS local builds need macOS + the (darwin-gated) cocoapods/fastlane. Prefer
  cloud builds unless you specifically need local.

For an ad-hoc profile/platform just call `eas build --profile <p> --platform <ios|android|all>`.

## Over-the-air updates

```bash
eas-update         # eas update   (publish a JS-only OTA update)
```

Use `eas update` for JS/asset changes that don't touch native code. Anything
that changes native deps, config plugins, permissions, or the bundle id needs a
new **build**, not an update. `eas.json` uses `appVersionSource: remote`, so EAS
owns the build number.

## Submitting

`eas submit --profile production` (the `submit.production` profile in
`eas.json`). Provide store credentials via EAS or interactively.

## Pre-release checklist

1. `bun run typecheck` + `bun run check` + `bun run lint` + `bun run test` clean.
2. `doctor` (expo-doctor) — resolve config/asset issues. (Note: the icon-asset
   check stays red until square `icon.png` / `adaptive-icon.png` are supplied.)
3. `security` — review dependency CVEs + secret scan.
4. Build the right variant; smoke-test on device before promoting.
