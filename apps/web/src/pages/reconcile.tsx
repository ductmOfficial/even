import { Button, Checkbox } from "@ductmofficial/sen-ui";
import {
  applyReconciliation,
  createAccount,
  deleteStatement,
  findAccountByNumber,
  insertTransaction,
  lockPeriod,
  logAudit,
  saveStatement,
  unlockPeriod,
  updateAccount,
  type Account,
  type StatementLineRow,
} from "@even/db";
import {
  addDays,
  buildTransfer,
  draftForLine,
  formatDate,
  matchStatementLines,
  pairTransfers,
  suggestForLine,
  type BankLine,
  type LineSuggestion,
  type TransactionDraft,
} from "@even/domain";
import type { ParsedStatement } from "@even/parsers";
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
  toast,
} from "@even/ui";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
  CheckCircle2Icon,
  FileTextIcon,
  LockIcon,
  LockOpenIcon,
  ScaleIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { ConfirmDialog } from "../components/dialogs";
import { SelectField, TreeField } from "../components/fields";
import { PageHeader } from "../components/page";
import { getDb } from "../db/client";
import { errorMessage, useLedgerMutation } from "../data/mutate";
import {
  categoryOptions,
  useLookups,
  usePeriods,
  useReconciliation,
  useRules,
  useStatementProgress,
  useStatements,
} from "../data/queries";
import { accountOptions } from "../lib/options";
import { parseStatements, type StatementResult } from "../lib/parse-statements";
import { useUi } from "../lib/store";

const route = getRouteApi("/reconcile");
const NEW = "__new__";

export function ReconcilePage() {
  const search = route.useSearch();
  return (
    <>
      <PageHeader
        title="Đối soát sao kê"
        description="Đưa sao kê ngân hàng vào sổ, đối chiếu từng dòng, rồi chốt kỳ khi số dư khớp."
      />
      {search.statement ? (
        <ReconcilePanel statementId={search.statement} />
      ) : (
        <div className="grid gap-4">
          <StatementUpload />
          <StatementList />
        </div>
      )}
    </>
  );
}

/* ── Upload ─────────────────────────────────────────────────────────────── */

interface Pending {
  name: string;
  statement: ParsedStatement;
  /** Account picked for it: an id, or NEW to create one. */
  accountId: string;
}

function suggestedName(s: ParsedStatement): string {
  const tail = s.accountNumber.slice(-4);
  return s.kind === "tcb-credit-card" ? `Thẻ tín dụng TCB …${tail}` : `TCB …${tail}`;
}

