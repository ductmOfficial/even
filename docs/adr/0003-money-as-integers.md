# ADR 0003 — Money as integers in minor units

- Status: accepted
- Date: 2026-11-12

## Decision

Store every amount as an integer in the currency's minor unit (VND: đồng, USD: cent) in `bigint` columns, read as JS `number`. Values are guarded with `Number.isSafeInteger`. 2^53 đồng is about 9 quadrillion VND, far beyond a household ledger, so `bigint` in JS is not needed. Quantities of assets (shares, coins, gold) will use `numeric` when investments arrive.

Parsing accepts Vietnamese habits: `120k`, `1,5tr`, `2 tỷ`, `1.234.567` (all separators are thousands separators for VND). Formatting uses `Intl.NumberFormat("vi-VN")`.

## Consequences

No floating-point drift in sums. FX conversion rounds once per posting, and builders push any rounding drift onto the last posting so the transaction still balances.
