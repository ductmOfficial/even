import { exportBackup, isBackup, resetAll, restoreBackup, seedDemo, setSetting } from "@even/db";
import { todayIso } from "@even/domain";
import { Button } from "@ductmofficial/sen-ui";
import {
  AmountField,
  buttonClass,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  linkButtonClass,
  Switch,
  toast,
} from "@even/ui";
import { DatabaseIcon, DownloadIcon, SparklesIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "../components/dialogs";
import { SelectField } from "../components/fields";
import { PageHeader } from "../components/page";
import { getDb } from "../db/client";
import { errorMessage, useLedgerMutation } from "../data/mutate";
import { useFxRates } from "../data/queries";
import { usePreferences, type Theme } from "../lib/store";

export function SettingsPage() {
  const fx = useFxRates();
  const { theme, setTheme, privacy, togglePrivacy } = usePreferences();
  const [rate, setRate] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<"reset" | "demo" | null>(null);
  const [pendingRestore, setPendingRestore] = useState<unknown>(null);

  const saveRate = useLedgerMutation(async (db, value: number) => setSetting(db, "fx.USD", value), {
    success: "Đã lưu tỷ giá",
  });
  const reset = useLedgerMutation(async (db) => resetAll(db), {
    success: "Đã xoá toàn bộ dữ liệu",
  });
  const demo = useLedgerMutation(async (db) => seedDemo(db), {
    success: (n) => `Đã tạo ${String(n)} giao dịch demo`,
  });
  const restore = useLedgerMutation(
    async (db, data: unknown) => {
      if (!isBackup(data)) throw new Error("File không phải bản sao lưu của Even");
      await restoreBackup(db, data);
    },
    { success: "Đã khôi phục dữ liệu" },
  );

  const download = async () => {
    try {
      const backup = await exportBackup(await getDb());
      const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `even-backup-${todayIso()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <>
      <PageHeader title="Cài đặt" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tỷ giá</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <AmountField
              label="1 USD = ? VND"
              description="Dùng để quy đổi số dư USD. Tỷ giá tự động sẽ có sau."
              className="flex-1"
              value={rate ?? fx.data?.USD ?? null}
              onValueChange={setRate}
            />
            <Button
              disabled={!rate || saveRate.isPending}
              onClick={() => {
                if (rate) saveRate.mutate(rate);
              }}
            >
              Lưu
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Giao diện</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <SelectField
              label="Chế độ màu"
              value={theme}
              onChange={(v) => {
                setTheme(v as Theme);
              }}
              options={[
                { value: "system", label: "Theo hệ thống" },
                { value: "light", label: "Sáng" },
                { value: "dark", label: "Tối" },
              ]}
            />
            <Switch isSelected={privacy} onChange={togglePrivacy}>
              Ẩn số tiền (làm mờ, rê chuột để xem)
            </Switch>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sao lưu & khôi phục</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Dữ liệu chỉ nằm trong trình duyệt này (IndexedDB). Hãy sao lưu định kỳ cho đến khi có
              đồng bộ giữa các thiết bị.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className={buttonClass()}
                onClick={() => {
                  void download();
                }}
              >
                <DownloadIcon /> Tải bản sao lưu (.json)
              </Button>
              <label
                className={linkButtonClass(
                  "secondary",
                  {},
                  "cursor-pointer focus-within:outline-2 focus-within:outline-ring",
                )}
              >
                <UploadIcon /> Khôi phục từ file
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    void file.text().then(
                      (text) => {
                        setPendingRestore(JSON.parse(text) as unknown);
                      },
                      (error: unknown) => {
                        toast.error(errorMessage(error));
                      },
                    );
                  }}
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dữ liệu</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className={buttonClass()}
              onClick={() => {
                setConfirm("demo");
              }}
            >
              <SparklesIcon /> Tạo dữ liệu demo
            </Button>
            <Button
              variant="secondary"
              className={buttonClass({ tone: "danger" })}
              onClick={() => {
                setConfirm("reset");
              }}
            >
              <Trash2Icon /> Xoá toàn bộ dữ liệu
            </Button>
            <p className="flex w-full items-center gap-1.5 text-xs text-muted-foreground">
              <DatabaseIcon className="size-3.5" aria-hidden /> PGlite (Postgres WASM) trong Web
              Worker · lưu tại IndexedDB “even”
            </p>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm === "demo"}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
        title="Tạo dữ liệu demo?"
        description="Thêm 6 tháng dữ liệu hư cấu (tài khoản, người, giao dịch). Nên dùng trên sổ trống."
        confirmLabel="Tạo"
        onConfirm={() => {
          demo.mutate(undefined);
        }}
      />
      <ConfirmDialog
        open={confirm === "reset"}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
        title="Xoá toàn bộ dữ liệu?"
        description="Mọi tài khoản, giao dịch, luật và danh mục tự tạo sẽ bị xoá. Hãy tải bản sao lưu trước."
        confirmLabel="Xoá hết"
        destructive
        onConfirm={() => {
          reset.mutate(undefined);
        }}
      />
      <ConfirmDialog
        open={pendingRestore !== null}
        onOpenChange={(o) => {
          if (!o) setPendingRestore(null);
        }}
        title="Khôi phục từ bản sao lưu?"
        description="Dữ liệu hiện tại sẽ bị thay thế hoàn toàn."
        confirmLabel="Khôi phục"
        destructive
        onConfirm={() => {
          restore.mutate(pendingRestore);
        }}
      />
    </>
  );
}
