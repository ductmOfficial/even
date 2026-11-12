import { updateAccount } from "@even/db";
import { ACCOUNT_TYPE_LABELS } from "@even/domain";
import { Button } from "@ductmofficial/sen-ui";
import {
  Badge,
  buttonClass,
  Card,
  EmptyState,
  linkButtonClass,
  MoneyText,
  Skeleton,
} from "@even/ui";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArchiveIcon, ArchiveRestoreIcon, ArrowLeftIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { AccountDialog } from "../components/account-form";
import { PageHeader } from "../components/page";
import { TransactionTable } from "../components/transaction-table";
import { useLedgerMutation } from "../data/mutate";
import { useBalances, useLookups, useTransactions } from "../data/queries";
import { useUi } from "../lib/store";
import { toRow } from "../lib/transactions";

const route = getRouteApi("/accounts/$accountId");

export function AccountDetailPage() {
  const { accountId } = route.useParams();
  const lookups = useLookups();
  const balances = useBalances();
  const txs = useTransactions({ accountId });
  const openNew = useUi((s) => s.openNewTransaction);
  const [editing, setEditing] = useState(false);
  const account = lookups?.accountById.get(accountId);
  const archive = useLedgerMutation(
    async (db, archived: boolean) => updateAccount(db, accountId, { archived }),
    {
      success: "Đã cập nhật",
    },
  );

  const rows = useMemo(
    () => (lookups && txs.data ? txs.data.map((t) => toRow(t, lookups, accountId)) : []),
    [lookups, txs.data, accountId],
  );

  if (!lookups) return <Skeleton className="h-64" />;
  if (!account) return <EmptyState title="Không tìm thấy tài khoản" />;
  const balance = balances.data?.get(accountId)?.balance ?? 0;
  const isPerson = account.type === "person";

  return (
    <>
      <Link
        to={isPerson ? "/people" : "/accounts"}
        className={linkButtonClass("secondary", { tone: "ghost", size: "sm" }, "mb-2 -ml-2")}
      >
        <ArrowLeftIcon /> {isPerson ? "Công nợ" : "Tài khoản"}
      </Link>
      <PageHeader
        title={account.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
            {account.institution ? <span>{account.institution}</span> : null}
            {account.last4 ? <span>•••• {account.last4}</span> : null}
            {account.archived ? <Badge tone="warning">Đã lưu trữ</Badge> : null}
          </span>
        }
        actions={
          <>
            <Button
              variant="secondary"
              className={buttonClass({ size: "sm" })}
              onClick={() => {
                setEditing(true);
              }}
            >
              <PencilIcon /> Sửa
            </Button>
            <Button
              variant="secondary"
              className={buttonClass({ size: "sm" })}
              onClick={() => {
                archive.mutate(!account.archived);
              }}
            >
              {account.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}{" "}
              {account.archived ? "Bỏ lưu trữ" : "Lưu trữ"}
            </Button>
            <Button
              className={buttonClass({ size: "sm" })}
              onClick={() => {
                openNew({ accountId: isPerson ? undefined : accountId });
              }}
            >
              <PlusIcon /> Giao dịch
            </Button>
          </>
        }
      />
      <Card className="mb-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 p-4">
        <div>
          <div className="text-sm text-muted-foreground">
            {isPerson ? (balance >= 0 ? "Đang nợ bạn" : "Bạn đang nợ") : "Số dư hiện tại"}
          </div>
          <MoneyText
            amount={isPerson ? Math.abs(balance) : balance}
            currency={account.currency}
            className="text-2xl font-semibold"
            tone={isPerson ? "neutral" : "negative-only"}
          />
        </div>
        <div className="text-sm text-muted-foreground">{rows.length} giao dịch</div>
      </Card>
      <Card>
        {txs.isPending ? (
          <Skeleton className="m-4 h-40" />
        ) : (
          <TransactionTable label={`Giao dịch của ${account.name}`} rows={rows} hideAccount />
        )}
      </Card>
      <AccountDialog open={editing} onOpenChange={setEditing} account={account} />
    </>
  );
}
