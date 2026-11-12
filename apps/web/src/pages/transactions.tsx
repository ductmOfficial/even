import { deleteTransactions, markReviewed, setCategory } from "@even/db";
import { Button, TextField } from "@ductmofficial/sen-ui";
import { currentMonth, monthRange, normalizeText } from "@even/domain";
import { buttonClass, Card, EmptyState, MoneyText, Skeleton, Switch } from "@even/ui";
import { getRouteApi } from "@tanstack/react-router";
import { CheckCheckIcon, InboxIcon, PlusIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { ConfirmDialog } from "../components/dialogs";
import { SelectField, TreeField } from "../components/fields";
import { MonthPicker } from "../components/month-picker";
import { PageHeader, QueryError } from "../components/page";
import { TransactionTable } from "../components/transaction-table";
import { useLedgerMutation } from "../data/mutate";
import { categoryOptions, useLookups, useTransactions } from "../data/queries";
import { accountOptions } from "../lib/options";
import { useUi } from "../lib/store";
import { toRow } from "../lib/transactions";

const route = getRouteApi("/transactions");
const ALL = "__all__";

export function TransactionsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const lookups = useLookups();
  const openNew = useUi((s) => s.openNewTransaction);
  const month = search.month ?? currentMonth();
  const review = search.review ?? false;
  const [query, setQuery] = useState(search.q ?? "");
  const deferredQuery = useDeferredValue(query);
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [bulkCategory, setBulkCategory] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categoryIds = useMemo(
    () => (search.category && lookups ? lookups.descendants(search.category) : undefined),
    [search.category, lookups],
  );
  // The review queue spans all months; otherwise show one month.
  const range = review ? {} : monthRange(month);
  const txs = useTransactions({
    ...range,
    accountId: search.account,
    categoryIds,
    needsReview: review ? true : undefined,
  });

  const rows = useMemo(() => {
    if (!lookups || !txs.data) return [];
    const all = txs.data.map((t) => toRow(t, lookups));
    const q = normalizeText(deferredQuery.trim());
    return q ? all.filter((r) => normalizeText(r.searchText).includes(q)) : all;
  }, [txs.data, lookups, deferredQuery]);

  const selectedIds = [...selection];
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const r of rows) {
      if (r.net > 0) income += r.net;
      else expense -= r.net;
    }
    return { income, expense };
  }, [rows]);

  const clear = () => {
    setSelection(new Set());
  };
  const recategorize = useLedgerMutation(
    async (db, input: { ids: string[]; categoryId: string }) =>
      setCategory(db, input.ids, input.categoryId),
    { success: "Đã cập nhật danh mục" },
  );
  const reviewed = useLedgerMutation(async (db, ids: string[]) => markReviewed(db, ids), {
    success: "Đã đánh dấu đã duyệt",
  });
  const remove = useLedgerMutation(async (db, ids: string[]) => deleteTransactions(db, ids), {
    success: "Đã xoá",
  });

  const setSearch = (patch: Partial<typeof search>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) });
    clear();
  };

  if (txs.error) return <QueryError error={txs.error} />;

  return (
    <>
      <PageHeader
        title={review ? "Duyệt giao dịch" : "Giao dịch"}
        description={
          review
            ? "Giao dịch import hoặc tự phân loại chưa chắc chắn. Chọn nhiều dòng để gán danh mục một lần."
            : undefined
        }
        actions={
          <>
            {!review ? (
              <MonthPicker
                value={month}
                onChange={(m) => {
                  setSearch({ month: m === currentMonth() ? undefined : m });
                }}
              />
            ) : null}
            <Button
              className={buttonClass()}
              onClick={() => {
                openNew();
              }}
            >
              <PlusIcon /> Thêm
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b p-3">
          <div className="relative min-w-48 flex-1">
            <SearchIcon
              className="pointer-events-none absolute bottom-2.5 left-2.5 size-4 text-muted-foreground"
              aria-hidden
            />
            <TextField
              label="Tìm giao dịch"
              type="search"
              placeholder="Tìm mô tả, ghi chú…"
              className="[&_input]:pl-8 [&>:first-child]:sr-only"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
            />
          </div>
          {lookups ? (
            <>
              <SelectField
                label="Lọc theo tài khoản"
                hideLabel
                className="w-48"
                value={search.account ?? ALL}
                onChange={(v) => {
                  setSearch({ account: v === ALL ? undefined : v });
                }}
                options={[
                  { value: ALL, label: "Mọi tài khoản" },
                  ...accountOptions(lookups.accounts, { people: true }),
                ]}
              />
              <TreeField
                label="Lọc theo danh mục"
                hideLabel
                className="w-56"
                value={search.category ?? ALL}
                onChange={(v) => {
                  setSearch({ category: v === ALL ? undefined : v });
                }}
                options={[
                  { value: ALL, label: "Mọi danh mục", depth: 0 },
                  ...categoryOptions(lookups.categories),
                ]}
              />
            </>
          ) : null}
          <Switch
            className="pb-2"
            isSelected={review}
            onChange={(v) => {
              setSearch({ review: v ? true : undefined });
            }}
          >
            Chỉ cần duyệt
          </Switch>
          {search.account || search.category ? (
            <Button
              variant="secondary"
              className={buttonClass({ tone: "ghost", size: "sm" }, "mb-0.5")}
              onClick={() => {
                setSearch({ account: undefined, category: undefined });
              }}
            >
              <XIcon /> Bỏ lọc
            </Button>
          ) : null}
        </div>

        {selectedIds.length > 0 && lookups ? (
          <div
            className="flex flex-wrap items-center gap-2 border-b bg-primary/5 p-3"
            role="toolbar"
            aria-label="Thao tác hàng loạt"
          >
            <span className="text-sm font-medium">Đã chọn {selectedIds.length}</span>
            <TreeField
              label="Gán danh mục cho các dòng đã chọn"
              hideLabel
              className="w-64"
              value={bulkCategory}
              onChange={(categoryId) => {
                setBulkCategory(categoryId);
                recategorize.mutate({ ids: selectedIds, categoryId }, { onSuccess: clear });
              }}
              placeholder="Gán danh mục…"
              options={categoryOptions(lookups.categories)}
            />
            <Button
              variant="secondary"
              className={buttonClass({ size: "sm" })}
              onClick={() => {
                reviewed.mutate(selectedIds, { onSuccess: clear });
              }}
            >
              <CheckCheckIcon /> Đã duyệt
            </Button>
            <Button
              variant="secondary"
              className={buttonClass({ tone: "danger", size: "sm" })}
              onClick={() => {
                setConfirmDelete(true);
              }}
            >
              <Trash2Icon /> Xoá
            </Button>
            <Button
              variant="secondary"
              className={buttonClass({ tone: "ghost", size: "sm" }, "ml-auto")}
              onClick={clear}
            >
              Bỏ chọn
            </Button>
          </div>
        ) : null}

        {txs.isPending || !lookups ? (
          <div className="grid gap-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <TransactionTable
            label={review ? "Giao dịch cần duyệt" : "Giao dịch"}
            rows={rows}
            selection={selection}
            onSelectionChange={setSelection}
            empty={
              <EmptyState
                icon={<InboxIcon />}
                title={review ? "Không còn giao dịch cần duyệt 🎉" : "Không có giao dịch"}
                description={review ? undefined : "Thử đổi tháng hoặc bỏ bộ lọc."}
              />
            }
          />
        )}

        <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t px-4 py-2.5 text-sm">
          <span className="mr-auto text-xs text-muted-foreground">
            Bấm vào một dòng hoặc nhấn Enter để sửa
          </span>
          <span className="text-muted-foreground">{rows.length} giao dịch</span>
          <span>
            Thu <MoneyText amount={totals.income} className="font-medium text-positive" />
          </span>
          <span>
            Chi <MoneyText amount={totals.expense} className="font-medium text-negative" />
          </span>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Xoá ${String(selectedIds.length)} giao dịch?`}
        description="Không thể hoàn tác."
        confirmLabel="Xoá"
        destructive
        onConfirm={() => {
          remove.mutate(selectedIds, { onSuccess: clear });
        }}
      />
    </>
  );
}