function StatementUpload() {
  const lookups = useLookups();
  const navigate = route.useNavigate();
  const [reading, setReading] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [failed, setFailed] = useState<StatementResult[]>([]);

  const onFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setReading(true);
    try {
      const results = await parseStatements(files);
      const db = await getDb();
      const ok: Pending[] = [];
      for (const r of results) {
        if (!r.ok) continue;
        const known = await findAccountByNumber(db, r.statement.accountNumber);
        ok.push({ name: r.name, statement: r.statement, accountId: known?.id ?? NEW });
      }
      setPending(ok);
      setFailed(results.filter((r) => !r.ok));
    } catch (error) {
      toast.error(`Không đọc được file: ${errorMessage(error)}`);
    } finally {
      setReading(false);
    }
  };

  const save = useLedgerMutation(
    async (db) => {
      const saved: { statementId: string; inserted: number; existing: boolean }[] = [];
      for (const p of pending) {
        const s = p.statement;
        let accountId = p.accountId;
        if (accountId === NEW) {
          accountId = await createAccount(db, {
            name: suggestedName(s),
            type: s.kind === "tcb-credit-card" ? "credit_card" : "bank",
            institution: "Techcombank",
            number: s.accountNumber,
            last4: s.creditCard?.cardLast4[0] ?? s.accountNumber.slice(-4),
            openingBalance: s.openingBalance,
            openingDate: addDays(s.periodFrom, -1),
          });
        } else {
          await updateAccount(db, accountId, { number: s.accountNumber });
        }
        saved.push(await saveStatement(db, { accountId, statement: s, filename: p.name }));
      }
      return saved;
    },
    {
      success: (saved) =>
        `Đã lưu ${String(saved.filter((s) => !s.existing).length)} sao kê, ${String(
          saved.reduce((n, s) => n + s.inserted, 0),
        )} dòng`,
    },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Tải sao kê</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center focus-within:ring-2 focus-within:ring-ring hover:bg-accent/40">
          <FileTextIcon className="size-7 text-muted-foreground" aria-hidden />
          <span className="font-medium">Chọn sao kê PDF (chọn được nhiều file)</span>
          <span className="text-xs text-muted-foreground">
            Techcombank: sổ phụ tài khoản và sao kê thẻ tín dụng. File được đọc ngay trên máy.
          </span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            onChange={(e) => {
              void onFiles([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          <span className="inline-flex items-center gap-1 text-sm text-primary">
            <UploadIcon className="size-4" aria-hidden /> {reading ? "Đang đọc…" : "Chọn file"}
          </span>
        </label>

        {failed.map((f) => (
          <p key={f.name} role="alert" className="text-sm text-destructive">
            {f.name}: {f.ok ? "" : f.error}
          </p>
        ))}

        {pending.length > 0 && lookups ? (
          <div className="grid gap-3">
            {pending.map((p, i) => (
              <div
                key={p.name}
                className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_18rem]"
              >
                <div className="text-sm">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-muted-foreground">
                    {p.statement.kind === "tcb-credit-card" ? "Thẻ tín dụng" : "Tài khoản"} …
                    {p.statement.accountNumber.slice(-4)} · {formatDate(p.statement.periodFrom)}–
                    {formatDate(p.statement.periodTo)} · {p.statement.lines.length} dòng
                  </div>
                  {p.statement.balanced ? (
                    <Badge tone="positive" className="mt-1">
                      Số dư khớp từng dòng
                    </Badge>
                  ) : (
                    <Badge tone="negative" className="mt-1">
                      Số dư không khớp: {p.statement.warnings[0]}
                    </Badge>
                  )}
                </div>
                <SelectField
                  label={`Tài khoản cho ${p.name}`}
                  value={p.accountId}
                  onChange={(v) => {
                    setPending((list) =>
                      list.map((x, j) => (j === i ? { ...x, accountId: v } : x)),
                    );
                  }}
                  options={[
                    { value: NEW, label: `Tạo mới: ${suggestedName(p.statement)}` },
                    ...accountOptions(lookups.accounts),
                  ]}
                />
              </div>
            ))}
            <div className="flex justify-end">
              <Button
                className={buttonClass()}
                disabled={save.isPending}
                onClick={() => {
                  save.mutate(undefined, {
                    onSuccess: (saved) => {
                      setPending([]);
                      const first = saved.find((s) => !s.existing) ?? saved[0];
                      if (saved.length === 1 && first) {
                        void navigate({ search: { statement: first.statementId } });
                      }
                    },
                  });
                }}
              >
                Lưu {pending.length} sao kê
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ── Stored statements ──────────────────────────────────────────────────── */

function StatementList() {
  const statements = useStatements();
  const progress = useStatementProgress();
  const periods = usePeriods();
  const lookups = useLookups();
  if (!statements.data || !lookups) return <Skeleton className="h-40" />;
  if (statements.data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ScaleIcon />}
          title="Chưa có sao kê nào"
          description="Tải sao kê ở trên để bắt đầu đối soát."
        />
      </Card>
    );
  }
  const lockedTo = new Map<string, string>();
  for (const p of periods.data ?? []) {
    if (p.lockedAt && (lockedTo.get(p.accountId) ?? "") < p.to) lockedTo.set(p.accountId, p.to);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Đối chiếu từng sao kê</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {statements.data.map((s) => {
            const counts = progress.data?.get(s.id);
            const locked = (lockedTo.get(s.accountId) ?? "") >= s.periodTo;
            return (
              <li key={s.id}>
                <Link
                  to="/reconcile"
                  search={{ statement: s.id }}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 hover:text-primary"
                >
                  <span>
                    <span className="font-medium">
                      {lookups.accountById.get(s.accountId)?.name ?? "?"}
                    </span>{" "}
                    <span className="text-sm text-muted-foreground">
                      {formatDate(s.periodFrom)}–{formatDate(s.periodTo)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {counts?.new ? (
                      <Badge tone="warning">{counts.new} dòng chưa đối chiếu</Badge>
                    ) : null}
                    {locked ? (
                      <Badge tone="positive">
                        <LockIcon className="size-3" aria-hidden /> Đã chốt
                      </Badge>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ── Reconciliation of one statement ────────────────────────────────────── */

const toBankLine = (l: StatementLineRow): BankLine => ({
  id: l.id,
  accountId: l.accountId,
  date: l.date,
  amount: l.amount,
  description: l.description,
  counterparty: l.counterparty,
  reference: l.reference,
});

interface Choice {
  ignore: boolean;
  suggestion: LineSuggestion;
}

function ReconcilePanel({ statementId }: { statementId: string }) {
  const lookups = useLookups();
  const rules = useRules();
  const data = useReconciliation(statementId);
  const statements = useStatements();
  const navigate = route.useNavigate();
  const openEdit = useUi((s) => s.openEditTransaction);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const plan = useMemo(() => {
    if (!data.data || !lookups || !rules.data) return null;
    const { statement, movements, otherNewLines } = data.data;
    const linked = new Set(
      statement.lines.flatMap((l) => (l.transactionId ? [l.transactionId] : [])),
    );
    const fresh = statement.lines.filter((l) => l.status === "new");
    const match = matchStatementLines(
      fresh.map(toBankLine),
      movements
        .filter((m) => !linked.has(m.transactionId))
        .map((m) => ({ ...m, accountId: statement.accountId })),
    );
    const unmatched = fresh.filter((l) => match.newLines.includes(l.id));
    const pairs = pairTransfers([...unmatched, ...otherNewLines].map(toBankLine)).filter(([a, b]) =>
      unmatched.some((l) => l.id === a || l.id === b),
    );
    const otherById = new Map(otherNewLines.map((l) => [l.id, l]));
    const pairOf = new Map<string, StatementLineRow>();
    for (const [a, b] of pairs) {
      const own = unmatched.find((l) => l.id === a || l.id === b);
      const other = otherById.get(own?.id === a ? b : a);
      if (own && other) pairOf.set(own.id, other);
    }
    // Money sent to or received from a statement's own holder moves between your accounts.
    const holderNames = [
      ...new Set((statements.data ?? []).flatMap((s) => (s.holder ? [s.holder] : []))),
    ];
    const suggestions = new Map(
      unmatched.map((l) => [
        l.id,
        suggestForLine(l, { rules: rules.data, accounts: lookups.accounts, holderNames }),
      ]),
    );
    const missing = movements.filter(
      (m) =>
        match.missing.includes(m.transactionId) &&
        !linked.has(m.transactionId) &&
        m.date >= statement.periodFrom &&
        m.date <= statement.periodTo,
    );
    return { statement, match, unmatched, pairOf, suggestions, missing };
  }, [data.data, lookups, rules.data, statements.data]);

  const choiceFor = (line: StatementLineRow): Choice | null => {
    const chosen = choices[line.id];
    if (chosen) return chosen;
    const suggestion = plan?.suggestions.get(line.id);
    return suggestion ? { ignore: false, suggestion } : null;
  };

  const apply = useLedgerMutation(
    async (db) => {
      if (!plan) return 0;
      const create: { lineIds: string[]; draft: TransactionDraft }[] = [];
      const ignore: string[] = [];
      const pairedDone = new Set<string>();
      for (const line of plan.unmatched) {
        const choice = choiceFor(line);
        if (!choice) continue;
        if (choice.ignore) {
          ignore.push(line.id);
          continue;
        }
        const other = plan.pairOf.get(line.id);
        if (other && !pairedDone.has(line.id)) {
          pairedDone.add(other.id);
          const out = line.amount < 0 ? line : other;
          const into = line.amount < 0 ? other : line;
          create.push({
            lineIds: [line.id, other.id],
            draft: buildTransfer({
              date: out.date,
              description: [out.counterparty, out.description].filter(Boolean).join(" · "),
              from: { accountId: out.accountId, currency: "VND" },
              to: { accountId: into.accountId, currency: "VND" },
              amount: -out.amount,
            }),
          });
          continue;
        }
        const draft = draftForLine(line, choice.suggestion);
        if (draft) create.push({ lineIds: [line.id], draft });
      }
      return applyReconciliation(db, { matches: plan.match.matches, create, ignore });
    },
    { success: (n) => `Đã đối chiếu, thêm ${String(n)} giao dịch` },
  );

  const adjust = useLedgerMutation(
    async (db, diff: number) => {
      if (!plan) return;
      const account = lookups?.accountById.get(plan.statement.accountId);
      if (!account) return;
      const poolName = `Sinh lời · ${account.name}`;
      const pool =
        lookups?.accounts.find((a) => a.name === poolName)?.id ??
        (await createAccount(db, {
          name: poolName,
          type: "savings",
          institution: account.institution,
        }));
      const side = { accountId: account.id, currency: "VND" as const };
      const other = { accountId: pool, currency: "VND" as const };
      await db.transaction(async (tx) => {
        await insertTransaction(
          tx,
          buildTransfer({
            date: plan.statement.periodTo,
            description: "Điều chỉnh theo sao kê (Sinh lời tự động)",
            from: diff > 0 ? other : side,
            to: diff > 0 ? side : other,
            amount: Math.abs(diff),
          }),
          { source: "statement" },
        );
        await logAudit(tx, "reconcile.adjust", "statement", plan.statement.id, { amount: diff });
      });
    },
    { success: "Đã ghi bút toán điều chỉnh" },
  );

  const lock = useLedgerMutation(
    async (db) => {
      if (!plan || !data.data) return;
      await lockPeriod(db, {
        accountId: plan.statement.accountId,
        from: plan.statement.periodFrom,
        to: plan.statement.periodTo,
        statementId: plan.statement.id,
        statementBalance: plan.statement.closingBalance,
        ledgerBalance: data.data.ledgerBalance,
      });
    },
    { success: "Đã chốt kỳ" },
  );
  const unlock = useLedgerMutation(
    async (db) => {
      if (plan) await unlockPeriod(db, plan.statement.accountId);
    },
    { success: "Đã mở khoá kỳ gần nhất" },
  );
  const remove = useLedgerMutation(async (db) => deleteStatement(db, statementId), {
    success: "Đã xoá sao kê",
  });

  if (data.isPending || !lookups || !rules.data) return <Skeleton className="h-96" />;
  if (!plan || !data.data) return <EmptyState title="Không tìm thấy sao kê" />;

  const { statement } = plan;
  const account: Account | undefined = lookups.accountById.get(statement.accountId);
  const diff = statement.closingBalance - data.data.ledgerBalance;
  const pendingLines = plan.unmatched.length;
  const locked = (data.data.lockedThrough ?? "") >= statement.periodTo;
  const transferOptions = accountOptions(lookups.accounts, { people: true }).filter(
    (o) => o.value !== statement.accountId,
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/reconcile" search={{}} className={linkBack}>
          ← Tất cả sao kê
        </Link>
        <span className="font-medium">{account?.name}</span>
        <span className="text-sm text-muted-foreground">
          {formatDate(statement.periodFrom)}–{formatDate(statement.periodTo)} ·{" "}
          {statement.lines.length} dòng
        </span>
        <Button
          variant="secondary"
          className={buttonClass({ tone: "danger", size: "sm" }, "ml-auto")}
          onClick={() => {
            setConfirmDelete(true);
          }}
        >
          <Trash2Icon /> Xoá sao kê
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Số dư</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Figure label="Cuối kỳ trên sao kê" amount={statement.closingBalance} />
          <Figure
            label={`Trong sổ đến ${formatDate(statement.periodTo)}`}
            amount={data.data.ledgerBalance}
          />
          <div>
            <div className="text-sm text-muted-foreground">Chênh lệch</div>
            {diff === 0 ? (
              <span className="inline-flex items-center gap-1 text-lg font-semibold text-positive">
                <CheckCircle2Icon className="size-5" aria-hidden /> Khớp
              </span>
            ) : (
              <MoneyText amount={diff} signed tone="auto" className="text-lg font-semibold" />
            )}
          </div>
          {statement.reportedOpeningBalance !== null ? (
            <p className="text-xs text-muted-foreground sm:col-span-3">
              Số dư đầu kỳ in trên sao kê là <MoneyText amount={statement.reportedOpeningBalance} />
              , khác số dư khả dụng <MoneyText amount={statement.openingBalance} />: phần chênh nằm
              trong Sinh lời tự động.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Dòng chưa có trong sổ ({pendingLines}) · Khớp sẵn {plan.match.matches.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {pendingLines === 0 && plan.match.matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Mọi dòng của sao kê đã được đối chiếu.</p>
          ) : null}
          {plan.unmatched.map((line) => {
            const choice = choiceFor(line);
            const other = plan.pairOf.get(line.id);
            const s = choice?.suggestion;
            const set = (patch: Partial<Choice>) => {
              if (!choice) return;
              setChoices((c) => ({ ...c, [line.id]: { ...choice, ...patch } }));
            };
            return (
              <div
                key={line.id}
                className="grid items-end gap-3 rounded-lg border p-3 lg:grid-cols-[7rem_1fr_9rem_18rem_auto]"
              >
                <span className="text-sm text-muted-foreground tabular-nums">
                  {formatDate(line.date)}
                </span>
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-medium">
                    {line.counterparty ?? line.description}
                  </span>
                  {line.counterparty ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {line.description}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">{s?.reason}</span>
                </span>
                <MoneyText amount={line.amount} signed tone="auto" className="font-medium" />
                {other ? (
                  <span className="text-sm">
                    Chuyển tiền với {lookups.accountById.get(other.accountId)?.name} (
                    {formatDate(other.date)})
                  </span>
                ) : s?.kind === "transfer" ? (
                  <SelectField
                    label={`Tài khoản đối ứng cho dòng ${formatDate(line.date)}`}
                    hideLabel
                    placeholder="Chọn tài khoản đối ứng"
                    value={s.otherAccountId ?? undefined}
                    onChange={(v) => {
                      set({ suggestion: { ...s, otherAccountId: v } });
                    }}
                    options={transferOptions}
                  />
                ) : s ? (
                  <TreeField
                    label={`Danh mục cho dòng ${formatDate(line.date)}`}
                    hideLabel
                    value={s.categoryId}
                    onChange={(v) => {
                      set({ suggestion: { ...s, categoryId: v, confident: true } });
                    }}
                    options={categoryOptions(lookups.categories)}
                  />
                ) : (
                  <span />
                )}
                <Checkbox
                  isSelected={choice?.ignore ?? false}
                  onChange={(ignore) => {
                    set({ ignore });
                  }}
                >
                  Bỏ qua
                </Checkbox>
              </div>
            );
          })}
          {pendingLines > 0 || plan.match.matches.length > 0 ? (
            <div className="flex justify-end pt-2">
              <Button
                className={buttonClass()}
                disabled={apply.isPending || locked}
                onClick={() => {
                  apply.mutate(undefined, {
                    onSuccess: () => {
                      setChoices({});
                    },
                  });
                }}
              >
                Áp dụng đối chiếu
              </Button>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Dòng chuyển tiền chưa chọn tài khoản đối ứng sẽ được giữ lại để làm sau. Giao dịch tạo
            từ sao kê mà chưa rõ danh mục sẽ vào hàng chờ duyệt.
          </p>
        </CardContent>
      </Card>

      {plan.missing.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Có trong sổ nhưng không có trên sao kê ({plan.missing.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {plan.missing.map((m) => (
                <li key={m.transactionId} className="flex items-center justify-between gap-3 py-2">
                  <button
                    type="button"
                    className="min-w-0 truncate text-left text-sm hover:text-primary"
                    onClick={() => {
                      openEdit(m.transactionId);
                    }}
                  >
                    {formatDate(m.date)} · {m.description}
                  </button>
                  <MoneyText amount={m.amount} signed tone="auto" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>3. Chốt kỳ</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {locked ? (
            <>
              <Badge tone="positive">
                <LockIcon className="size-3" aria-hidden /> Đã chốt đến{" "}
                {formatDate(data.data.lockedThrough ?? statement.periodTo)}
              </Badge>
              <Button
                variant="secondary"
                className={buttonClass({ size: "sm" })}
                disabled={unlock.isPending}
                onClick={() => {
                  unlock.mutate(undefined);
                }}
              >
                <LockOpenIcon /> Mở khoá kỳ gần nhất
              </Button>
            </>
          ) : (
            <>
              {diff !== 0 && pendingLines === 0 && account?.type === "bank" ? (
                <Button
                  variant="secondary"
                  className={buttonClass()}
                  disabled={adjust.isPending}
                  onClick={() => {
                    adjust.mutate(diff);
                  }}
                >
                  Ghi chênh lệch vào Sinh lời
                </Button>
              ) : null}
              <Button
                className={buttonClass()}
                disabled={diff !== 0 || pendingLines > 0 || lock.isPending}
                onClick={() => {
                  lock.mutate(undefined);
                }}
              >
                <LockIcon /> Chốt kỳ đến {formatDate(statement.periodTo)}
              </Button>
              <span className="text-xs text-muted-foreground">
                {pendingLines > 0
                  ? "Còn dòng chưa đối chiếu."
                  : diff !== 0
                    ? "Số dư chưa khớp."
                    : "Sau khi chốt, giao dịch của tài khoản trong kỳ không sửa được nữa."}
              </span>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Xoá sao kê này?"
        description="Các giao dịch đã tạo từ sao kê vẫn được giữ."
        confirmLabel="Xoá"
        destructive
        onConfirm={() => {
          remove.mutate(undefined, {
            onSuccess: () => {
              void navigate({ search: {} });
            },
          });
        }}
      />
    </div>
  );
}

const linkBack = "text-sm font-medium text-primary hover:underline";

function Figure({ label, amount }: { label: string; amount: number }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <MoneyText amount={amount} className="text-lg font-semibold" tone="negative-only" />
    </div>
  );
}
