import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";

import { cn } from "./cn";

/** Lowercase and without Vietnamese diacritics, so "them" finds "Thêm". */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/** Matches when every word typed appears in the item's value or keywords, ignoring accents. */
export function commandFilter(value: string, search: string, keywords?: string[]): number {
  const haystack = fold([value, ...(keywords ?? [])].join(" "));
  return fold(search)
    .split(/\s+/)
    .every((word) => haystack.includes(word))
    ? 1
    : 0;
}

export function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      filter={commandFilter}
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function CommandInput({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2 border-b px-3">
      <SearchIcon className="size-4 shrink-0 opacity-50" aria-hidden />
      <CommandPrimitive.Input
        className={cn(
          "flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn("max-h-80 overflow-x-hidden overflow-y-auto p-1", className)}
      {...props}
    />
  );
}

export function CommandEmpty(props: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground" {...props} />
  );
}

export function CommandGroup({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export function CommandShortcut({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
}

export interface CommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names the dialog and the command menu for assistive technology. */
  label: string;
  children: ReactNode;
}

/**
 * The command palette (⌘K): cmdk inside a React Aria modal, which traps focus, closes on Escape
 * or an outside click and returns focus to where it was.
 */
export function CommandDialog({ open, onOpenChange, label, children }: CommandDialogProps) {
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 bg-black/40"
    >
      <Modal className="fixed top-[15vh] left-1/2 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-2xl">
        <Dialog aria-label={label} className="outline-none">
          <Command label={label}>{children}</Command>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
