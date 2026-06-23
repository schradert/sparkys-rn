---
name: onboarding
description: First-time setup of this Expo SDK 56 / React Native project on a new machine — the Nix/devenv/direnv prerequisites, loading the toolchain, `bootstrap`, launching the editor from inside the shell so LSPs resolve, and the first `bun run dev`. Use when setting up the repo for the first time on a new machine.
---

# Onboarding (first-time setup)

The **entire** toolchain — bun, the Expo CLI, the Android SDK/NDK, Java,
fastlane, `eas`, scanners, LSPs — is provided by **devenv**. You do not install
Node, bun, or the Android SDK by hand.

## 1. Prerequisites

Install these on the machine first (see README "Prerequisites"):

- [Nix](https://nixos.org/download) **with flakes enabled**
- [devenv](https://devenv.sh/getting-started/)
- [direnv](https://direnv.net) (recommended — auto-loads the shell on `cd`)

## 2. Load the toolchain

```bash
direnv allow        # one-time; loads the devenv shell on cd (via .envrc)
# …or, without direnv:
devenv shell        # drop into the toolchain manually
```

Everything below assumes you're **inside** the devenv shell. The shell prints
its common commands on entry. One-off from outside:
`devenv shell -- bash -c '<command>'`.

## 3. Bootstrap

```bash
bootstrap           # bun install + generate typed-route types + expo-doctor
```

`bootstrap` (a devenv script) installs deps, briefly runs Metro to generate the
expo-router typed-route types (they're git-ignored, so a fresh checkout has
none), and runs `expo-doctor`.

## 4. Open your editor from inside the shell

Launch your editor **from inside the devenv shell** so its language servers
resolve from the toolchain (`node_modules/.bin`, `nixd`). Config ships for three:

- **VS Code** — `.vscode/` (committed)
- **Zed** — `.zed/settings.json` (devenv-generated, git-ignored)
- **Helix** — `.helix/languages.toml` (devenv-generated, git-ignored)

The Zed/Helix files appear only once you've entered the shell.

## 5. Run it

```bash
bun run dev         # Metro for the development variant
```

Then press `i`/`a` in the Metro CLI (or scan the QR with a development build).

## Next

For daily work — variants, lint/typecheck/test, git-hook gates, helper scripts —
see the **`dev-workflow`** skill.
