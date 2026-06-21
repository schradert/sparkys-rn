#!/usr/bin/env bash
#
# Upgrade the Expo SDK to a target major version, then print the matching
# devenv Android pins.
#
# Usage: scripts/upgrade-expo.sh <target-sdk-major>   (e.g. 56)

set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "usage: scripts/upgrade-expo.sh <target-sdk-major>   (e.g. 56)" >&2
  exit 2
fi

# bun/expo only exist inside the devenv shell.
if ! command -v bun >/dev/null 2>&1; then
  exec devenv shell -- bash "$0" "$@"
fi

run() { echo; echo "==> $*"; "$@"; }

# Keep bun as the single lockfile.
[[ -f yarn.lock ]] && run rm -f yarn.lock

# Bump Expo and let it set the versions of the dependencies it manages.
run bunx --bun expo install "expo@^${TARGET}.0.0"
run bunx --bun expo install --fix
run bunx --bun expo install @types/react eslint-config-expo || true

# Clean reinstall to de-dupe native modules.
run rm -rf node_modules bun.lock
run bun install

# Print the devenv.nix Android pins, read from the installed native code.
NDK="$(sed -nE 's/^ndkVersion *= *"([^"]+)".*/\1/p' \
  node_modules/react-native/gradle/libs.versions.toml 2>/dev/null || true)"
COMPILE="$(sed -nE 's/.*safeExtGet\("compileSdkVersion", *([0-9]+)\).*/\1/p' \
  node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle 2>/dev/null | head -1 || true)"
echo
echo "==> devenv.nix android pins for SDK ${TARGET} (edit devenv.nix, then re-enter the shell):"
cat <<EOF
  buildTools.version = ["${COMPILE:-?}.0.0"];
  ndk.version        = ["${NDK:-?}"];
  platforms.version  = ["${COMPILE:-?}"];
EOF

# Validate. Follow expo-doctor for any required follow-ups (new native peers,
# removed app.json keys, non-Expo tooling majors to pin back).
run bunx --bun expo-doctor || true
run bunx --bun tsc --noEmit || true
run bunx --bun eslint . || true
