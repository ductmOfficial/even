import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface Preferences {
  theme: Theme;
  privacy: boolean;
  setTheme: (theme: Theme) => void;
  togglePrivacy: () => void;
}

/** Per-device UI preferences (never financial data). */
export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      theme: "system",
      privacy: false,
      setTheme: (theme) => {
        set({ theme });
      },
      togglePrivacy: () => {
        set((s) => ({ privacy: !s.privacy }));
      },
    }),
    { name: "even:prefs" },
  ),
);

export interface TransactionDialogState {
  open: boolean;
  /** Edit an existing transaction. */
  editId?: string;
  /** Prefill for a new one. */
  defaults?: { accountId?: string; mode?: "expense" | "income" | "transfer" };
}

interface UiState {
  txDialog: TransactionDialogState;
  paletteOpen: boolean;
  openNewTransaction: (defaults?: TransactionDialogState["defaults"]) => void;
  openEditTransaction: (id: string) => void;
  closeTransaction: () => void;
  setPaletteOpen: (open: boolean) => void;
}

export const useUi = create<UiState>()((set) => ({
  txDialog: { open: false },
  paletteOpen: false,
  openNewTransaction: (defaults) => {
    set({ txDialog: { open: true, defaults }, paletteOpen: false });
  },
  openEditTransaction: (editId) => {
    set({ txDialog: { open: true, editId }, paletteOpen: false });
  },
  closeTransaction: () => {
    set({ txDialog: { open: false } });
  },
  setPaletteOpen: (paletteOpen) => {
    set({ paletteOpen });
  },
}));

/** The theme actually shown: "system" follows the operating system. */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Sen UI and Even's tokens follow `data-theme` on <html>; privacy mode blurs amounts. */
export function applyPreferences(theme: Theme, privacy: boolean): void {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(theme);
  root.dataset.privacy = privacy ? "on" : "off";
}
