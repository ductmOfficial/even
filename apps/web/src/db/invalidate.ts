import { QueryClient } from "@tanstack/react-query";

export const LEDGER_KEY = "ledger";

export const queryClient = new QueryClient({
  defaultOptions: {
    // Data is local: it only changes when we write, and every write invalidates.
    queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false },
  },
});

const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("even");

channel?.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.data === "invalidate") void queryClient.invalidateQueries({ queryKey: [LEDGER_KEY] });
});

/** Refreshes every ledger query here and in other open tabs. */
export async function invalidateLedger(): Promise<void> {
  channel?.postMessage("invalidate");
  await queryClient.invalidateQueries({ queryKey: [LEDGER_KEY] });
}
