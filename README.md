# Even

[![CI](https://github.com/ductmOfficial/even/actions/workflows/ci.yml/badge.svg)](https://github.com/ductmOfficial/even/actions/workflows/ci.yml)

A local-first personal finance ledger for Vietnamese households: double-entry bookkeeping, multiple currencies, shared expenses and debts, and an import for a hand-kept Excel workbook. The whole database (Postgres, through PGlite/WASM) runs in a Web Worker in the browser, so the app works offline and financial data never leaves the device.

> Status: **P0 (foundation) and P1 (replace the spreadsheet) done.** Runs locally; not deployed yet. See [PROGRESS.md](PROGRESS.md).

## Highlights

- **Double-entry ledger.** Every transaction is a set of postings whose VND value sums to exactly 0. Transfers between cards, e-wallet top-ups, USD → VND withdrawals, split bills and settlements all use one model. The invariant is checked on every write and tested with property-based tests ([ADR 0002](docs/adr/0002-double-entry-ledger.md)).
- **Postgres in the browser.** PGlite runs in a dedicated worker (one leader tab, IndexedDB storage). The same Drizzle schema and SQL migrations run in the browser and in Node tests ([ADR 0001](docs/adr/0001-local-first-pglite.md)).
- **Money as integers.** Amounts are stored in minor units (đồng, cent) with a safe-integer guard. VND input accepts `120k`, `1,5tr`, `1.234.567` ([ADR 0003](docs/adr/0003-money-as-integers.md)).
- **Multi-level categories.** Based on Plaid's Personal Finance Categories, localized, with no depth limit and fixed/variable and 50/30/20 attributes ([ADR 0004](docs/adr/0004-category-taxonomy.md)).
- **Excel import.** Reads monthly sheets in a worker, maps the payment source from the Note column to accounts, splits broad old categories by description, and is idempotent (importing a file twice adds nothing). Ambiguous rows land in a review queue.
- **Keyboard first.** `N` adds a transaction, `⌘K` opens the command palette, and a quick-entry line parses `grab 120k 4321 hôm qua`. A rule engine suggests the category as you type.
- **Accessible, light and dark.** Forms, dialogs, tabs and the transaction table come from [Sen UI](https://github.com/ductmOfficial/sen-ui), themed through its tokens ([ADR 0006](docs/adr/0006-ui-on-sen-ui.md)). Every screen is checked with axe against WCAG 2.2 AA in both themes.
- **Built to scale.** The transaction table is virtualized, routes are code-split, and the PGlite runtime stays out of the main bundle.

## Tech stack

| Area     | Tools                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------- |
| Monorepo | pnpm workspaces, Turborepo (from [`ductran-starter`](https://github.com/ductmOfficial/ductran-starter)) |
| Language | TypeScript 6 (strict), Node.js 24                                                                       |
| App      | React 19, Vite 8, TanStack Router (type-safe search params), TanStack Query, Zustand                    |
| Data     | PGlite (Postgres WASM) in a Web Worker, Drizzle ORM, drizzle-kit migrations                             |
| UI       | Sen UI (React Aria), Tailwind CSS v4, cmdk, sonner, lucide; app components in `@even/ui` (Storybook 10) |
| Forms    | React Hook Form + Zod                                                                                   |
| Testing  | Vitest 5 (+ fast-check, Testing Library, PGlite in Node), Playwright + axe                              |
| Quality  | ESLint 10 (type-aware, `@eslint-react`), Prettier, commitlint, GitHub Actions                           |

## Structure

| Path                | Package         | What it is                                                                     |
| ------------------- | --------------- | ------------------------------------------------------------------------------ |
| `apps/web`          | `@even/web`     | The React app                                                                  |
| `apps/docs`         | `docs`          | Storybook for `@even/ui`                                                       |
| `packages/domain`   | `@even/domain`  | Pure logic: money, ledger builders, categories, rules, periods, quick entry    |
| `packages/db`       | `@even/db`      | Drizzle schema, migrations, migrator, repositories, reports, backup, demo data |
| `packages/parsers`  | `@even/parsers` | Importers: the monthly Excel workbook                                          |
| `packages/ui`       | `@even/ui`      | Theme on Sen UI, money, charts, command palette and other app components       |
| `packages/*-config` | `@repo/*`       | Shared TypeScript, ESLint and Prettier configs                                 |

Internal packages are consumed as TypeScript source ([ADR 0005](docs/adr/0005-internal-packages-as-source.md)), so there is no build step between them.

## Setup

### 1. Prerequisites

| Tool                      | Version                    | Needed for                 | Install                                                                                      |
| ------------------------- | -------------------------- | -------------------------- | -------------------------------------------------------------------------------------------- |
| Node.js                   | 24 (`.nvmrc`)              | everything                 | `nvm install && nvm use` (or `fnm use`)                                                      |
| pnpm                      | 12.14.0 (`packageManager`) | everything                 | `corepack enable` (or `npm install -g pnpm@12.14.0`)                                         |
| Git                       | any recent                 | everything                 |                                                                                              |
| Chromium or Google Chrome | any recent                 | browser tests (`e2e`) only | `pnpm --filter @even/web exec playwright install chromium`, or point `CHROME_PATH` at Chrome |

`pnpm install` refuses other Node.js majors (`engineStrict`). Corepack ships with Node.js 24: after `corepack enable`, the first `pnpm` command downloads the exact version from `packageManager` (answer `Y` if it asks).

There is nothing else to install: no database server (Postgres runs in the browser through PGlite), no API keys and no environment variables. The only variable the repository reads is `CHROME_PATH`, optional, for the browser tests.

### 2. Clone and install

```bash
git clone https://github.com/ductmOfficial/even.git
cd even
nvm use
corepack enable
pnpm install          # also installs the commit-msg hook
```

## Running

```bash
pnpm dev            # app on http://localhost:3500
pnpm storybook      # @even/ui on http://localhost:3502
```

Open **Cài đặt → Tạo dữ liệu demo** to explore with fictional data, or **Import Excel** to bring in your own workbook. The database is created in the browser on first load and migrated there; there is no migrate or seed command to run.

To serve the production build:

```bash
pnpm build                          # the app and the static Storybook
pnpm --filter @even/web preview     # http://localhost:3501
```

## Testing

| Command                             | What it runs                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm test`                         | Unit and integration tests (Vitest), including the ledger on PGlite in Node        |
| `pnpm test:coverage`                | The same with coverage                                                             |
| `pnpm lint` / `pnpm typecheck`      | ESLint (warnings fail) and `tsc --noEmit` everywhere                               |
| `pnpm format:check` / `pnpm format` | Prettier check / write                                                             |
| `pnpm build`                        | Build the app and the static Storybook                                             |
| `pnpm e2e`                          | Playwright and axe against the production build on port 3501 (the `Browser` check) |

`pnpm e2e` builds the app and serves it on port 3501 by itself. It uses Playwright's Chromium, or the Chrome at `CHROME_PATH` when it is set:

```bash
pnpm --filter @even/web exec playwright install chromium   # the first time
pnpm e2e
```

To run what CI runs before opening a pull request (`Verify`, then `Browser`):

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm turbo run lint typecheck test build
pnpm e2e
```

### All scripts

| Command                                                | What it does                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `pnpm dev`                                             | The app's Vite dev server on port 3500                                             |
| `pnpm storybook`                                       | Storybook for `@even/ui` on port 3502                                              |
| `pnpm build`                                           | Build the app and the static Storybook                                             |
| `pnpm turbo run lint typecheck test build`             | Everything the `Verify` check runs                                                 |
| `pnpm test`                                            | Unit and integration tests (Vitest)                                                |
| `pnpm e2e`                                             | Playwright and axe against the production build on port 3501 (the `Browser` check) |
| `pnpm --filter @even/web preview`                      | Serve the last production build on port 3501                                       |
| `pnpm --filter @even/db db:generate`                   | Generate a SQL migration after editing `packages/db/src/schema.ts`                 |
| `pnpm --filter @even/parsers check:legacy <file.xlsx>` | Dry-run an Excel import and print per-sheet totals and the category mapping        |

## Troubleshooting

| Symptom                                                     | Fix                                                                                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `pnpm install` fails with `ERR_PNPM_UNSUPPORTED_ENGINE`     | Wrong Node.js major: `nvm use` (Node.js 24), then install again                                                        |
| `pnpm: command not found`, or a different pnpm version runs | `corepack enable`, then open a new terminal; `pnpm -v` should print `12.14.0`                                          |
| `pnpm dev` stops with "Port 3500 is already in use"         | The ports are fixed (`strictPort`): stop the other process on 3500 (3501 for `preview` and `e2e`, 3502 for Storybook)  |
| `pnpm e2e` cannot start its server                          | Port 3501 must be free; stop a `preview` you left running                                                              |
| The browser tests cannot find a browser                     | `pnpm --filter @even/web exec playwright install chromium`, or set `CHROME_PATH`                                       |
| The app shows old data after trying the demo                | Data lives in the browser's IndexedDB (`even`): clear the site data for `localhost:3500` to start empty                |
| A machine with little memory kills the run (exit code 137)  | Run fewer tasks at once: `pnpm turbo run lint typecheck test build --concurrency=2`                                    |
| The commit is rejected                                      | The hook enforces [Conventional Commits](https://www.conventionalcommits.org): `feat(web): …`, `fix(db): …`, `docs: …` |

## Privacy

Data lives in the browser's IndexedDB (`even`). Excel files are parsed locally in a worker and never uploaded. There is no server yet; use **Cài đặt → Sao lưu** to export a JSON backup. Spreadsheets and CSV files are git-ignored so real data is never committed; test fixtures are generated in code with fictional values.

## License

MIT © 2026 Duc Tran
