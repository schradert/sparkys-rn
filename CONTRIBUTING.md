# Contributing

## Setup

See [README.md](README.md) — install Nix + devenv + direnv, run `direnv allow`
(or `devenv shell`), then `bootstrap`. All commands below run inside the devenv
shell.

## Branching & commits

- **Never commit to `trunk`.** A git hook blocks it — branch first
  (`git checkout -b feat/short-description`).
- Commits are linted by **commitizen** (Conventional Commits). Use
  `type(scope): summary`, e.g. `fix(inventory): correct archived filter`.
  Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `build`, `ci`.

## Quality gates

Run these before pushing (they also run automatically — see Hooks):

```bash
bun run typecheck     # tsc --noEmit (run `bun run dev` once first to gen route types)
bun run check         # biome: format + lint + import organization
bun run lint          # eslint: React/Expo semantics
bun run test          # jest
```

`bun run check:fix` and `bun run lint:fix` auto-apply safe fixes.

### Why two linters

Biome and ESLint are split so they never report the same issue twice:

- **Biome** (`biome.json`) owns formatting, import organization, and general
  JS/TS lint (unused vars, array style, correctness/suspicious).
- **ESLint** (`eslint.config.js`) owns only what Biome can't: React /
  React Native / Expo semantics (rules of hooks, the import graph, etc.).

When adding a rule, decide which tool owns that category and disable it in the
other if it overlaps.

## Testing

- Runner: **Jest** with the `jest-expo` preset; component tests use
  **React Native Testing Library** (RNTL 14).
- **RNTL 14 is async** — `await render(...)` and `await fireEvent.*(...)`. Its
  `test-renderer` backend uses an async `act`, so without `await` you get an
  empty result and `screen` queries throw "render has not been called". See
  `components/__tests__/Button.test.tsx` for the pattern.
- Put tests in `__tests__/` next to the code, named `*.test.ts(x)`.
- The pure-logic core (`constants/`, `store/`, `services/`) is the easiest and
  highest-value place to add coverage — those modules have no native deps.
- Coverage thresholds in `jest.config.js` are a **ratchet**: raise them as
  coverage grows rather than letting it slip. Check `bun run test:coverage`.

## Dependencies (two tracks — no wildcards)

- **Expo-governed** (`expo`, `expo-*`, `react*`, RN libs, `@types/react`,
  `eslint-config-expo`, `jest-expo`, `@babel/core`): change only via
  `expo install` (or `expo install --dev`).
- **Free tooling** (`eslint`, `typescript`, `typedoc`, `jest`,
  `@testing-library/*`): caret ranges + `bun update`, pinning back any major the
  SDK can't handle yet.

Upgrading the SDK is scripted — see `scripts/upgrade-expo.sh` and the
`upgrade-expo-sdk` skill.

## Git hooks (devenv git-hooks)

| Stage | Hooks |
| --- | --- |
| pre-push | biome, tsc, eslint, jest, plus the builtins (large files, merge conflicts, EOF, typos, markdownlint, lychee, gitleaks `protect`, alejandra/deadnix/statix for Nix) |
| manual | `expo-doctor`, `security-scan` — run with `pre-commit run --hook-stage manual <id>` |

Run all push-stage hooks manually with `pre-commit run --all-files`.

## AI skills

Claude Code task playbooks live in `.claude/skills/` — `onboarding`,
`dev-workflow`, `eas-release`, `generate-docs`, `security-scan`, `ci-workflows`,
and `upgrade-expo-sdk` — each encoding one of the workflows above so it can be
invoked by name.

## Security

`security` scans JS dependencies (bun audit, osv-scanner), the Nix toolchain
(vulnix), and the repo for secrets (gitleaks). Run it before a release.

## Before opening a PR

- [ ] `bun run typecheck` clean
- [ ] `bun run check` and `bun run lint` clean
- [ ] `bun run test` passing, coverage not regressed
- [ ] `doctor` (expo-doctor) reviewed
- [ ] Commits follow Conventional Commits
