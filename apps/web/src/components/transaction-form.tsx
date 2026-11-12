import { zodResolver } from "@hookform/resolvers/zod";
import {
  createTransaction,
  deleteTransactions,
  updateTransaction,
  type TransactionWithPostings,
} from "@even/db";
import {
  buildExpense,
  buildIncome,
  buildRefund,
  buildTransfer,
  formatMoney,
  matchRule,
  parseQuickEntry,
  todayIso,
  toMinor,
  type TransactionDraft,
} from "@even/domain";
import { Button, Checkbox, DialogActions, TextField } from "@ductmofficial/sen-ui";
import { AmountField, buttonClass, SegmentedControl } from "@even/ui";
import { PlusIcon, SplitIcon, Trash2Icon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { useLedgerMutation } from "../data/mutate";
import {
  categoryOptions,
  useFxRates,
  useLookups,
  useRules,
  useTransaction,
  type Lookups,
} from "../data/queries";
import { accountOptions } from "../lib/options";
import { useUi } from "../lib/store";
import { ConfirmDialog, FormDialog } from "./dialogs";
import { SelectField, TreeField } from "./fields";

const schema = z
  .object({
    mode: z.enum(["expense", "income", "transfer"]),
    refund: z.boolean(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Chọn ngày"),
    description: z.string().trim().min(1, "Nhập mô tả"),
    note: z.string(),
    amount: z.number({ error: "Nhập số tiền" }).positive("Số tiền phải lớn hơn 0").nullable(),
    accountId: z.string().min(1, "Chọn tài khoản"),
    categoryId: z.string(),
    toAccountId: z.string(),
    toAmount: z.number().positive().nullable(),
    shares: z.array(
      z.object({
        personId: z.string().min(1, "Chọn người"),
        amount: z.number().positive().nullable(),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.amount === null)
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Nhập số tiền" });
    if (v.mode === "transfer") {
      if (!v.toAccountId)
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Chọn tài khoản nhận" });
      if (v.toAccountId && v.toAccountId === v.accountId)
        ctx.addIssue({
          code: "custom",
          path: ["toAccountId"],
          message: "Phải khác tài khoản chuyển",
        });
    } else if (!v.categoryId) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Chọn danh mục" });
    }
    const shared = v.shares.reduce((s, x) => s + (x.amount ?? 0), 0);
    if (v.mode === "expense" && !v.refund && v.amount !== null && shared > v.amount) {
      ctx.addIssue({
        code: "custom",
        path: ["shares"],
        message: "Tổng phần chia vượt quá số tiền",
      });
    }
    v.shares.forEach((s, i) => {
      if (s.amount === null)
        ctx.addIssue({ code: "custom", path: ["shares", i, "amount"], message: "Nhập số tiền" });
    });
  });

export type TransactionFormValues = z.infer<typeof schema>;

function emptyValues(defaults?: {
  accountId?: string;
  mode?: TransactionFormValues["mode"];
}): TransactionFormValues {
  return {
    mode: defaults?.mode ?? "expense",
    refund: false,
    date: todayIso(),
    description: "",
    note: "",
    amount: null,
    accountId: defaults?.accountId ?? "",
    categoryId: "",
    toAccountId: "",
    toAmount: null,
    shares: [],
  };
}

/** Maps a stored transaction back to the form; null when its shape is too complex to edit here. */
export function toFormValues(
  tx: TransactionWithPostings,
  lookups: Lookups,
): TransactionFormValues | null {
  const base = {
    ...emptyValues(),
    date: tx.date,
    description: tx.description,
    note: tx.note ?? "",
  };
  const money = tx.postings.filter((p) => p.accountId && !lookups.isPerson(p.accountId));
  const people = tx.postings.filter((p) => p.accountId && lookups.isPerson(p.accountId));
  const cats = tx.postings.filter((p) => p.categoryId);

  if (tx.kind === "transfer") {
    const accountsInvolved = tx.postings.filter((p) => p.accountId);
    const from = accountsInvolved.find((p) => p.amount < 0);
    const to = accountsInvolved.find((p) => p.amount > 0);
    if (accountsInvolved.length !== 2 || !from?.accountId || !to?.accountId) return null;
    return {
      ...base,
      mode: "transfer",
      amount: -from.amount,
      accountId: from.accountId,
      toAccountId: to.accountId,
      toAmount: from.currency === to.currency ? null : to.amount,
    };
  }
  const [account] = money;
  const [cat] = cats;
  if (money.length !== 1 || cats.length !== 1 || !account?.accountId || !cat?.categoryId)
    return null;
  if (tx.kind === "expense") {
    return {
      ...base,
      mode: "expense",
      amount: -account.amount,
      accountId: account.accountId,
      categoryId: cat.categoryId,
      shares: people.map((p) => ({ personId: p.accountId ?? "", amount: p.amount })),
    };
  }
  if ((tx.kind === "income" || tx.kind === "refund") && people.length === 0) {
    return {
      ...base,
      mode:
        tx.kind === "refund" || lookups.categoryById.get(cat.categoryId)?.kind === "expense"
          ? "expense"
          : "income",
      refund: tx.kind === "refund",
      amount: account.amount,
      accountId: account.accountId,
      categoryId: cat.categoryId,
    };
  }
  return null;
}

export function toDraft(
  v: TransactionFormValues,
  lookups: Lookups,
  usdRate: number,
): TransactionDraft {
  const account = lookups.accountById.get(v.accountId);
  if (!account) throw new Error("Tài khoản không tồn tại");
  const currency = account.currency;
  const side = { accountId: account.id, currency, rate: currency === "USD" ? usdRate : 1 };
  const amount = v.amount ?? 0;
  const common = { date: v.date, description: v.description.trim(), note: v.note.trim() || null };

  if (v.mode === "transfer") {
    const to = lookups.accountById.get(v.toAccountId);
    if (!to) throw new Error("Tài khoản nhận không tồn tại");
    return buildTransfer({
      ...common,
      from: side,
      to: { accountId: to.id, currency: to.currency, rate: to.currency === "USD" ? usdRate : 1 },
      amount,
      toAmount: v.toAmount ?? undefined,
    });
  }
  if (v.mode === "income")
    return buildIncome({ ...common, ...side, amount, categoryId: v.categoryId });
  if (v.refund) return buildRefund({ ...common, ...side, amount, categoryId: v.categoryId });
  return buildExpense({
    ...common,
    ...side,
    amount,
    categoryId: v.categoryId,
    shares: v.shares.map((s) => ({ personAccountId: s.personId, amount: s.amount ?? 0 })),
  });
}

/** Global add/edit transaction dialog, driven by the UI store. */
export function TransactionDialog() {
  const { txDialog, closeTransaction } = useUi();
  const lookups = useLookups();
  const existing = useTransaction(txDialog.editId);
  const ready = lookups && (!txDialog.editId || existing.data !== undefined);
  return (
    <FormDialog
      open={txDialog.open}
      onOpenChange={(open) => {
        if (!open) closeTransaction();
      }}
      title={txDialog.editId ? "Sửa giao dịch" : "Thêm giao dịch"}
      wide
    >
      {ready ? (
        <TransactionForm
          key={txDialog.editId ?? "new"}
          lookups={lookups}
          existing={existing.data ?? null}
          defaults={txDialog.defaults}
          onDone={closeTransaction}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      )}
    </FormDialog>
  );
}

interface TransactionFormProps {
  lookups: Lookups;
  existing: TransactionWithPostings | null;
  defaults?: { accountId?: string; mode?: TransactionFormValues["mode"] };
  onDone: () => void;
}

const MODES = [
  { value: "expense", label: "Chi" },
  { value: "income", label: "Thu" },
  { value: "transfer", label: "Chuyển tiền" },
] as const;

function TransactionForm({ lookups, existing, defaults, onDone }: TransactionFormProps) {
  const fx = useFxRates();
  const rules = useRules();
  const initial = useMemo(
    () => (existing ? toFormValues(existing, lookups) : emptyValues(defaults)),
    [existing, lookups, defaults],
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(Boolean(existing));
  const [quick, setQuick] = useState("");

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? emptyValues(),
  });
  const { control, register, handleSubmit, setValue, formState } = form;
  const shares = useFieldArray({ control, name: "shares" });
  const [mode, refund, accountId, toAccountId, amount, description, shareValues] = useWatch({
    control,
    name: ["mode", "refund", "accountId", "toAccountId", "amount", "description", "shares"],
  });

  const account = lookups.accountById.get(accountId);
  const toAccount = lookups.accountById.get(toAccountId);
  const currency = account?.currency ?? "VND";
  const crossCurrency =
    mode === "transfer" && account && toAccount && account.currency !== toAccount.currency;

  // Suggest a category from the rules while the user types, until they pick one themselves.
  useEffect(() => {
    if (categoryTouched || mode === "transfer" || !rules.data || !description) return;
    const rule = matchRule(description, rules.data);
    if (rule) setValue("categoryId", rule.categoryId);
  }, [description, mode, rules.data, categoryTouched, setValue]);

  const save = useLedgerMutation(
    async (db, values: TransactionFormValues) => {
      const draft = toDraft(values, lookups, fx.data?.USD ?? 26_300);
      if (existing) await updateTransaction(db, existing.id, draft);
      else await createTransaction(db, draft);
    },
    { success: existing ? "Đã cập nhật giao dịch" : "Đã thêm giao dịch" },
  );
  const remove = useLedgerMutation(async (db, id: string) => deleteTransactions(db, [id]), {
    success: "Đã xoá giao dịch",
  });

  if (!initial && existing) {
    return (
      <div className="grid gap-4 text-sm">
        <p>
          Giao dịch này có nhiều dòng ghi sổ (nhiều danh mục hoặc nhiều tài khoản) nên chưa sửa được
          trong form này. Bạn có thể xoá và nhập lại.
        </p>
        <ul className="rounded-md border p-3 font-mono text-xs">
          {existing.postings.map((p) => (
            <li key={p.id} className="flex justify-between gap-4">
              <span>
                {p.accountId
                  ? lookups.accountById.get(p.accountId)?.name
                  : lookups.categoryLabel(p.categoryId ?? "")}
              </span>
              <span>{formatMoney(p.amount, p.currency)}</span>
            </li>
          ))}
        </ul>
        <DialogActions>
          <Button variant="secondary" onClick={onDone}>
            Đóng
          </Button>
          <Button
            className={buttonClass({ tone: "danger-solid" })}
            onClick={() => {
              remove.mutate(existing.id, { onSuccess: onDone });
            }}
          >
            <Trash2Icon /> Xoá
          </Button>
        </DialogActions>
      </div>
    );
  }

  const applyQuick = () => {
    if (!quick.trim()) return;
    const parsed = parseQuickEntry(
      quick,
      lookups.accounts.filter((a) => !a.archived),
    );
    if (parsed.description) setValue("description", parsed.description, { shouldValidate: true });
    if (parsed.amount !== null)
      setValue("amount", toMinor(parsed.amount, currency), { shouldValidate: true });
    if (parsed.accountId) setValue("accountId", parsed.accountId, { shouldValidate: true });
    setValue("date", parsed.date);
    setQuick("");
  };

  const shared = shareValues.reduce((s, x) => s + (x.amount ?? 0), 0);
  const people = accountOptions(lookups.accounts, { onlyPeople: true });
  const catOptions = categoryOptions(
    lookups.categories,
    mode === "income" ? "income" : refund ? undefined : "expense",
  );

  const onSubmit = handleSubmit((values) => {
    save.mutate(values, { onSuccess: onDone });
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        void onSubmit(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void onSubmit();
      }}
      noValidate
    >
      <Controller
        control={control}
        name="mode"
        render={({ field }) => (
          <SegmentedControl
            aria-label="Loại giao dịch"
            value={field.value}
            options={MODES}
            onChange={(v) => {
              field.onChange(v);
              if (v !== "expense") setValue("refund", false);
              if (!categoryTouched) setValue("categoryId", "");
            }}
          />
        )}
      />

      {!existing ? (
        <TextField
          label="Nhập nhanh"
          description="Ví dụ: grab 120k 4321 hôm qua. Enter để điền vào form"
          value={quick}
          placeholder="mô tả  số tiền  tài khoản  ngày"
          onChange={(e) => {
            setQuick(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              applyQuick();
            }
          }}
          onBlur={applyQuick}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="amount"
          render={({ field, fieldState }) => (
            <AmountField
              label={`Số tiền${currency === "VND" ? "" : ` (${currency})`}`}
              error={fieldState.error?.message}
              currency={currency}
              value={field.value}
              onValueChange={field.onChange}
              autoFocus={Boolean(existing)}
            />
          )}
        />
        <TextField
          label="Ngày"
          type="date"
          error={formState.errors.date?.message}
          {...register("date")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="accountId"
          render={({ field, fieldState }) => (
            <SelectField
              label={mode === "transfer" ? "Từ tài khoản" : "Tài khoản"}
              error={fieldState.error?.message}
              value={field.value || undefined}
              onChange={field.onChange}
              placeholder="Chọn tài khoản"
              options={accountOptions(lookups.accounts, {
                people: mode === "transfer",
                includeId: field.value,
              })}
            />
          )}
        />
        {mode === "transfer" ? (
          <Controller
            control={control}
            name="toAccountId"
            render={({ field, fieldState }) => (
              <SelectField
                label="Đến tài khoản"
                error={fieldState.error?.message}
                value={field.value || undefined}
                onChange={field.onChange}
                placeholder="Chọn tài khoản"
                options={accountOptions(lookups.accounts, {
                  people: true,
                  includeId: field.value,
                })}
              />
            )}
          />
        ) : (
          <Controller
            control={control}
            name="categoryId"
            render={({ field, fieldState }) => (
              <TreeField
                label="Danh mục"
                error={fieldState.error?.message}
                value={field.value || undefined}
                onChange={(v) => {
                  setCategoryTouched(true);
                  field.onChange(v);
                }}
                placeholder="Gõ để tìm danh mục"
                options={catOptions}
              />
            )}
          />
        )}
      </div>

      {crossCurrency ? (
        <Controller
          control={control}
          name="toAmount"
          render={({ field }) => (
            <AmountField
              label={`Số tiền nhận (${toAccount.currency})`}
              description="Nhập đúng số tiền ngân hàng báo có để giữ tỷ giá thực tế."
              currency={toAccount.currency}
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
        />
      ) : null}

      {mode === "expense" ? (
        <Controller
          control={control}
          name="refund"
          render={({ field }) => (
            <Checkbox
              isSelected={field.value}
              onChange={(checked) => {
                field.onChange(checked);
                if (checked) shares.replace([]);
              }}
            >
              Đây là khoản hoàn tiền / cashback (giảm chi tiêu của danh mục)
            </Checkbox>
          )}
        />
      ) : null}

      <TextField
        label="Mô tả"
        placeholder="VD: Market - Kingfood"
        error={formState.errors.description?.message}
        {...register("description")}
      />

      {mode === "expense" && !refund ? (
        <fieldset className="grid gap-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Chia tiền</legend>
          {shares.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ai đó sẽ trả lại bạn một phần? Thêm người để ghi nhận công nợ.
            </p>
          ) : null}
          {shares.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-[1fr_9rem_auto] items-start gap-2">
              <Controller
                control={control}
                name={`shares.${String(i)}.personId` as `shares.${number}.personId`}
                render={({ field }) => (
                  <SelectField
                    label={`Người ${String(i + 1)}`}
                    hideLabel
                    value={field.value || undefined}
                    onChange={field.onChange}
                    placeholder="Chọn người"
                    options={people}
                  />
                )}
              />
              <Controller
                control={control}
                name={`shares.${String(i)}.amount` as `shares.${number}.amount`}
                render={({ field, fieldState }) => (
                  <AmountField
                    label={`Phần của người ${String(i + 1)}`}
                    hideLabel
                    error={fieldState.error?.message}
                    currency={currency}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
              <Button
                variant="secondary"
                className={buttonClass({ tone: "ghost", size: "icon" })}
                aria-label={`Bỏ người ${String(i + 1)}`}
                onClick={() => {
                  shares.remove(i);
                }}
              >
                <XIcon />
              </Button>
            </div>
          ))}
          {formState.errors.shares?.message ? (
            <p role="alert" className="text-xs text-destructive">
              {formState.errors.shares.message}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              className={buttonClass({ size: "sm" })}
              disabled={people.length === 0}
              onClick={() => {
                shares.append({
                  personId: people[shares.fields.length]?.value ?? "",
                  amount: null,
                });
              }}
            >
              <PlusIcon /> Thêm người
            </Button>
            <Button
              variant="secondary"
              className={buttonClass({ size: "sm" })}
              disabled={!amount || shares.fields.length === 0}
              onClick={() => {
                const each = Math.floor((amount ?? 0) / (shares.fields.length + 1));
                shares.fields.forEach((_, i) => {
                  setValue(`shares.${String(i)}.amount` as `shares.${number}.amount`, each);
                });
              }}
            >
              <SplitIcon /> Chia đều
            </Button>
            {people.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                Thêm người ở trang Công nợ trước.
              </span>
            ) : null}
            {shares.fields.length > 0 && amount ? (
              <span className="ml-auto text-sm">
                Phần của bạn: <strong data-money>{formatMoney(amount - shared, currency)}</strong>
              </span>
            ) : null}
          </div>
        </fieldset>
      ) : null}

      <TextField label="Ghi chú" {...register("note")} />

      <DialogActions className="mt-2 items-center">
        {existing ? (
          <Button
            variant="secondary"
            className={buttonClass({ tone: "danger" }, "mr-auto")}
            onClick={() => {
              setConfirmDelete(true);
            }}
          >
            <Trash2Icon /> Xoá
          </Button>
        ) : null}
        {existing?.needsReview ? (
          <span className="mr-auto text-xs text-muted-foreground">Lưu sẽ đánh dấu là đã duyệt</span>
        ) : null}
        <Button variant="secondary" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" disabled={save.isPending}>
          Lưu
        </Button>
      </DialogActions>

      {existing ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Xoá giao dịch này?"
          description="Không thể hoàn tác."
          confirmLabel="Xoá"
          destructive
          onConfirm={() => {
            remove.mutate(existing.id, { onSuccess: onDone });
          }}
        />
      ) : null}
    </form>
  );
}
