import {
  accountBalances,
  categoryTotals,
  countNeedsReview,
  getFxRates,
  getTransaction,
  listAccounts,
  listCategories,
  listRules,
  listTransactions,
  monthlyTotals,
  netWorth,
  type Account,
  type Category,
  type Range,
  type TransactionFilter,
} from "@even/db";
import { buildCategoryTree, categoryPath, flattenTree } from "@even/domain";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { TreeOption } from "../components/fields";
import { getDb } from "../db/client";
import { LEDGER_KEY } from "../db/invalidate";

function useLedgerQuery<T>(
  key: readonly unknown[],
  fn: (db: Awaited<ReturnType<typeof getDb>>) => Promise<T>,
) {
  return useQuery({
    queryKey: [LEDGER_KEY, ...key],
    queryFn: async () => fn(await getDb()),
  });
}

export function useAccounts(includeArchived = false) {
  return useLedgerQuery(["accounts", includeArchived], (db) =>
    listAccounts(db, { includeArchived }),
  );
}

export function useBalances(asOf?: string) {
  return useLedgerQuery(["balances", asOf], async (db) => {
    const rows = await accountBalances(db, asOf);
    return new Map(rows.map((r) => [r.accountId, r]));
  });
}

export function useCategories() {
  return useLedgerQuery(["categories"], (db) => listCategories(db, { includeArchived: true }));
}

export function useRules() {
  return useLedgerQuery(["rules"], (db) => listRules(db));
}

export function useTransactions(filter: TransactionFilter) {
  return useLedgerQuery(["transactions", filter], (db) => listTransactions(db, filter));
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: [LEDGER_KEY, "transaction", id],
    queryFn: async () => (id ? ((await getTransaction(await getDb(), id)) ?? null) : null),
    enabled: Boolean(id),
  });
}

export function useCategoryTotals(range: Range) {
  return useLedgerQuery(["category-totals", range], (db) => categoryTotals(db, range));
}

export function useMonthlyTotals(range: Range) {
  return useLedgerQuery(["monthly", range], (db) => monthlyTotals(db, range));
}

export function useNetWorth(asOf?: string) {
  return useLedgerQuery(["net-worth", asOf], (db) => netWorth(db, asOf));
}

export function useNeedsReviewCount() {
  return useLedgerQuery(["needs-review"], (db) => countNeedsReview(db));
}

export function useFxRates() {
  return useLedgerQuery(["fx"], (db) => getFxRates(db));
}

export interface Lookups {
  accounts: Account[];
  accountById: Map<string, Account>;
  categories: Category[];
  categoryById: Map<string, Category>;
  isPerson: (id: string) => boolean;
  categoryLabel: (id: string) => string;
  /** Category ids in the subtree rooted at `id`, including itself. */
  descendants: (id: string) => string[];
}

/** Accounts + categories with fast lookup maps, shared by most screens. */
export function useLookups(): Lookups | undefined {
  const accounts = useAccounts(true);
  const categories = useCategories();
  return useMemo(() => {
    if (!accounts.data || !categories.data) return undefined;
    const accountById = new Map(accounts.data.map((a) => [a.id, a]));
    const categoryById = new Map(categories.data.map((c) => [c.id, c]));
    const children = new Map<string, string[]>();
    for (const c of categories.data) {
      if (!c.parentId) continue;
      const list = children.get(c.parentId) ?? [];
      list.push(c.id);
      children.set(c.parentId, list);
    }
    return {
      accounts: accounts.data,
      accountById,
      categories: categories.data,
      categoryById,
      isPerson: (id) => accountById.get(id)?.type === "person",
      categoryLabel: (id) => categoryPath(id, categoryById),
      descendants: (id) => {
        const out: string[] = [];
        const stack = [id];
        while (stack.length) {
          const current = stack.pop();
          if (current === undefined) break;
          out.push(current);
          stack.push(...(children.get(current) ?? []));
        }
        return out;
      },
    };
  }, [accounts.data, categories.data]);
}

/** Category tree flattened for a TreeField, optionally limited to one kind. */
export function categoryOptions(
  categories: readonly Category[],
  kind?: Category["kind"],
): TreeOption[] {
  const active = categories.filter((c) => !c.archived && (!kind || c.kind === kind));
  const byId = new Map(active.map((c) => [c.id, c]));
  return flattenTree(buildCategoryTree(active)).map((n) => {
    const parent = n.category.parentId ? byId.get(n.category.parentId) : undefined;
    return {
      value: n.category.id,
      label: n.category.name,
      hint: parent ? categoryPath(parent.id, byId) : undefined,
      depth: n.depth,
      group: n.category.kind === "income" ? "Thu nhập" : "Chi tiêu",
    };
  });
}
