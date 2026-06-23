---
name: generate-docs
description: Generating this project's API documentation with TypeDoc (`bun run docs` → `docs/api`), what's in `typedoc.json`, why the output is git-ignored, and the eslint-plugin-jsdoc rule that enforces source-level TSDoc. Use when generating or updating API docs, or when the jsdoc lint rule fails.
---

# API docs (TypeDoc)

Toolchain lives in the **devenv** shell — run inside it (`direnv allow` once, or
`devenv shell`).

## Generating

```bash
bun run docs        # typedoc → HTML in docs/api
```

`bun run docs` runs `typedoc` (no args; config is `typedoc.json`). Output is a
static HTML site under **`docs/api`**.

## Config (`typedoc.json`)

- **`entryPoints`**: `constants`, `hooks`, `services`, `store` — with
  `entryPointStrategy: "expand"`, so TypeDoc walks each of those directories.
- **`out`**: `docs/api`. **`tsconfig`**: `tsconfig.json`.
- Excludes `__tests__` and `*.test.ts(x)`; `excludePrivate` + `excludeInternal`
  on; `readme: "none"`, `hideGenerator`, `skipErrorChecking`.

## `docs/api` is git-ignored

`docs/api/` is in `.gitignore` (under "testing & docs (generated)") — the site
is **not committed**. Regenerate it locally whenever you need it, and **after
changing any public API** in the entry-point directories.

## Source TSDoc is lint-enforced

Generating good docs depends on source-level TSDoc, which is a **hard lint
gate**, not optional. `eslint.config.js` enables `eslint-plugin-jsdoc`'s
`jsdoc/require-jsdoc` rule as an **error** with `publicOnly: true`: every
exported function, class, method, component, arrow/function expression, plus
exported `interface` / `type` aliases must carry a TSDoc block. Tests and
`test-support/**` are exempt.

If `bun run lint` fails on `jsdoc/require-jsdoc`, add a `/** … */` block to the
flagged export (it's the 100% doc baseline guarding against regressions).
