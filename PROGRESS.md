# Progress

> Last updated: 2026-11-10
>
> Legend: ✅ done · 🔄 in progress · ⬜ not started

A TypeScript monorepo template that every portfolio project starts from. This log records each step, the decisions behind it and the issues met along the way.

## Steps

| #   | Step                                                                             | Branch                 | Status |
| --- | -------------------------------------------------------------------------------- | ---------------------- | ------ |
| 1   | pnpm workspace, Turborepo, shared tsconfig, MIT license                          | `main`                 | ✅     |
| 2   | Shared ESLint and Prettier configs                                               | `main`                 | ✅     |
| 3   | CI on pull requests and `main`, `Protect main` ruleset                           | `main`                 | ✅     |
| 4   | `@repo/ui` sample with Vite library mode, Vitest and Testing Library             | `feat/ui-package`      | ✅     |
| 5   | Conventional Commits (commitlint + husky), PR title re-check, PR and issue forms | `chore/conventions`    | ✅     |
| 6   | Local PostgreSQL 18 with Docker Compose and `db:*` scripts                       | `chore/local-postgres` | ✅     |
| 7   | Next.js presets                                                                  | `feat/next-presets`    | ✅     |
| 8   | Vite app presets                                                                 | `feat/vite-presets`    | ✅     |
| 9   | Dependabot for npm and GitHub Actions                                            | `chore/dependabot`     | ✅     |
| 10  | README and this progress log                                                     | `docs/readme`          | ✅     |

Steps 1–3 were pushed straight to `main`, then the ruleset was applied; every later step is a pull request with a green `Verify` check, merged with rebase.

## Decisions

| Decision                                                            | Reason                                                                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Node 24 LTS                                                         | Node 26 is not LTS yet. Upgrading later only touches `.nvmrc` and `engines`                                                          |
| TypeScript 6.0.x instead of 7.0                                     | typescript-eslint only supports `<6.1.0`, and TS 7 has no stable programmatic API yet                                                |
| No Corepack                                                         | Node 25+ no longer bundles Corepack                                                                                                  |
| Internal package scope `@repo/*`                                    | Turborepo convention; keeps the repo usable as a template                                                                            |
| `@eslint-react` instead of `eslint-plugin-react`                    | `eslint-plugin-react` does not support ESLint 10 yet                                                                                 |
| React ESLint preset `strict-type-checked`                           | Matches the strict TypeScript preset; `recommended` misses rules such as `dom-no-missing-button-type`                                |
| No `eslint-plugin-react-hooks`                                      | `@eslint-react` already ships the hooks rules; using both reports every issue twice                                                  |
| Prettier `printWidth: 100`, other options default                   | The default of 80 wraps JSX too aggressively                                                                                         |
| Conventions enforced twice: husky hook locally and commitlint in CI | Hooks can be skipped (`--no-verify`) or missing on a fresh clone; CI cannot                                                          |
| PostgreSQL `postgres:18` (Debian), port bound to `127.0.0.1`        | Latest stable major; Debian matches typical glibc production hosts; the database is not exposed to the local network                 |
| GitHub Actions pinned to commit SHAs (with a `# vX.Y.Z` comment)    | A tag can be moved to point at different code; a SHA cannot. Dependabot keeps the SHAs current                                       |
| MIT license                                                         | A public repo without a license is all rights reserved; MIT lets others reuse the template with attribution                          |
| `@repo/ui` built with Vite library mode, `tsc` for declarations     | Vite empties `dist/` before each build, so stale files from renamed sources never ship; one module per file keeps apps tree-shakable |
| `@next/eslint-plugin-next` directly, not `eslint-config-next`       | The plugins bundled with `eslint-config-next` do not support ESLint 10 yet                                                           |
| commitlint ignores Dependabot commits                               | Their bodies carry release notes with lines over the 100-character limit; headers already follow the configured prefixes             |
| No Co-Authored-By trailer in commits                                | Maintainer's preference                                                                                                              |
| Dependabot ignores TypeScript ≥6.1 and @types/node majors           | typescript-eslint supports TypeScript <6.1.0; Node types must match the Node 24 runtime                                              |

## Follow-ups

- [ ] Upgrade to **Node 26** once it becomes LTS
- [ ] Upgrade to **TypeScript 7** once typescript-eslint supports it
- [ ] Extract the shared setup steps (checkout, pnpm, Node, install) of the workflows into a composite action

## Issue log

- **2026-10-22:** the two React plugins reported every hooks rule twice. Fixed by dropping `eslint-plugin-react-hooks`.
- **2026-10-22:** the `recommended-type-checked` React preset did not flag a `<button>` without `type`. Switched to `strict-type-checked`.
- **2026-10-22:** Turbo warned that `test` produced no files for `outputs: ["coverage/**"]`. Set `test` outputs to `[]`; coverage has its own task.
- **2026-10-23:** `git@github.com` authenticates as a different default account, not the repo owner `ductmOfficial`. The remote uses the SSH alias `github-ductmofficial`.
- **2026-10-23:** pushing the head of an open PR straight to `main` was accepted as a command-line merge, because the PR already met every rule. A commit outside any PR is rejected (`Changes must be made through a pull request`).
- **2026-11-09:** Dependabot commit bodies would fail the same rule. Added an `ignores` entry for commits signed off by `dependabot[bot]`.
