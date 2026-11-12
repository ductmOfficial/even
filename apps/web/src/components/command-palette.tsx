import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@even/ui";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRightIcon,
  CircleAlertIcon,
  EyeIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
  UsersIcon,
} from "lucide-react";

import { useAccounts } from "../data/queries";
import { usePreferences, useUi } from "../lib/store";

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, openNewTransaction } = useUi();
  const { togglePrivacy, setTheme, theme } = usePreferences();
  const accounts = useAccounts();
  const navigate = useNavigate();

  const run = (fn: () => void) => () => {
    setPaletteOpen(false);
    fn();
  };

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen} label="Tìm và chạy lệnh">
      <CommandInput placeholder="Gõ lệnh hoặc tên trang…" />
      <CommandList>
        <CommandEmpty>Không có kết quả</CommandEmpty>
        <CommandGroup heading="Thao tác">
          <CommandItem
            onSelect={run(() => {
              openNewTransaction();
            })}
          >
            <PlusIcon /> Thêm giao dịch <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={run(() => {
              openNewTransaction({ mode: "transfer" });
            })}
          >
            <ArrowLeftRightIcon /> Chuyển tiền giữa tài khoản
          </CommandItem>
          <CommandItem
            onSelect={run(() => {
              void navigate({ to: "/transactions", search: { review: true } });
            })}
          >
            <CircleAlertIcon /> Duyệt giao dịch cần xem lại
          </CommandItem>
          <CommandItem onSelect={run(togglePrivacy)}>
            <EyeIcon /> Bật/tắt ẩn số tiền
          </CommandItem>
          <CommandItem
            onSelect={run(() => {
              setTheme(theme === "dark" ? "light" : "dark");
            })}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />} Đổi giao diện sáng/tối
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Trang">
          {(
            [
              ["/", "Tổng quan", LayoutDashboardIcon],
              ["/transactions", "Giao dịch", ArrowLeftRightIcon],
              ["/accounts", "Tài khoản", LandmarkIcon],
              ["/people", "Công nợ", UsersIcon],
              ["/settings", "Cài đặt", SettingsIcon],
            ] as const
          ).map(([to, label, Icon]) => (
            <CommandItem
              key={to}
              onSelect={run(() => {
                void navigate({ to });
              })}
            >
              <Icon /> {label}
            </CommandItem>
          ))}
        </CommandGroup>
        {accounts.data?.length ? (
          <CommandGroup heading="Tài khoản">
            {accounts.data
              .filter((a) => a.type !== "equity")
              .map((a) => (
                <CommandItem
                  key={a.id}
                  value={`account ${a.name}`}
                  onSelect={run(() => {
                    void navigate({ to: "/accounts/$accountId", params: { accountId: a.id } });
                  })}
                >
                  <LandmarkIcon /> {a.name}
                </CommandItem>
              ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
