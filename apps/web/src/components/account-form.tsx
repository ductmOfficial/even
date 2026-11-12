import { zodResolver } from "@hookform/resolvers/zod";
import { createAccount, updateAccount, type Account } from "@even/db";
import { ACCOUNT_TYPE_LABELS, MONEY_ACCOUNT_TYPES, todayIso, type AccountType } from "@even/domain";
import { Button, DialogActions, TextField } from "@ductmofficial/sen-ui";
import { AmountField } from "@even/ui";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { useLedgerMutation } from "../data/mutate";
import { useFxRates } from "../data/queries";
import { FormDialog } from "./dialogs";
import { SelectField } from "./fields";

const schema = z.object({
  name: z.string().trim().min(1, "Nhập tên"),
  type: z.string().min(1),
  currency: z.enum(["VND", "USD"]),
  institution: z.string(),
  last4: z.string().regex(/^\d{0,6}$/, "Chỉ gồm chữ số (tối đa 6)"),
  aliases: z.string(),
  openingBalance: z.number().nullable(),
  openingDate: z.string(),
});
type Values = z.infer<typeof schema>;

export interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit an existing account; omit to create. */
  account?: Account;
  /** Creating a person (for debts) instead of a money account. */
  person?: boolean;
}

export function AccountDialog({ open, onOpenChange, account, person }: AccountDialogProps) {
  const isPerson = person ?? account?.type === "person";
  const title = account
    ? `Sửa ${isPerson ? "người" : "tài khoản"}`
    : isPerson
      ? "Thêm người"
      : "Thêm tài khoản";
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={title}>
      <AccountForm
        account={account}
        isPerson={isPerson}
        onDone={() => {
          onOpenChange(false);
        }}
      />
    </FormDialog>
  );
}

function AccountForm({
  account,
  isPerson,
  onDone,
}: {
  account?: Account;
  isPerson: boolean;
  onDone: () => void;
}) {
  const fx = useFxRates();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: account?.name ?? "",
      type: account?.type ?? (isPerson ? "person" : "bank"),
      currency: account?.currency ?? "VND",
      institution: account?.institution ?? "",
      last4: account?.last4 ?? "",
      aliases: account?.aliases.join(", ") ?? "",
      openingBalance: null,
      openingDate: todayIso(),
    },
  });
  const { control, register, handleSubmit, formState } = form;
  const currency = useWatch({ control, name: "currency" });

  const save = useLedgerMutation(
    async (db, v: Values) => {
      const input = {
        name: v.name,
        type: v.type as AccountType,
        currency: v.currency,
        institution: v.institution.trim() || null,
        last4: v.last4.trim() || null,
        aliases: v.aliases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (account) {
        await updateAccount(db, account.id, input);
        return account.id;
      }
      return createAccount(db, {
        ...input,
        openingBalance: v.openingBalance ?? undefined,
        openingDate: v.openingDate,
        rate: fx.data?.USD,
      });
    },
    { success: account ? "Đã lưu" : "Đã tạo" },
  );

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        void handleSubmit((v) => {
          save.mutate(v, { onSuccess: onDone });
        })(e);
      }}
    >
      <TextField
        label="Tên"
        autoFocus
        placeholder={isPerson ? "VD: An" : "VD: TCB 4321"}
        error={formState.errors.name?.message}
        {...register("name")}
      />
      {!isPerson ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <SelectField
                  label="Loại"
                  value={field.value}
                  onChange={field.onChange}
                  options={MONEY_ACCOUNT_TYPES.map((t) => ({
                    value: t,
                    label: ACCOUNT_TYPE_LABELS[t],
                  }))}
                />
              )}
            />
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <SelectField
                  label="Tiền tệ"
                  value={field.value}
                  onChange={field.onChange}
                  isDisabled={Boolean(account)}
                  options={[
                    { value: "VND", label: "VND (Việt Nam đồng)" },
                    { value: "USD", label: "USD (Đô la Mỹ)" },
                  ]}
                />
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Ngân hàng / tổ chức"
              placeholder="Techcombank"
              {...register("institution")}
            />
            <TextField
              label="Số cuối thẻ/tài khoản"
              description="Dùng khi nhập nhanh: “grab 50k 4321”"
              inputMode="numeric"
              error={formState.errors.last4?.message}
              {...register("last4")}
            />
          </div>
          <TextField
            label="Tên gọi tắt"
            description="Cách nhau bằng dấu phẩy, VD: credit, visa"
            {...register("aliases")}
          />
          {!account ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="openingBalance"
                render={({ field }) => (
                  <AmountField
                    label={`Số dư hiện tại${currency === "VND" ? "" : ` (${currency})`}`}
                    description="Thẻ tín dụng đang nợ thì nhập số âm"
                    currency={currency}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
              <TextField label="Tính đến ngày" type="date" {...register("openingDate")} />
            </div>
          ) : null}
        </>
      ) : null}
      <DialogActions>
        <Button variant="secondary" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" disabled={save.isPending}>
          Lưu
        </Button>
      </DialogActions>
    </form>
  );
}
