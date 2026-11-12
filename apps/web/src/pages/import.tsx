import { createAccount, importDrafts, type ImportResult } from "@even/db";
import { formatMoney } from "@even/domain";
import {
  buildLegacyImport,
  resolveRows,
  suggestAccount,
  summarizeMapping,
  summarizeSources,
  type LegacySourceKey,
  type LegacyWorkbook,
} from "@even/parsers/plan";
import { Button } from "@ductmofficial/sen-ui";
import { Badge, Card, CardContent, CardHeader, CardTitle, MoneyText, toast } from "@even/ui";
import { Link } from "@tanstack/react-router";
import { CheckCircle2Icon, FileSpreadsheetIcon, LockIcon, UploadIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { SelectField, TreeField } from "../components/fields";
import { PageHeader } from "../components/page";
import { errorMessage, useLedgerMutation } from "../data/mutate";
import { categoryOptions, useLookups } from "../data/queries";
import { accountOptions } from "../lib/options";
import { parseWorkbookInWorker } from "../lib/parse-in-worker";

const NEW = "__new__";
const AUTO = "__auto__";

const CONFIDENCE: Record<
  string,
  { label: string; tone: "positive" | "primary" | "warning" | "negative" }
> = {
  exact: { label: "Khớp", tone: "positive" },
  refined: { label: "Theo mô tả", tone: "primary" },
  broad: { label: "Quá rộng", tone: "warning" },
  none: { label: "Chưa rõ", tone: "negative" },
};

export function ImportPage() {
  const lookups = useLookups();
  const [fileName, setFileName] = useState<string>();
  const [book, setBook] = useState<LegacyWorkbook>();
  const [parsing, setParsing] = useState(false);
  const [sourceMap, setSourceMap] = useState<Partial<Record<LegacySourceKey, string>>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [result, setResult] = useState<(ImportResult & { review: number }) | null>(null);

  const planned = useMemo(() => (book ? resolveRows(book.rows, overrides) : []), [book, overrides]);
  const sources = useMemo(() => (book ? summarizeSources(book.rows) : []), [book]);
  const mapping = useMemo(() => summarizeMapping(planned), [planned]);
  const legacyCategories = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const p of planned) {
      const key = p.row.legacyCategory ?? "";
      const v = map.get(key) ?? { count: 0, total: 0 };
      v.count++;
      v.total += p.row.amount;
      map.set(key, v);
    }
    return [...map].sort((a, b) => b[1].count - a[1].count);
  }, [planned]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    setResult(null);
    try {
      const parsed = await parseWorkbookInWorker(file);
      setBook(parsed);
      setFileName(file.name);
      setOverrides({});
      setSourceMap({});
    } catch (error) {
      toast.error(`Không đọc được file: ${errorMessage(error)}`);
    } finally {
      setParsing(false);
    }
  };

  const run = useLedgerMutation(
    async (db) => {
      const accountBySource: Partial<Record<LegacySourceKey, string>> = {};
      for (const s of sources) {
        const chosen = sourceMap[s.key] ?? NEW;
        accountBySource[s.key] =
          chosen === NEW ? await createAccount(db, suggestAccount(s.key)) : chosen;
      }
      const items = buildLegacyImport(planned, accountBySource);
      const res = await importDrafts(db, items, { source: "legacy-excel", filename: fileName });
      return { ...res, review: items.filter((i) => i.draft.needsReview).length };
    },
    { success: (r) => `Đã import ${String(r.inserted)} giao dịch` },
  );

  return (
    <>
      <PageHeader
        title="Import Excel"
        description="Chuyển dữ liệu từ file Excel ghi chép hằng tháng (các sheet tháng có cột Name / Category / Value / Note)."
      />

      <Card className="mb-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center hover:bg-accent/40 focus-within:ring-2 focus-within:ring-ring">
          <FileSpreadsheetIcon className="size-8 text-muted-foreground" aria-hidden />
          <span className="font-medium">{fileName ?? "Chọn file .xlsx"}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <LockIcon className="size-3" aria-hidden /> File được đọc ngay trên máy, không tải lên
            đâu cả.
          </span>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="sr-only"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <span className="mt-1 inline-flex items-center gap-1 text-sm text-primary">
            <UploadIcon className="size-4" aria-hidden /> {parsing ? "Đang đọc…" : "Chọn file"}
          </span>
        </label>
      </Card>

      {result ? (
        <Card className="mb-4 border-positive/40 bg-positive/5 p-4">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2Icon className="size-5 text-positive" aria-hidden /> Đã import{" "}
            {result.inserted} giao dịch
            {result.skipped ? ` (bỏ qua ${String(result.skipped)} dòng đã import trước đó)` : ""}.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.review} giao dịch cần xem lại danh mục hoặc cách ghi nhận.{" "}
            <Link to="/transactions" search={{ review: true }} className="font-medium text-primary">
              Mở hàng chờ duyệt →
            </Link>
          </p>
        </Card>
      ) : null}

      {book && lookups ? (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>1. Dữ liệu tìm thấy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {book.sheets.map((s) => (
                  <div key={s.name} className="rounded-lg border px-3 py-2 text-sm">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.count} dòng ·{" "}
                      <span data-money>{formatMoney(s.total, "VND", { compact: true })}</span>
                    </div>
                  </div>
                ))}
              </div>
              {book.warnings.length ? (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    {book.warnings.length} dòng bị bỏ qua
                  </summary>
                  <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                    {book.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Nguồn tiền → tài khoản</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <p className="text-sm text-muted-foreground">
                Cột Note của file được dùng để đoán thẻ đã thanh toán. Chọn tài khoản có sẵn hoặc để
                app tạo mới.
              </p>
              {sources.map((s) => (
                <div key={s.key} className="grid items-center gap-2 sm:grid-cols-[1fr_auto_18rem]">
                  <span className="text-sm">{s.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {s.count} dòng · <span data-money>{formatMoney(s.total)}</span>
                  </span>
                  <SelectField
                    label={`Tài khoản cho ${s.label}`}
                    hideLabel
                    value={sourceMap[s.key] ?? NEW}
                    onChange={(v) => {
                      setSourceMap((m) => ({ ...m, [s.key]: v }));
                    }}
                    options={[
                      { value: NEW, label: `Tạo mới: ${suggestAccount(s.key).name}` },
                      ...accountOptions(lookups.accounts, { people: true }),
                    ]}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Danh mục cũ → danh mục mới</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                App tự tách danh mục cũ theo mô tả (VD “Chăm sóc người thân” + Pharmacity → Y tế ›
                Thuốc). Ghi đè nếu muốn gán cả nhóm vào một mục.
              </p>
              <ul className="grid gap-3">
                {legacyCategories.map(([legacy, info]) => (
                  <li key={legacy} className="rounded-lg border p-3">
                    <div className="grid items-center gap-2 sm:grid-cols-[1fr_18rem]">
                      <div>
                        <div className="font-medium">{legacy || "(không có danh mục)"}</div>
                        <div className="text-xs text-muted-foreground">
                          {info.count} dòng · <span data-money>{formatMoney(info.total)}</span>
                        </div>
                      </div>
                      {legacy ? (
                        <TreeField
                          label={`Ghi đè danh mục cho ${legacy}`}
                          hideLabel
                          value={overrides[legacy] ?? AUTO}
                          onChange={(v) => {
                            setOverrides((o) =>
                              Object.fromEntries(
                                Object.entries({ ...o, [legacy]: v }).filter(
                                  ([, value]) => value !== AUTO,
                                ),
                              ),
                            );
                          }}
                          options={[
                            { value: AUTO, label: "Tự động", depth: 0 },
                            ...categoryOptions(lookups.categories),
                          ]}
                        />
                      ) : null}
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {mapping
                        .filter((m) => (m.legacyCategory ?? "") === legacy)
                        .map((m) => (
                          <li key={m.categoryId}>
                            <Badge
                              tone={CONFIDENCE[m.confidence]?.tone ?? "neutral"}
                              title={CONFIDENCE[m.confidence]?.label}
                            >
                              {lookups.categoryLabel(m.categoryId)} · {m.count}
                            </Badge>
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="flex flex-wrap items-center gap-3 p-4">
            <div className="text-sm">
              <strong>{planned.length}</strong> giao dịch · tổng{" "}
              <MoneyText
                amount={planned.reduce((s, p) => s + p.row.amount, 0)}
                className="font-medium"
              />{" "}
              · {planned.filter((p) => p.reviewReason).length} cần duyệt sau khi import
            </div>
            <Button
              className="ml-auto"
              disabled={run.isPending || planned.length === 0}
              onClick={() => {
                run.mutate(undefined, { onSuccess: setResult });
              }}
            >
              {run.isPending ? "Đang import…" : "Import"}
            </Button>
          </Card>
        </div>
      ) : null}
    </>
  );
}
