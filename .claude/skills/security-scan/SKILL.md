---
name: security-scan
description: Running the dependency/secret/toolchain security scans for this Expo + devenv project — the `security` devenv script (bun audit, osv-scanner, vulnix, gitleaks), the pre-push gitleaks gate, the advisory CI audit job, and the two known unfixable transitive advisories. Use when auditing dependencies or secrets, or interpreting a red `audit` job.
---

# Security scanning (devenv + bun + Expo)

All scanners live in the **devenv** shell. Run them inside it (`direnv allow`
once, or `devenv shell`); from outside use `devenv shell -- bash -c '<cmd>'`.

## The `security` script

`security` (a devenv script, run by bare name) runs four scans in sequence
(defined in `devenv.nix`). Each is `|| true`, so the script always finishes —
read the output, don't trust the exit code:

- **`bun audit`** — JS dependency CVEs (from `bun.lock`).
- **`osv-scanner --lockfile=bun.lock`** — lockfile CVEs (OSV database).
- **`vulnix --gc-roots`** — Nix toolchain CVEs.
- **`gitleaks detect --redact --no-banner`** — secret scan over **full git
  history**.

Two ways to invoke:

```bash
security                                          # inside the devenv shell
pre-commit run --hook-stage manual security-scan  # via git-hooks (entry = security)
```

## Git-hook & CI surfaces

- **pre-push `gitleaks protect`** — the `gitleaks` git-hook runs
  `gitleaks protect --redact` on the **staged diff** (not full history), so new
  secrets are blocked before they're pushed. (Full-history `detect` is the
  `security` script above.)
- **CI `audit` job** (`.github/workflows/ci.yml`) — runs `bun audit` on every PR
  and push to trunk. It is `continue-on-error: true`, so it is **advisory /
  non-blocking**: a red `audit` job is informational, never a merge gate. The
  blocking gates are in the `check` job.

## Known advisories (not directly fixable)

Two transitive advisories are expected and **cannot be fixed directly** (they
come in through pinned upstreams, not our direct deps) — don't chase them:

- **uuid** — pulled in via Expo's `xcode` dependency.
- **js-yaml** — pulled in via `eslint` / `jest` (`babel-istanbul`).

If `bun audit` (or the CI `audit` job) is red only because of these, that's the
known baseline. Investigate anything else.
