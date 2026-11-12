import { ACCOUNT_TYPE_LABELS, toBase, type AccountType } from "@even/domain";
import { Button } from "@ductmofficial/sen-ui";
import {
  Badge,
  buttonClass,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  MoneyText,
  Skeleton,
} from "@even/ui";
import { Link } from "@tanstack/react-router";
import { LandmarkIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { AccountDialog } from "../components/account-form";
import { PageHeader } from "../components/page";
import { useAccounts, useBalances, useFxRates, useNetWorth } from "../data/queries";

export function AccountsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const accounts = useAccounts(true);
  const balances = useBalances();
  const fx = useFxRates();
  const worth = useNetWorth();

  const accountList = accounts.data;
  const groups = useMemo(() => {
    const map = new Map<AccountType, NonNullable<typeof accountList>>();
    for (const a of accountList ?? []) {
      if (a.type === "equity" || a.type === "person" || (a.archived && !showArchived)) continue;
      const list = map.get(a.type) ?? [];
      list.push(a);
      map.set(a.type, list);
    }
    return [...map];
  }, [accountList, showArchived]);

  return (
    <>
      <PageHeader
        title="Tài khoản"
        description={
          worth.data ? (
            <>
              Tài sản ròng{" "}
              <MoneyText amount={worth.data.total} className="font-medium text-foreground" /> · USD
              quy đổi theo tỷ giá {new Intl.NumberFormat("vi-VN").format(fx.data?.USD ?? 0)}
            </>
          ) : undefined
        }
        actions={
          <>
            <Button
              variant="secondary"
              className={buttonClass({ tone: "ghost", size: "sm" })}
              onClick={() => {
                setShowArchived((v) => !v);
              }}
            >
              {showArchived ? "Ẩn tài khoản đã lưu trữ" : "Hiện tài khoản đã lưu trữ"}
            </Button>
            <Button
              className={buttonClass()}
              onClick={() => {
                setCreating(true);
              }}
            >
              <PlusIcon /> Thêm tài khoản
            </Button>
          </>
        }
      />
      {accounts.isPending ? <Skeleton className="h-48" /> : null}
      {accounts.data && groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LandmarkIcon />}
            title="Chưa có tài khoản"
            description="Thêm thẻ ngân hàng, thẻ tín dụng, ví điện tử, tiền mặt…"
          />
        </Card>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {groups.map(([type, list]) => {
          const total = list.reduce((s, a) => {
            const b = balances.data?.get(a.id)?.balance ?? 0;
            return s + toBase(b, a.currency, fx.data?.USD ?? 1);
          }, 0);
          return (
            <Card key={type}>
              <CardHeader>
                <CardTitle>{ACCOUNT_TYPE_LABELS[type]}</CardTitle>
                <MoneyText amount={total} className="text-sm font-medium" tone="negative-only" />
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {list.map((a) => {
                    const b = balances.data?.get(a.id)?.balance ?? 0;
                    return (
                      <li key={a.id}>
                        <Link
                          to="/accounts/$accountId"
                          params={{ accountId: a.id }}
                          className="flex items-center justify-between gap-3 py-2.5 hover:text-primary"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{a.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {[a.institution, a.last4 ? `•••• ${a.last4}` : null]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            {a.archived ? <Badge>Lưu trữ</Badge> : null}
                            <MoneyText
                              amount={b}
                              currency={a.currency}
                              tone="negative-only"
                              className="font-medium"
                            />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <AccountDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
