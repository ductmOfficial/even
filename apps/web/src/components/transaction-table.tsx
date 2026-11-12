import { DataTable, type DataTableColumn } from "@ductmofficial/sen-ui";
import { formatDate } from "@even/domain";
import { Badge, cn, EmptyState, MoneyText } from "@even/ui";
import { ArrowLeftRightIcon, CircleAlertIcon, InboxIcon, UsersIcon } from "lucide-react";
import { useMemo, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

import { useUi } from "../lib/store";
import type { TransactionRow } from "../lib/transactions";

const ROW_HEIGHT = 52;

export interface TransactionTableProps {
  /** Names the table for assistive technology. */
  label: string;
  rows: readonly TransactionRow[];
  /** Ids of the selected rows; passing a handler turns selection on. */
  selection?: ReadonlySet<string>;
  onSelectionChange?: (selection: Set<string>) => void;
  /** Hide the account column (e.g. on an account's own page). */
  hideAccount?: boolean;
  /** Height of the scrolling body in pixels. */
  height?: number;
  empty?: ReactNode;
  className?: string;
}

/** The transaction id of the row an event happened in, unless it was on the selection checkbox. */
function rowIdFrom(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element) || target.closest("label")) return undefined;
  const row = target.closest('[role="row"]');
  return row?.querySelector<HTMLElement>("[data-row-id]")?.dataset.rowId;
}

/**
 * Transactions in Sen UI's virtualized DataTable: only the visible rows are in the DOM, so a year
 * of data scrolls smoothly. Columns sort by date, description and amount. Clicking a row, or
 * pressing Enter on it, opens it for editing.
 */
export function TransactionTable({
  label,
  rows,
  selection,
  onSelectionChange,
  hideAccount,
  height = 560,
  empty,
  className,
}: TransactionTableProps) {
  const openEdit = useUi((s) => s.openEditTransaction);

  const columns = useMemo(() => {
    const cols: DataTableColumn<TransactionRow>[] = [
      {
        id: "date",
        header: "Ngày",
        width: "7.5rem",
        sortValue: (r) => r.date,
        cell: (r) => (
          <span className="text-muted-foreground tabular-nums">{formatDate(r.date)}</span>
        ),
      },
      {
        id: "description",
        header: "Mô tả",
        width: "minmax(12rem, 2fr)",
        sortValue: (r) => r.description,
        cell: (r) => (
          <div className="min-w-0" data-row-id={r.id}>
            <div className="flex items-center gap-1.5">
              {r.kind === "transfer" ? (
                <ArrowLeftRightIcon
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-label="Chuyển tiền"
                />
              ) : null}
              <span className="truncate font-medium">{r.description}</span>
              {r.needsReview ? (
                <Badge tone="warning">
                  <CircleAlertIcon className="size-3" aria-hidden /> Cần duyệt
                </Badge>
              ) : null}
              {r.people.length ? (
                <Badge tone="outline" title={`Chia với ${r.people.join(", ")}`}>
                  <UsersIcon className="size-3" aria-hidden /> {r.people.join(", ")}
                </Badge>
              ) : null}
            </div>
            {r.note ? <div className="truncate text-xs text-muted-foreground">{r.note}</div> : null}
          </div>
        ),
      },
      {
        id: "category",
        header: "Danh mục",
        cell: (r) => (
          <span className="block truncate text-muted-foreground">{r.categoryLabel}</span>
        ),
      },
    ];
    if (!hideAccount) {
      cols.push({
        id: "account",
        header: "Tài khoản",
        cell: (r) => <span className="block truncate text-muted-foreground">{r.accountLabel}</span>,
      });
    }
    cols.push({
      id: "amount",
      header: "Số tiền",
      width: "9rem",
      align: "end",
      sortValue: (r) => r.net || r.amount,
      cell: (r) => (
        <MoneyText
          className="font-medium"
          amount={r.amount}
          currency={r.currency}
          signed
          tone={r.kind === "transfer" && !hideAccount ? "neutral" : "auto"}
        />
      ),
    });
    return cols;
  }, [hideAccount]);

  const onClick = (e: MouseEvent) => {
    const id = rowIdFrom(e.target);
    if (id) openEdit(id);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const id = rowIdFrom(e.target);
    if (id) openEdit(id);
  };

  return (
    // Row clicks and Enter bubble up from the grid's cells; the grid itself handles the keyboard.
    <div
      className={cn("[&_[role=row]]:cursor-pointer", className)}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <DataTable
        aria-label={label}
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        getRowLabel={(r) => r.description}
        rowHeight={ROW_HEIGHT}
        height={rows.length === 0 ? 200 : height}
        selectionMode={onSelectionChange ? "multiple" : "none"}
        selectedIds={selection}
        onSelectionChange={onSelectionChange}
        emptyState={empty ?? <EmptyState icon={<InboxIcon />} title="Chưa có giao dịch" />}
        className="border-0"
      />
    </div>
  );
}
