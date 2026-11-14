import { formatDate } from "@even/domain";
import { Badge, Card, CardContent, CardHeader, CardTitle, MoneyText } from "@even/ui";
import { Link } from "@tanstack/react-router";

import type { CardOverview } from "../data/queries";

/** "Còn 2 ngày", "Hôm nay", "Quá hạn 4 ngày". */
export function dueLabel(daysLeft: number | null): string {
  if (daysLeft === null) return "Chưa có hạn thanh toán";
  if (daysLeft === 0) return "Hạn thanh toán hôm nay";
  return daysLeft > 0 ? `Còn ${String(daysLeft)} ngày` : `Quá hạn ${String(-daysLeft)} ngày`;
}

export function DueBadge({ card }: { card: CardOverview }) {
  const { state, daysLeft } = card.status;
  if (state === "none") return null;
  if (state === "paid") return <Badge tone="positive">Đã trả đủ kỳ này</Badge>;
  return (
    <Badge tone={state === "overdue" || (daysLeft ?? 99) <= 3 ? "negative" : "warning"}>
      {dueLabel(daysLeft)}
    </Badge>
  );
}

/** The statement summary of a credit card, on its account page. */
export function CardStatusPanel({ card }: { card: CardOverview }) {
  const { statement, status } = card;
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>
          Kỳ sao kê {formatDate(statement.periodFrom)}–{formatDate(statement.periodTo)}
        </CardTitle>
        <DueBadge card={card} />
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Dư nợ cuối kỳ" amount={status.statementDue} />
        <Figure
          label={
            statement.dueDate
              ? `Còn phải trả trước ${formatDate(statement.dueDate)}`
              : "Còn phải trả"
          }
          amount={status.remaining}
          hint={
            status.minimumRemaining > 0
              ? `Tối thiểu còn ${status.minimumRemaining.toLocaleString("vi-VN")} ₫`
              : undefined
          }
        />
        <div>
          <div className="text-sm text-muted-foreground">Hạn mức đã dùng</div>
          {status.utilization === null ? (
            <span className="text-sm text-muted-foreground">Chưa rõ hạn mức</span>
          ) : (
            <>
              <span className="text-lg font-semibold tabular-nums">
                {Math.round(status.utilization * 100)}%
              </span>
              <div
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-label="Hạn mức đã dùng"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(status.utilization * 100)}
              >
                <div
                  className={status.utilization > 0.7 ? "h-full bg-negative" : "h-full bg-chart-1"}
                  style={{ width: `${String(Math.min(100, status.utilization * 100))}%` }}
                />
              </div>
              {statement.creditLimit ? (
                <span className="text-xs text-muted-foreground">
                  trên hạn mức <MoneyText amount={statement.creditLimit} />
                </span>
              ) : null}
            </>
          )}
        </div>
        <Figure label="Cashback trong kỳ" amount={card.cashback} />
        <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
          Theo sao kê gần nhất.{" "}
          <Link to="/reconcile" search={{ statement: statement.id }} className="text-primary">
            Mở đối soát →
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function Figure({ label, amount, hint }: { label: string; amount: number; hint?: string }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <MoneyText amount={amount} className="text-lg font-semibold" />
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
