import type { Db } from "@even/db";
import { toast } from "@even/ui";
import { useMutation } from "@tanstack/react-query";

import { getDb } from "../db/client";
import { invalidateLedger } from "../db/invalidate";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Wraps a write: runs it against the local DB, refreshes every ledger query (in all tabs)
 * and shows a toast.
 */
export function useLedgerMutation<TInput, TResult = unknown>(
  fn: (db: Db, input: TInput) => Promise<TResult>,
  options: { success?: string | ((result: TResult) => string) } = {},
) {
  return useMutation({
    mutationFn: async (input: TInput) => fn(await getDb(), input),
    onSuccess: async (result) => {
      await invalidateLedger();
      const message =
        typeof options.success === "function" ? options.success(result) : options.success;
      if (message) toast.success(message);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });
}
