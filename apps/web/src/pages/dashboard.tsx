import {
  ACCOUNT_TYPE_LABELS,
  addMonths,
  currentMonth,
  formatMoney,
  formatMonth,
  monthRange,
  rollUp,
  todayIso,
  type AccountType,
} from "@even/domain";
import { Button } from "@ductmofficial/sen-ui";
import {
  BarChart,
  buttonClass,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  MoneyText,
  ShareBars,
  Skeleton,
} from "@even/ui";
import { getRouteApi, Link } from "@tanstack/react-router";
import { CircleAlertIcon, PlusIcon } from "lucide-react";
import { useMemo } from "react";

import { MonthPicker } from "../components/month-picker";
import { PageHeader, QueryError } from "../components/page";
import {
  useBalances,
  useCategoryTotals,
  useLookups,
  useMonthlyTotals,
  useNeedsReviewCount,
  useNetWorth,
} from "../data/queries";
import { useUi } from "../lib/store";

const route = getRouteApi("/");

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number | undefined;
  tone?: "auto";
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {value === undefined ? (
          <Skeleton className="h-7 w-32" />
        ) : (
          <MoneyText
            amount={value}
            tone={tone}
            signed={tone === "auto"}
            className="text-lg font-semibold tracking-tight sm:text-2xl"
          />
        )}
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const month = search.month ?? currentMonth();
  const range = monthRange(month);
  const isCurrent = month === currentMonth();
  const asOf = isCurrent ? todayIso() : range.to;

  const lookups = useLookups();
  const worth = useNetWorth(asOf);
  const totals = useCategoryTotals(range);
  const trendRange = { from: monthRange(addMonths(month, -11)).from, to: range.to };
  const trend = useMonthlyTotals(trendRange);
  const balances = useBalances(asOf);
  const review = useNeedsReviewCount();
  const openNew = useUi((s) => s.openNewTransaction);

  const monthTotals = trend.data?.find((t) => t.month === month);
  const income = monthTotals?.income ?? (trend.data ? 0 : undefined);
  const expense = monthTotals?.expense ?? (trend.data ? 0 : undefined);

  const expenseByPrimary = useMemo(() => {
    if (!lookups || !totals.data) return [];
    const expenseOnly = new Map(
      totals.data
        .filter((t) => lookups.categoryById.get(t.categoryId)?.kind === "expense")
        .map((t) => [t.categoryId, t.total]),
    );
    const rolled = rollUp(expenseOnly, lookups.categoryById);
    return lookups.categories
      .filter((c) => c.parentId === null && c.kind === "expense")
      .map((c) => ({ key: c.id, label: c.name, value: rolled.get(c.id) ?? 0 }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [lookups, totals.data]);

  const accountGroups = useMemo(() => {
    if (!lookups || !balances.data) return [];
    const groups = new Map<
      AccountType,
      { id: string; name: string; balance: number; currency: string }[]
    >();
    for (const a of lookups.accounts) {
      if (a.archived || a.type === "equity") continue;
      const b = balances.data.get(a.id)?.balance ?? 0;
      if (a.type === "person" && b === 0) continue;
      const list = groups.get(a.type) ?? [];
      list.push({ id: a.id, name: a.name, balance: b, currency: a.currency });
      groups.set(a.type, list);
    }
    return [...groups];
  }, [lookups, balances.data]);

  const hasData = (trend.data?.length ?? 0) > 0 || (lookups?.accounts.length ?? 0) > 1;

  if (worth.error) return <QueryError error={worth.error} />;

  return (
    <>
      <PageHeader
        title="Tổng quan"
        description={
          isCurrent ? "Số liệu tính đến hôm nay" : `Số liệu đến hết ${formatMonth(month)}`
        }
        actions={
          <MonthPicker
            value={month}
            onChange={(m) => {
              void navigate({ search: { month: m === currentMonth() ? undefined : m } });
            }}
          />
        }
      />

      {review.data ? (
        <Link
          to="/transactions"
          search={{ review: true }}
          className="mb-4 flex items-center gap-2 rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm hover:bg-warning/15"
        >
          <CircleAlertIcon className="size-4 text-warning" aria-hidden />
          <span>
            <strong>{review.data}</strong> giao dịch cần duyệt danh mục
          </span>
          <span className="ml-auto font-medium text-primary">Duyệt ngay →</span>
        </Link>
      ) : null}

      {!hasData && lookups ? (
        <Card className="mb-6">
          <EmptyState
            title="Bắt đầu sổ tài chính của bạn"
            description="Thêm tài khoản và giao dịch đầu tiên, hoặc tải dữ liệu demo trong Cài đặt."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  className={buttonClass()}
                  onClick={() => {
                    openNew();
                  }}
                >
                  <PlusIcon /> Thêm giao dịch
                </Button>
              </div>
            }
          />
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="Tài sản ròng"
          value={worth.data?.total}
          hint={
            worth.data
              ? `Nợ: ${formatMoney(Math.abs(worth.data.liabilities))} · Phải thu: ${formatMoney(worth.data.receivables)}`
              : undefined
          }
        />
        <Stat label={`Thu ${formatMonth(month).toLowerCase()}`} value={income} />
        <Stat label={`Chi ${formatMonth(month).toLowerCase()}`} value={expense} />
        <Stat
          label="Chênh lệch"
          value={income !== undefined && expense !== undefined ? income - expense : undefined}
          tone="auto"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Thu chi 12 tháng</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.data ? (
              <BarChart
                title="Thu và chi theo tháng"
                series={[
                  { key: "income", label: "Thu", className: "fill-chart-1" },
                  { key: "expense", label: "Chi", className: "fill-chart-2" },
                ]}
                data={Array.from({ length: 12 }, (_, i) => {
                  const m = addMonths(month, i - 11);
                  const t = trend.data.find((x) => x.month === m);
                  return {
                    label: `T${String(Number(m.slice(5)))}`,
                    values: { income: t?.income ?? 0, expense: t?.expense ?? 0 },
                  };
                })}
                selectedIndex={11}
                onSelect={(i) => {
                  void navigate({ search: { month: addMonths(month, i - 11) } });
                }}
              />
            ) : (
              <Skeleton className="h-56 w-full" />
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Chi theo danh mục</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseByPrimary.length ? (
              <ShareBars
                items={expenseByPrimary}
                barClassName="bg-chart-2"
                onSelect={(key) => {
                  void navigate({ to: "/transactions", search: { month, category: key } });
                }}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Chưa có chi tiêu trong tháng
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Số dư tài khoản</CardTitle>
          <Link to="/accounts" className="text-sm font-medium text-primary hover:underline">
            Tất cả tài khoản →
          </Link>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {accountGroups.map(([type, list]) => (
            <div key={type}>
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {ACCOUNT_TYPE_LABELS[type]}
              </h3>
              <ul className="grid gap-1.5">
                {list.map((a) => (
                  <li key={a.id}>
                    <Link
                      to="/accounts/$accountId"
                      params={{ accountId: a.id }}
                      className="flex items-baseline justify-between gap-2 rounded px-1 text-sm hover:bg-accent"
                    >
                      <span className="truncate">{a.name}</span>
                      <MoneyText
                        amount={a.balance}
                        currency={a.currency as "VND" | "USD"}
                        tone="negative-only"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {accountGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có tài khoản.</p>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
