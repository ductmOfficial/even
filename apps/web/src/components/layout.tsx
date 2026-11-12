import { Button } from "@ductmofficial/sen-ui";
import { buttonClass, cn, Kbd } from "@even/ui";
import { Link, Outlet } from "@tanstack/react-router";
import {
  ArrowLeftRightIcon,
  EyeIcon,
  EyeOffIcon,
  FileSpreadsheetIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  MenuIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TagsIcon,
  UsersIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useNeedsReviewCount } from "../data/queries";
import { usePreferences, useUi } from "../lib/store";
import { CommandPalette } from "./command-palette";
import { TransactionDialog } from "./transaction-form";

const NAV = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboardIcon },
  { to: "/transactions", label: "Giao dịch", icon: ArrowLeftRightIcon },
  { to: "/accounts", label: "Tài khoản", icon: LandmarkIcon },
  { to: "/people", label: "Công nợ", icon: UsersIcon },
  { to: "/categories", label: "Danh mục & luật", icon: TagsIcon },
  { to: "/import", label: "Import Excel", icon: FileSpreadsheetIcon },
  { to: "/settings", label: "Cài đặt", icon: SettingsIcon },
] as const;

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
      target.getAttribute("role") === "combobox")
  );
}

export function Layout() {
  const { openNewTransaction, setPaletteOpen, txDialog } = useUi();
  const { privacy, togglePrivacy } = usePreferences();
  const review = useNeedsReviewCount();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!useUi.getState().paletteOpen);
        return;
      }
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        isTyping(e.target) ||
        useUi.getState().txDialog.open
      )
        return;
      if (e.key === "n") {
        e.preventDefault();
        openNewTransaction();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [openNewTransaction, setPaletteOpen]);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-card focus:p-2"
      >
        Bỏ qua điều hướng
      </a>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 border-r bg-card p-3 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 px-2 pt-1 pb-4">
          <img src="/favicon.svg" alt="" className="size-7" />
          <span className="text-lg font-semibold tracking-tight">Even</span>
        </div>
        <Button
          className={buttonClass({}, "mb-3 w-full justify-between")}
          onClick={() => {
            openNewTransaction();
            setNavOpen(false);
          }}
        >
          <span className="inline-flex items-center gap-2">
            <PlusIcon /> Thêm giao dịch
          </span>
          <Kbd className="border-(--sen-color-on-accent)/30 bg-(--sen-color-on-accent)/15 text-(--sen-color-on-accent)">
            N
          </Kbd>
        </Button>
        <nav aria-label="Chính">
          <ul className="grid gap-0.5">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.to === "/", includeSearch: false }}
                  onClick={() => {
                    setNavOpen(false);
                  }}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:font-medium data-[status=active]:text-foreground [&_svg]:size-4"
                >
                  <item.icon aria-hidden />
                  {item.label}
                  {item.to === "/transactions" && review.data ? (
                    <span
                      className="ml-auto rounded-full bg-warning/25 px-1.5 text-xs font-medium text-foreground"
                      title="Giao dịch cần duyệt"
                    >
                      {review.data}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="absolute inset-x-3 bottom-3 grid gap-1">
          <Button
            variant="secondary"
            className={buttonClass(
              { tone: "ghost", size: "sm" },
              "justify-start text-muted-foreground",
            )}
            onClick={() => {
              setPaletteOpen(true);
            }}
          >
            <SearchIcon /> Tìm & lệnh <Kbd className="ml-auto">⌘K</Kbd>
          </Button>
          <Button
            variant="secondary"
            className={buttonClass(
              { tone: "ghost", size: "sm" },
              "justify-start text-muted-foreground",
            )}
            aria-pressed={privacy}
            onClick={togglePrivacy}
          >
            {privacy ? <EyeOffIcon /> : <EyeIcon />} {privacy ? "Đang ẩn số tiền" : "Ẩn số tiền"}
          </Button>
        </div>
      </aside>
      {navOpen ? (
        <button
          type="button"
          aria-label="Đóng menu"
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => {
            setNavOpen(false);
          }}
        />
      ) : null}

      <div className="min-w-0">
        <div className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/90 px-4 py-2 backdrop-blur md:hidden">
          <Button
            variant="secondary"
            className={buttonClass({ tone: "ghost", size: "icon" })}
            aria-label="Mở menu"
            onClick={() => {
              setNavOpen(true);
            }}
          >
            <MenuIcon />
          </Button>
          <span className="font-semibold">Even</span>
          <Button
            className={buttonClass({ size: "icon" }, "ml-auto")}
            aria-label="Thêm giao dịch"
            onClick={() => {
              openNewTransaction();
            }}
          >
            <PlusIcon />
          </Button>
        </div>
        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
      {txDialog.open ? <TransactionDialog /> : null}
    </div>
  );
}
