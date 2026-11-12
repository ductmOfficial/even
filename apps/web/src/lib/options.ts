import type { Account } from "@even/db";
import { ACCOUNT_TYPE_LABELS } from "@even/domain";

import type { SelectOption } from "../components/fields";

/** Active accounts as select options grouped by type. People and equity are opt-in. */
export function accountOptions(
  accounts: readonly Account[],
  options: { people?: boolean; onlyPeople?: boolean; includeId?: string } = {},
): SelectOption[] {
  return accounts
    .filter((a) => a.type !== "equity")
    .filter((a) => !a.archived || a.id === options.includeId)
    .filter((a) =>
      options.onlyPeople ? a.type === "person" : (options.people ?? false) || a.type !== "person",
    )
    .map((a) => ({
      value: a.id,
      label: a.currency === "VND" ? a.name : `${a.name} (${a.currency})`,
      group: ACCOUNT_TYPE_LABELS[a.type],
    }));
}
