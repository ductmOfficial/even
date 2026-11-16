# ADR 0007 — Statement reconciliation and closed periods

- Status: accepted
- Date: 2026-11-15

## Context

A ledger kept by hand drifts from the bank: a coffee paid by card is forgotten, a transfer is entered twice, interest is never recorded. The bank's monthly statement is the reference. Reconciling means every statement line has a match in the ledger, the balances agree, and the month is then closed so a later edit cannot quietly change it.

Banks send statements as PDFs. Techcombank's account statements and credit card statements have a text layer, but their tables have no ruling and a description can wrap across several lines; some pages are landscape.

## Decision

**Reading the PDF.** pdf.js extracts text items with their positions, mapped through the page viewport so rotated pages read the right way up. A table reader anchors each row on the date in the date column and attaches every other token to the closest row above or below it. Text columns are assigned by the left edge of a token, amounts by their right edge, against the header positions. Nothing is uploaded: in the browser pdf.js runs with its own worker.

**Checking the statement before saving it.** Every account statement line carries the running balance, so the parser checks the chain line by line. The opening balance is derived from the first line (balance − amount), because the printed opening balance can differ when the account sweeps money into an auto-savings pocket. Credit card statements are checked against their summary (previous balance + debits − credits = new balance). A statement that does not add up is flagged with the reason before it is saved.

**Storing lines.** Statements and their lines are stored as they are, separately from the ledger. Each line has a key (date, amount, the bank reference or else the description, and its position among identical lines), unique per account, so loading the same PDF again, or an overlapping one, adds nothing.

**Matching.** A line matches a ledger movement on the same account with the same amount within 3 days, preferring the closest date and the most similar description. Two unmatched lines on the user's own accounts, one out and one in, with the same amount within 2 days, are paired into a transfer. For the rest the app drafts a transaction from the categorization rules; the user accepts, changes the category or ignores the line.

**Opening balance.** An account whose history came from the spreadsheet has spending but no balance, so on its first statement the ledger and the statement disagree before the first line. For the first statement of an account (no earlier statement, no locked period) the app shows that difference and records it as an opening-balance entry the day before the period starts. The savings-pocket adjustment is hidden until then, so the missing history is not booked as interest.

**Gaps.** When the bank's balance and the ledger differ after every line is handled (typically the auto-savings pocket), the user records the difference as a transfer to or from a "Sinh lời" account, instead of an unexplained adjustment to income or expense.

**Closing the period.** When the balances agree, the user locks the account up to the statement's end date. The lock stores the statement and ledger balances. Inserting, editing or deleting any transaction with a posting on that account on or before that date is refused in the repository layer, not only in the UI; locking marks those transactions reconciled and unlocking returns them to cleared. Statement imports and deletions, locks and unlocks are written to an audit log.

**Recurring items.** Rent and other monthly items are templates that create their due occurrences as transactions to review, each with a stable external id, so creating them twice adds nothing and the statement line matches them later. Occurrences in a locked period are skipped.

## Consequences

- The statement is the source of truth from the first reconciled month; the ledger keeps the categories, splits and debts the bank does not know about.
- Adding another bank means a new parser that returns the same statement shape; matching, pairing and locking do not change.
- A closed month can only change after unlocking it, which leaves a trace in the audit log.
- Parsers are tested with PDFs generated in the tests with fictional data; real statements are only checked locally with `pnpm --filter @even/parsers check:statements`, which prints totals and never transaction details.
