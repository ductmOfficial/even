# ADR 0002 — Double-entry ledger

- Status: accepted
- Date: 2026-11-12

## Context

A household moves money constantly: between bank cards, credit cards, e-wallets and a USD account such as PayPal, and shares rent and groceries with other people. A flat "list of expenses" double-counts transfers and cannot represent who owes whom.

## Decision

A transaction is a header plus **postings**. Each posting targets exactly one **account** (money, a credit card, a person, or equity) or one **category** (income/expense). Each posting stores its own `amount` and `currency` plus `baseAmount` in VND, and **the base amounts of a transaction must sum to 0**.

Sign convention:

| Target         | > 0                          | < 0                              |
| -------------- | ---------------------------- | -------------------------------- |
| Account        | money comes in               | money goes out                   |
| Person account | they owe you                 | you owe them                     |
| Category       | expense (or income reversal) | income (or refund of an expense) |

Builders in `@even/domain` create the common shapes: `buildExpense` (with shares that become receivables), `buildIncome`, `buildRefund`, `buildTransfer` (cross-currency uses the VND side, so the bank's real rate is kept) and `buildOpening` (against an equity account). `validateTransaction` runs on every write, and the invariant is tested with fast-check.

## Consequences

- Account balance = sum of its postings. Net worth = sum of non-equity accounts (foreign balances revalued at the FX setting).
- Expense totals = sum of category postings, so refunds and cashback net out naturally.
- Split bills need no special table: people are accounts.
- The UI hides the postings and shows "Chi / Thu / Chuyển tiền". Transactions with unusual shapes (several categories) are shown read-only.
