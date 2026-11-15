import {
  deleteRecurring,
  generateRecurring,
  saveRecurring,
  type RecurringInput,
  type RecurringTemplate,
} from "@even/db";
import {
  currentMonth,
  daysInMonth,
  dueDate,
  formatDate,
  formatMonth,
  todayIso,
  type RecurringKind,
} from "@even/domain";
import { Button, DialogActions, TextField } from "@ductmofficial/sen-ui";
import {
  AmountField,
  Badge,
  buttonClass,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
  MoneyText,
  SegmentedControl,
  Skeleton,
  Switch,
} from "@even/ui";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
  CalendarClockIcon,
  CalendarPlusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DueBadge } from "../components/card-status";
import { ConfirmDialog, FormDialog } from "../components/dialogs";
import { SelectField, TreeField } from "../components/fields";
import { MonthPicker } from "../components/month-picker";
import { PageHeader } from "../components/page";
import { useLedgerMutation } from "../data/mutate";
import {
  categoryOptions,
  useCards,
  useLookups,
  usePendingRecurring,
  useRecurring,
  type CardOverview,
  type Lookups,
} from "../data/queries";
import { accountOptions } from "../lib/options";

const route = getRouteApi("/recurring");

const KIND_LABELS: Record<RecurringKind, string> = {
  expense: "Chi",
  income: "Thu",
  transfer: "Chuyển",
};

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Whether a template is due at all in a month. */
function activeIn(t: RecurringTemplate, month: string): boolean {
  return t.active && t.startMonth <= month && (!t.endMonth || t.endMonth >= month);
}

interface CalendarEvent {
  key: string;
  date: string;
  label: string;
  amount: number;
  kind: "recurring" | "card";
  pending?: boolean;
  card?: CardOverview;
}

