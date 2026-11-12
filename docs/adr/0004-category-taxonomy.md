# ADR 0004 — Category taxonomy based on Plaid PFC

- Status: accepted
- Date: 2026-11-12

## Context

A typical hand-kept spreadsheet has a few dozen home-made categories in a handful of groups. Some were too broad ("Chăm sóc người thân" mixed baby goods, hospital visits and pharmacy) and some were not expenses at all (emergency fund, investing).

## Decision

- Seed a tree adapted from **Plaid Personal Finance Categories** (primary → detailed), localised into Vietnamese, plus a "Gia đình & con cái" primary that Plaid lacks. Seeded ids are stable keys (`food.groceries`) so rules and imports can reference them. Users can add levels without limit.
- Keep the old views as **attributes**: `nature` (fixed/variable) and `bucket` (need/want/save, for 50/30/20). Children inherit them.
- Savings and investing become **transfers** between accounts, not categories.
- The legacy importer maps each old category to a default, refines it by description (e.g. "Chăm sóc người thân" + "Pharmacity" → Y tế › Thuốc), and flags rows that stay broad.

## Consequences

Most rows of an old workbook map automatically; broad or ambiguous ones (refunds, transfers recorded as spending, rows without a category) go to the review queue instead of being guessed. `check:legacy` dry-runs a workbook so the per-month totals can be compared with the sheet's own totals before importing.
