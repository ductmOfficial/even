# Progress

> Last updated: 2026-11-17
>
> Legend: ✅ done · 🔄 in progress · ⬜ not started

Even is a local-first personal finance ledger. This repo was created from [`ductran-starter`](https://github.com/ductmOfficial/ductran-starter). This log records each step, the decisions behind it and the issues met along the way.

## Phases

| Phase | Scope                                                                                  | Status |
| ----- | -------------------------------------------------------------------------------------- | ------ |
| P0    | Foundation: domain logic, database in the browser, Excel import, UI on Sen UI, CI      | ✅     |
| P1    | Replace the spreadsheet: overview, transactions, accounts, debts, categories and rules | ✅     |
| P2    | Statements and reconciliation: bank statement parsers, matching, closing a period      | ✅     |
| P3    | Assets: savings deposits, investments, prices and exchange rates by date               | ⬜     |
| P4    | Cloud and PWA: passkey sign-in, sync between devices, offline install, reminders       | ⬜     |
| P5    | Polish and showcase: budgets, Sankey, English UI, demo mode, performance, case study   | ⬜     |

## Steps

| #   | Step                                                                                         | Branch                   | Status |
| --- | -------------------------------------------------------------------------------------------- | ------------------------ | ------ |
| 1   | Repository from the `ductran-starter` template                                               | `main`                   | ✅     |
| 2   | Rename to `even`, drop the sample package and the local PostgreSQL                           | `chore/setup`            | ✅     |
| 3   | `@even/domain`: money, double-entry builders, categories, rules, periods, quick entry        | `feat/domain`            | ✅     |
| 4   | `@even/db`: Drizzle schema, migrator, PGlite in Node for tests, backup, demo data            | `feat/db`                | ✅     |
| 5   | `@even/parsers`: monthly Excel workbook import                                               | `feat/parsers`           | ✅     |
| 6   | `@even/ui`: theme on Sen UI, money, charts, command palette; Storybook                       | `feat/ui`                | ✅     |
| 7   | The app: PGlite worker, overview, transactions, accounts, debts, settings, ⌘K                | `feat/web`               | ✅     |
| 8   | Categories and rules screen                                                                  | `feat/categories`        | ✅     |
| 9   | Excel import screen with a review queue                                                      | `feat/import`            | ✅     |
| 10  | Playwright and axe tests, `Browser` job in CI                                                | `test/e2e`               | ✅     |
| 11  | README, ADRs and this progress log                                                           | `docs/readme`            | ✅     |
| 12  | Techcombank account and credit card statements from PDF, with balance checks                 | `feat/statements`        | ✅     |
| 13  | Statements, statement lines, period locks and an audit log in the database                   | `feat/db-periods`        | ✅     |
| 14  | Matching statement lines, pairing transfers, drafting entries from rules                     | `feat/matching`          | ✅     |
| 15  | Readable toasts (contrast)                                                                   | `fix/toast`              | ✅     |
| 16  | Statement import and reconciliation screen, closing a period                                 | `feat/reconcile`         | ✅     |
| 17  | Credit card status, due dates and cashback; balances on any day                              | `feat/cards`             | ✅     |
| 18  | Recurring items and a month calendar                                                         | `feat/recurring`         | ✅     |
| 19  | ADR 0007, README and this log for P2                                                         | `docs/p2`                | ✅     |
| 20  | Opening balance from an account's first statement                                            | `feat/opening`           | ✅     |
| 21  | Fixes from the first real reconciliation: category field, review flag, line kind, card cycle | `fix/reconcile-feedback` | ✅     |

Each step is a pull request with green `Verify` (and, from step 10, `Browser`) checks, merged with rebase.

### Tests

134 unit and integration tests (domain 66, db 24, parsers 30, ui 10, web 4) and 11 Playwright tests, including an axe scan of every screen, the add-transaction dialog and the command palette in light and dark themes, and the statement flow from a generated PDF to a locked period.

### Known limitations

- Rows of an old workbook with no payment source in the Note column go to an "unknown source" account; move them to the right account while reconciling the first statements.
- Statements: Techcombank accounts and credit cards only. Other banks and PayPal need their own parser.
- An account statement's running balance includes the auto-savings pocket, so a month can start with a gap that has no transaction; it is recorded as a transfer to or from a "Sinh lời" account.
- Recurring items are created when you press the button (or open the app and follow the notice); there are no background reminders until the PWA (P4).
- Each write is flushed to IndexedDB. Single writes are instant, bulk writes are batched; seeding the demo data takes a few seconds.
- The first load downloads about 15 MB of PGlite WASM and data (cached afterwards).
- The USD rate is a manual setting; rates by date arrive in P3.
- UI copy is Vietnamese only (English is planned for P5).

## Decisions

| Decision                                                            | Reason                                                                                                                                    |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Local-first: PGlite in a Web Worker, IndexedDB storage              | Works offline, data stays on the device, and reports get real SQL ([ADR 0001](docs/adr/0001-local-first-pglite.md))                       |
| Double-entry postings that sum to 0                                 | One model for expenses, transfers, refunds, split bills and debts ([ADR 0002](docs/adr/0002-double-entry-ledger.md))                      |
| Money in integer minor units                                        | No floating-point drift ([ADR 0003](docs/adr/0003-money-as-integers.md))                                                                  |
| Categories from Plaid PFC, localized                                | A proven taxonomy with stable keys for rules and imports ([ADR 0004](docs/adr/0004-category-taxonomy.md))                                 |
| Internal packages consumed as source                                | No build step between packages ([ADR 0005](docs/adr/0005-internal-packages-as-source.md))                                                 |
| Sen UI for every component it has; `@even/ui` for the rest          | One accessible implementation per control, themed by tokens ([ADR 0006](docs/adr/0006-ui-on-sen-ui.md))                                   |
| Layer order `theme, base, sen, components, utilities`               | A Tailwind utility on a Sen UI component still wins over its defaults                                                                     |
| Theme stored per device and applied as `data-theme` on `<html>`     | Sen UI and Even's tokens follow the same attribute; a script in `index.html` sets it before the first paint                               |
| Switch and segmented control on React Aria in `@even/ui`            | Sen UI has neither yet; React Aria is already in the bundle through Sen UI                                                                |
| Transaction mode as a segmented control, not tabs                   | Expense, income and transfer share one form; tabs would need a panel per mode                                                             |
| Payment sources read generically from the Note column               | A card's last digits or "Credit" with an initial; the user maps each one to an account at import time                                     |
| Excel files parsed in a dedicated worker                            | Large workbooks do not block the UI, and the file never leaves the device                                                                 |
| Accent-insensitive search in the category field and command palette | Vietnamese is often typed without diacritics: "ca phe" finds "Cà phê"                                                                     |
| Statement PDFs read by text position with pdf.js, in the browser    | No upload and no OCR; the tables have no ruling, so rows are anchored on dates and columns on header positions                            |
| Opening balance derived from the first line's running balance       | The printed opening balance can differ when money sits in the auto-savings pocket ([ADR 0007](docs/adr/0007-statement-reconciliation.md)) |
| Statement lines stored apart from the ledger, with a unique key     | Loading the same or an overlapping statement adds nothing; the ledger keeps categories, splits and debts                                  |
| Match within 3 days, pair transfers within 2 days                   | Card transactions post a day or two after they happen; transfers between own accounts land the same or next day                           |
| Locks enforced in the repository, not only in the UI                | Every write path (form, Excel import, statements, recurring items) refuses a change in a closed period                                    |
| First statement sets the opening balance                            | Excel recorded spending, not balances; the gap before the first line is missing history, not savings interest                             |
| Cashback counted only from statement lines                          | The bank's figure is the one that counts; no estimate from rates                                                                          |
| Recurring occurrences as transactions to review, with a stable id   | Creating twice adds nothing, and the statement line matches the occurrence instead of creating a duplicate                                |
| Dev server on 3500, preview and E2E on 3501, Storybook on 3502      | Runs next to other local projects without port clashes                                                                                    |
| Browser job uses the runner's Chrome                                | Skips the Playwright browser download and its system packages                                                                             |
| No Co-Authored-By trailer in commits                                | Maintainer's preference                                                                                                                   |

## Follow-ups

- [ ] Sen UI: configurable labels for `DataTable`'s selection checkboxes (English today), and a row action for opening a row
- [ ] Sen UI: a switch and a segmented control, then drop them from `@even/ui`
- [ ] Run the Storybook stories as browser tests with axe, as Sen UI does
- [ ] Keyboard access to the bars of the 12-month chart (today the data table and the transaction list cover it)
- [ ] Parsers for Vietcombank and PayPal statements
- [ ] Keyboard shortcuts in the reconciliation list (accept, ignore, next line)

## Issue log

- **2026-11-12:** pnpm 12 stopped the install on esbuild's postinstall (`ERR_PNPM_IGNORED_BUILDS`). esbuild ships prebuilt binaries as optional dependencies, so `allowBuilds: esbuild: false` in `pnpm-workspace.yaml` skips it.
- **2026-11-12:** React Aria Components 1.22 deprecates `Switch` (`@typescript-eslint/no-deprecated` failed lint); the switch is built on `SwitchField` and `SwitchButton`.
- **2026-11-12:** React Aria's `Select` renders its label as a `<span>`, so hiding labels with `[&>label]:sr-only` missed it. Fields hide their first child instead.
- **2026-11-12:** Storybook's lint ran over its own build output (`storybook-static/`) when Turbo built the docs first; the docs ESLint config ignores it.
- **2026-11-12:** cmdk's default scoring did not match "them" to "Thêm". The palette uses an accent-insensitive filter.
- **2026-11-12:** settings cards overflowed a 390 px screen by 5 px: an implicit grid track grew to its content. Page grids now start from `grid-cols-1` (`minmax(0, 1fr)`).
- **2026-11-12:** on a machine with about 2 GB of free memory, the db tests died with "Worker forks emitted error" (the worker was killed with SIGKILL) while other Turbo tasks ran next to them. Each test file boots its own PGlite; they pass with `--concurrency=1` there, and on CI runners as is.
- **2026-11-14:** a statement's running balance did not add up across the "Total volume" row, which the reader took for a transaction. The table now ends at that row.
- **2026-11-14:** credit card fee lines have a posting date but no transaction date, so rows anchored on the transaction date lost them. Card rows anchor on the posting date.
- **2026-11-14:** importing pdf.js's worker module inside the app's own worker made it answer the app's messages. pdf.js now runs on the main thread with its own worker, loaded on demand.
- **2026-11-14:** sonner's rich colors failed the contrast check for toasts. Toasts use the plain style.
- **2026-11-15:** the calendar's filled "today" marker failed contrast in the dark theme; it is an outline now.
- **2026-11-17:** typing in the category field threw "childNodes is not supported" in React's development build only, and the field froze. React Aria's built-in filter clones the collection and fails on section headers; the field now filters its own items.
- **2026-11-17:** Techcombank moved a card's statement date from the 18th to the 20th, so lines posted on the 19th fell between two cycles. A cycle now starts at the earliest posting on its statement when that is sooner than a month before.