export function RecurringPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const month = search.month ?? currentMonth();
  const lookups = useLookups();
  const templates = useRecurring();
  const pending = usePendingRecurring();
  const cards = useCards();
  const [editing, setEditing] = useState<RecurringTemplate | "new" | null>(null);
  const [deleting, setDeleting] = useState<RecurringTemplate | null>(null);

  const pendingKeys = useMemo(
    () => new Set((pending.data ?? []).map((p) => `${p.template.id}:${p.month}`)),
    [pending.data],
  );

  const events = useMemo(() => {
    const list: CalendarEvent[] = [];
    for (const t of templates.data ?? []) {
      if (!activeIn(t, month)) continue;
      list.push({
        key: `r:${t.id}`,
        date: dueDate(t, month),
        label: t.name,
        amount: t.amount,
        kind: "recurring",
        pending: pendingKeys.has(`${t.id}:${month}`),
      });
    }
    for (const c of cards.data ?? []) {
      const due = c.statement.dueDate;
      if (!due?.startsWith(month)) continue;
      list.push({
        key: `c:${c.accountId}`,
        date: due,
        label: `Hạn thẻ ${lookups?.accountById.get(c.accountId)?.name ?? ""}`.trim(),
        amount: c.status.statementDue,
        kind: "card",
        card: c,
      });
    }
    return list.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
  }, [templates.data, cards.data, lookups, month, pendingKeys]);

  const generate = useLedgerMutation((db) => generateRecurring(db, todayIso()), {
    success: (r) =>
      r.skipped > 0
        ? `Đã tạo ${String(r.created)} giao dịch, bỏ qua ${String(r.skipped)} khoản trong kỳ đã khoá`
        : `Đã tạo ${String(r.created)} giao dịch`,
  });
  const remove = useLedgerMutation((db, id: string) => deleteRecurring(db, id), {
    success: "Đã xoá khoản định kỳ",
  });
  const pendingCount = pending.data?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Định kỳ & lịch"
        description="Các khoản lặp lại hằng tháng như tiền nhà, và hạn thanh toán thẻ tín dụng."
        actions={
          <>
            <Button
              variant="secondary"
              className={buttonClass()}
              disabled={pendingCount === 0 || generate.isPending}
              onClick={() => {
                generate.mutate(undefined);
              }}
            >
              <CalendarPlusIcon /> Tạo giao dịch đến hôm nay
              {pendingCount > 0 ? ` (${String(pendingCount)})` : ""}
            </Button>
            <Button
              className={buttonClass()}
              onClick={() => {
                setEditing("new");
              }}
            >
              <PlusIcon /> Thêm khoản định kỳ
            </Button>
          </>
        }
      />

      {!templates.data || !lookups ? <Skeleton className="h-40" /> : null}
      {templates.data?.length === 0 ? (
        <Card className="mb-4">
          <EmptyState
            icon={<CalendarClockIcon />}
            title="Chưa có khoản định kỳ"
            description="Thêm tiền nhà, lương, các gói thuê bao… Mỗi tháng, bấm “Tạo giao dịch đến hôm nay” để ghi nhận chúng; khi đối soát, sao kê sẽ khớp với các giao dịch này."
          />
        </Card>
      ) : null}
      {templates.data && templates.data.length > 0 && lookups ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Khoản định kỳ</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {templates.data.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {t.name} {!t.active ? <Badge tone="neutral">Tạm dừng</Badge> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">{describe(t, lookups)}</p>
                  </div>
                  <MoneyText
                    amount={t.kind === "income" ? t.amount : -t.amount}
                    className="font-medium"
                  />
                  <div className="flex gap-1">
                    <Button
                      variant="secondary"
                      className={buttonClass({ tone: "ghost", size: "icon-sm" })}
                      aria-label={`Sửa ${t.name}`}
                      onClick={() => {
                        setEditing(t);
                      }}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="secondary"
                      className={buttonClass({ tone: "ghost", size: "icon-sm" })}
                      aria-label={`Xoá ${t.name}`}
                      onClick={() => {
                        setDeleting(t);
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-wrap gap-2">
          <CardTitle>Lịch {formatMonth(month)}</CardTitle>
          <MonthPicker
            value={month}
            onChange={(m) => {
              void navigate({ search: { month: m === currentMonth() ? undefined : m } });
            }}
          />
        </CardHeader>
        <CardContent>
          <MonthCalendar month={month} events={events} />
          <EventList events={events} />
        </CardContent>
      </Card>

      {editing && lookups ? (
        <RecurringDialog
          template={editing === "new" ? null : editing}
          lookups={lookups}
          onClose={() => {
            setEditing(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        title={`Xoá “${deleting?.name ?? ""}”?`}
        description="Các giao dịch đã tạo từ khoản này vẫn được giữ."
        confirmLabel="Xoá"
        destructive
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
          setDeleting(null);
        }}
      />
    </>
  );
}

function describe(t: RecurringTemplate, lookups: Lookups): string {
  const account = lookups.accountById.get(t.accountId)?.name ?? "?";
  const target =
    t.kind === "transfer"
      ? ` → ${lookups.accountById.get(t.toAccountId ?? "")?.name ?? "?"}`
      : ` · ${lookups.categoryLabel(t.categoryId ?? "")}`;
  const shared = t.shares.length > 0 ? ` · chia với ${String(t.shares.length)} người` : "";
  const end = t.endMonth ? ` đến ${formatMonth(t.endMonth)}` : "";
  return `${KIND_LABELS[t.kind]} ngày ${String(t.dayOfMonth)} hằng tháng · ${account}${target}${shared} · từ ${formatMonth(t.startMonth)}${end}`;
}

function EventChip({ event }: { event: CalendarEvent }) {
  return (
    <span
      className={cn(
        "block truncate rounded px-1.5 py-0.5 text-xs",
        event.kind === "card" ? "bg-warning/15" : "bg-primary/10",
      )}
      title={event.label}
    >
      {event.label}
    </span>
  );
}

/** A month grid, Monday first, for wider screens. */
function MonthCalendar({ month, events }: { month: string; events: CalendarEvent[] }) {
  const [y = 0, m = 1] = month.split("-").map(Number);
  const days = daysInMonth(y, m);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  // Each cell keyed by its date, or by its place for the blanks around the month.
  const cells: { key: string; day: number | null }[] = [];
  for (let i = 0; i < lead; i++) cells.push({ key: `lead-${String(i)}`, day: null });
  for (let d = 1; d <= days; d++) cells.push({ key: `day-${String(d)}`, day: d });
  while (cells.length % 7 !== 0) cells.push({ key: `tail-${String(cells.length)}`, day: null });
  const weeks: { key: string; cells: typeof cells }[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push({ key: `week-${String(i / 7)}`, cells: cells.slice(i, i + 7) });
  }
  const today = todayIso();
  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  return (
    <table className="hidden w-full table-fixed border-collapse text-sm sm:table">
      <caption className="sr-only">Lịch {formatMonth(month)}</caption>
      <thead>
        <tr>
          {WEEKDAYS.map((d) => (
            <th key={d} scope="col" className="pb-2 text-xs font-medium text-muted-foreground">
              {d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week.key}>
            {week.cells.map(({ key, day }) => {
              if (day === null) return <td key={key} className="border border-border/50" />;
              const date = `${month}-${String(day).padStart(2, "0")}`;
              const items = byDate.get(date) ?? [];
              return (
                <td key={key} className="h-20 border border-border/50 p-1 align-top">
                  <span
                    className={cn(
                      "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs",
                      date === today && "font-semibold ring-2 ring-primary",
                    )}
                  >
                    {day}
                  </span>
                  <div className="grid gap-0.5">
                    {items.map((e) => (
                      <EventChip key={e.key} event={e} />
                    ))}
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The month's items as a list: details on wide screens, the whole calendar on phones. */
function EventList({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">Tháng này không có khoản nào.</p>;
  }
  return (
    <ul className="mt-4 divide-y border-t">
      {events.map((e) => (
        <li key={e.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
          <span className="w-24 shrink-0 text-muted-foreground">{formatDate(e.date)}</span>
          <span className="min-w-0 flex-1 font-medium">
            {e.card ? (
              <Link
                to="/accounts/$accountId"
                params={{ accountId: e.card.accountId }}
                className="hover:text-primary"
              >
                {e.label}
              </Link>
            ) : (
              e.label
            )}
          </span>
          {e.pending ? <Badge tone="warning">Chưa ghi nhận</Badge> : null}
          {e.card ? <DueBadge card={e.card} /> : null}
          <MoneyText amount={e.amount} />
        </li>
      ))}
    </ul>
  );
}

interface ShareRow {
  key: string;
  personId: string;
  amount: number | null;
}

function RecurringDialog({
  template,
  lookups,
  onClose,
}: {
  template: RecurringTemplate | null;
  lookups: Lookups;
  onClose: () => void;
}) {
  const moneyAccounts = accountOptions(lookups.accounts, { includeId: template?.accountId });
  const people = accountOptions(lookups.accounts, { onlyPeople: true });
  const targets = accountOptions(lookups.accounts, {
    people: true,
    includeId: template?.toAccountId ?? undefined,
  });
  const [name, setName] = useState(template?.name ?? "");
  const [kind, setKind] = useState<RecurringKind>(template?.kind ?? "expense");
  const [day, setDay] = useState(String(template?.dayOfMonth ?? 1));
  const [accountId, setAccountId] = useState(template?.accountId ?? moneyAccounts[0]?.value);
  const [toAccountId, setToAccountId] = useState(template?.toAccountId ?? undefined);
  const [categoryId, setCategoryId] = useState(template?.categoryId ?? undefined);
  const [amount, setAmount] = useState<number | null>(template?.amount ?? null);
  const [shares, setShares] = useState<ShareRow[]>(
    () =>
      template?.shares.map((s) => ({
        key: crypto.randomUUID(),
        personId: s.personAccountId,
        amount: s.amount,
      })) ?? [],
  );
  const [startMonth, setStartMonth] = useState(() => template?.startMonth ?? currentMonth());
  const [endMonth, setEndMonth] = useState(template?.endMonth ?? "");
  const [active, setActive] = useState(template?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  const shared = shares.reduce((s, x) => s + (x.amount ?? 0), 0);
  const save = useLedgerMutation(
    async (db, input: RecurringInput) => saveRecurring(db, input, template?.id),
    { success: template ? "Đã lưu khoản định kỳ" : "Đã thêm khoản định kỳ" },
  );

  function problem(): string | null {
    const dayNumber = Number(day);
    if (!name.trim()) return "Nhập tên";
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31)
      return "Ngày trong tháng từ 1 đến 31";
    if (!accountId) return "Chọn tài khoản";
    if (!amount || amount <= 0) return "Nhập số tiền";
    if (kind === "transfer" && !toAccountId) return "Chọn tài khoản nhận";
    if (kind !== "transfer" && !categoryId) return "Chọn danh mục";
    if (kind === "expense" && shared > amount) return "Phần chia lớn hơn số tiền";
    if (kind === "expense" && shares.some((s) => !s.personId || !s.amount))
      return "Chọn người và nhập số tiền cho mỗi phần chia";
    if (endMonth && endMonth < startMonth) return "Tháng kết thúc trước tháng bắt đầu";
    return null;
  }

  function submit() {
    const issue = problem();
    setError(issue);
    if (issue || !accountId || !amount) return;
    const dayNumber = Number(day);
    save.mutate(
      {
        name: name.trim(),
        kind,
        dayOfMonth: dayNumber,
        accountId,
        toAccountId: kind === "transfer" ? (toAccountId ?? null) : null,
        categoryId: kind === "transfer" ? null : (categoryId ?? null),
        amount,
        shares:
          kind === "expense"
            ? shares.map((s) => ({ personAccountId: s.personId, amount: s.amount ?? 0 }))
            : [],
        startMonth,
        endMonth: endMonth || null,
        active,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <FormDialog
      open
      wide
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={template ? `Sửa “${template.name}”` : "Thêm khoản định kỳ"}
      description="Giao dịch được tạo vào ngày đã chọn mỗi tháng và đánh dấu cần duyệt."
    >
      <div className="grid gap-4">
        <SegmentedControl
          aria-label="Loại"
          value={kind}
          onChange={setKind}
          options={[
            { value: "expense", label: "Chi" },
            { value: "income", label: "Thu" },
            { value: "transfer", label: "Chuyển khoản" },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <TextField
            label="Tên"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
          <TextField
            label="Ngày trong tháng"
            type="number"
            min={1}
            max={31}
            value={day}
            onChange={(e) => {
              setDay(e.target.value);
            }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <AmountField label="Số tiền" value={amount} onValueChange={setAmount} />
          <SelectField
            label={kind === "income" ? "Nhận vào tài khoản" : "Từ tài khoản"}
            value={accountId}
            onChange={setAccountId}
            options={moneyAccounts}
            placeholder="Chọn tài khoản"
          />
        </div>
        {kind === "transfer" ? (
          <SelectField
            label="Đến tài khoản"
            value={toAccountId}
            onChange={setToAccountId}
            options={targets.filter((o) => o.value !== accountId)}
            placeholder="Chọn tài khoản hoặc người"
          />
        ) : (
          <TreeField
            label="Danh mục"
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions(lookups.categories, kind)}
            placeholder="Chọn danh mục"
          />
        )}
        {kind === "expense" ? (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Chia tiền</legend>
            {shares.map((s, i) => (
              <div key={s.key} className="grid grid-cols-[1fr_10rem_auto] items-end gap-2">
                <SelectField
                  label={`Người ${String(i + 1)}`}
                  hideLabel
                  value={s.personId || undefined}
                  onChange={(v) => {
                    setShares(shares.map((x, j) => (j === i ? { ...x, personId: v } : x)));
                  }}
                  options={people}
                  placeholder="Chọn người"
                />
                <AmountField
                  label={`Phần của người ${String(i + 1)}`}
                  hideLabel
                  value={s.amount}
                  onValueChange={(v) => {
                    setShares(shares.map((x, j) => (j === i ? { ...x, amount: v } : x)));
                  }}
                />
                <Button
                  variant="secondary"
                  className={buttonClass({ tone: "ghost", size: "icon-sm" })}
                  aria-label={`Bỏ người ${String(i + 1)}`}
                  onClick={() => {
                    setShares(shares.filter((_, j) => j !== i));
                  }}
                >
                  <XIcon />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className={buttonClass({ size: "sm" })}
                disabled={people.length === 0}
                onClick={() => {
                  setShares([
                    ...shares,
                    {
                      key: crypto.randomUUID(),
                      personId: people[shares.length]?.value ?? "",
                      amount: null,
                    },
                  ]);
                }}
              >
                <PlusIcon /> Thêm người
              </Button>
              <Button
                variant="secondary"
                className={buttonClass({ size: "sm" })}
                disabled={!amount || shares.length === 0}
                onClick={() => {
                  const each = Math.floor((amount ?? 0) / (shares.length + 1));
                  setShares(shares.map((x) => ({ ...x, amount: each })));
                }}
              >
                Chia đều
              </Button>
            </div>
            {shares.length > 0 && amount ? (
              <p className="text-sm text-muted-foreground">
                Phần của bạn: <MoneyText amount={amount - shared} className="font-medium" />
              </p>
            ) : null}
          </fieldset>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Bắt đầu từ tháng"
            type="month"
            value={startMonth}
            onChange={(e) => {
              setStartMonth(e.target.value);
            }}
          />
          <TextField
            label="Đến tháng (không bắt buộc)"
            type="month"
            min={startMonth}
            value={endMonth}
            onChange={(e) => {
              setEndMonth(e.target.value);
            }}
          />
        </div>
        <Switch isSelected={active} onChange={setActive}>
          Đang áp dụng
        </Switch>
        {error ? (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        ) : null}
      </div>
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>
          Huỷ
        </Button>
        <Button disabled={save.isPending} onClick={submit}>
          {template ? "Lưu" : "Thêm"}
        </Button>
      </DialogActions>
    </FormDialog>
  );
}
