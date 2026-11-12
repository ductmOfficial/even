import { createTransaction } from "@even/db";
import { buildTransfer, todayIso, type Currency } from "@even/domain";
import { Button, DialogActions, TextField } from "@ductmofficial/sen-ui";
import { AmountField, buttonClass, Card, EmptyState, MoneyText, Skeleton } from "@even/ui";
import { Link } from "@tanstack/react-router";
import { HandCoinsIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import { AccountDialog } from "../components/account-form";
import { FormDialog } from "../components/dialogs";
import { SelectField } from "../components/fields";
import { PageHeader } from "../components/page";
import { useLedgerMutation } from "../data/mutate";
import { useBalances, useLookups } from "../data/queries";
import { accountOptions } from "../lib/options";

interface SettleTarget {
  personId: string;
  name: string;
  balance: number;
}

export function PeoplePage() {
  const lookups = useLookups();
  const balances = useBalances();
  const [adding, setAdding] = useState(false);
  const [settling, setSettling] = useState<SettleTarget | null>(null);
  const people = lookups?.accounts.filter((a) => a.type === "person" && !a.archived) ?? [];
  const owedToYou = people.reduce(
    (s, p) => s + Math.max(0, balances.data?.get(p.id)?.balance ?? 0),
    0,
  );
  const youOwe = people.reduce(
    (s, p) => s + Math.max(0, -(balances.data?.get(p.id)?.balance ?? 0)),
    0,
  );

  return (
    <>
      <PageHeader
        title="Công nợ & chia tiền"
        description={
          <>
            Người khác nợ bạn <MoneyText amount={owedToYou} className="font-medium text-positive" />{" "}
            · Bạn nợ <MoneyText amount={youOwe} className="font-medium text-negative" />
          </>
        }
        actions={
          <Button
            className={buttonClass()}
            onClick={() => {
              setAdding(true);
            }}
          >
            <PlusIcon /> Thêm người
          </Button>
        }
      />
      {!lookups ? <Skeleton className="h-40" /> : null}
      {lookups && people.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UsersIcon />}
            title="Chưa có ai"
            description="Thêm người bạn hay chia tiền nhà, tiền chợ… Khi nhập chi tiêu, chọn “Chia tiền” để ghi nhận phần họ nợ."
          />
        </Card>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => {
          const balance = balances.data?.get(p.id)?.balance ?? 0;
          return (
            <Card key={p.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to="/accounts/$accountId"
                  params={{ accountId: p.id }}
                  className="font-medium hover:text-primary"
                >
                  {p.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {balance > 0 ? "nợ bạn" : balance < 0 ? "bạn nợ" : "đã xong"}
                </span>
              </div>
              <MoneyText
                amount={Math.abs(balance)}
                className={
                  balance > 0
                    ? "text-xl font-semibold text-positive"
                    : balance < 0
                      ? "text-xl font-semibold text-negative"
                      : "text-xl font-semibold text-muted-foreground"
                }
              />
              <Button
                variant="secondary"
                className={buttonClass({ size: "sm" })}
                aria-label={`Quyết toán với ${p.name}`}
                disabled={balance === 0}
                onClick={() => {
                  setSettling({ personId: p.id, name: p.name, balance });
                }}
              >
                <HandCoinsIcon /> Quyết toán
              </Button>
            </Card>
          );
        })}
      </div>
      <AccountDialog open={adding} onOpenChange={setAdding} person />
      {settling && lookups ? (
        <SettleDialog
          target={settling}
          moneyAccounts={accountOptions(lookups.accounts)}
          onClose={() => {
            setSettling(null);
          }}
        />
      ) : null}
    </>
  );
}

function SettleDialog({
  target,
  moneyAccounts,
  onClose,
}: {
  target: SettleTarget;
  moneyAccounts: ReturnType<typeof accountOptions>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState<number | null>(Math.abs(target.balance));
  const [accountId, setAccountId] = useState(moneyAccounts[0]?.value);
  const [date, setDate] = useState(() => todayIso());
  const theyPay = target.balance > 0;
  const settle = useLedgerMutation(
    async (db) => {
      if (!amount || !accountId) throw new Error("Nhập số tiền và chọn tài khoản");
      const person = { accountId: target.personId, currency: "VND" as Currency };
      const account = { accountId, currency: "VND" as Currency };
      await createTransaction(
        db,
        buildTransfer({
          date,
          description: theyPay ? `${target.name} trả tiền` : `Trả tiền cho ${target.name}`,
          from: theyPay ? person : account,
          to: theyPay ? account : person,
          amount,
        }),
      );
    },
    { success: "Đã ghi nhận quyết toán" },
  );
  return (
    <FormDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={`Quyết toán với ${target.name}`}
      description={theyPay ? `${target.name} trả lại bạn` : `Bạn trả cho ${target.name}`}
    >
      <div className="grid gap-4">
        <AmountField label="Số tiền" value={amount} onValueChange={setAmount} />
        <SelectField
          label={theyPay ? "Nhận vào tài khoản" : "Trả từ tài khoản"}
          value={accountId}
          onChange={setAccountId}
          options={moneyAccounts}
          placeholder="Chọn tài khoản"
        />
        <TextField
          label="Ngày"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
          }}
        />
      </div>
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>
          Huỷ
        </Button>
        <Button
          disabled={settle.isPending}
          onClick={() => {
            settle.mutate(undefined, { onSuccess: onClose });
          }}
        >
          Ghi nhận
        </Button>
      </DialogActions>
    </FormDialog>
  );
}
