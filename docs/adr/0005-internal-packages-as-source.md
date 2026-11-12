# ADR 0005 — Internal packages consumed as source

- Status: accepted
- Date: 2026-11-12

## Decision

`@even/domain`, `db`, `parsers` and `ui` export their `src/*.ts` directly (Turborepo "just-in-time packages"). Vite, Vitest and `tsc --noEmit` compile them in the consumer. Shared configs come from `ductran-starter` (`@repo/typescript-config`, `eslint-config`, `prettier-config`); each package's `tsconfig.json` sets bundler resolution and `noEmit`.

## Consequences

No build or watch step between packages, and go-to-definition lands in source. If a package is ever published, it gets a `tsc` build like `@repo/ui` in the starter.
