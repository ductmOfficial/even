# ADR 0006 — UI components from Sen UI

- Status: accepted
- Date: 2026-11-12

## Context

The app needs accessible form fields, selects, combo boxes, dialogs, tabs and a large virtualized table. [Sen UI](https://github.com/ductmOfficial/sen-ui) (`@ductmofficial/sen-ui`) already provides them on React Aria Components, with design tokens, light and dark themes and contrast checked in its own tests.

## Decision

- Use Sen UI for every component it has: `Button`, `TextField`, `Checkbox`, `Select`, `ComboBox`, `Dialog`, `Tabs` and `DataTable` (the transaction list).
- `@even/ui` keeps only what is specific to the app: money display and the amount field, SVG charts, the command palette (cmdk), badges, cards, empty states, and a switch and a segmented control on React Aria (Sen UI has neither yet).
- Theme by overriding the `--sen-*` tokens in `@even/ui/styles.css`, as Sen UI's README describes, and add `--even-*` tokens for money and chart colors. Tailwind utilities (`bg-card`, `text-muted-foreground`, `text-positive`…) map to the same tokens, so app markup and Sen UI components follow one theme.
- Declare the layer order `theme, base, sen, components, utilities`, so a Tailwind utility on a Sen UI component still wins.
- Looks Sen UI's `Button` lacks (ghost, danger, icon sizes) are utility classes from `buttonClass()`, not a second button component.

## Consequences

- One accessible implementation of each control, shared with the other projects that use Sen UI. Bugs and improvements land there once.
- Radix is gone; React Aria is the only primitives library in the bundle.
- `DataTable` has no row action, so a row opens for editing on click or Enter, handled by a wrapper around the grid. Its selection checkboxes have English labels until Sen UI makes them configurable.
- Accessibility is checked end to end with axe in both themes (`apps/web/e2e/a11y.spec.ts`).
