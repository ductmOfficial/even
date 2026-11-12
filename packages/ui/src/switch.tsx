import type { ReactNode } from "react";
import { SwitchButton, SwitchField, type SwitchFieldProps } from "react-aria-components";

import { cn } from "./cn";

export interface SwitchProps extends Omit<SwitchFieldProps, "children" | "className"> {
  /** Visible label. Without one, pass `aria-label`. */
  children?: ReactNode;
  className?: string;
}

/**
 * An on/off switch on React Aria (`SwitchField` + `SwitchButton`), styled with the Sen UI tokens
 * because Sen UI has no switch yet. It is an input with role="switch", toggled with Space.
 */
export function Switch({ children, className, ...props }: SwitchProps) {
  return (
    <SwitchField {...props} className={cn("inline-flex data-disabled:opacity-50", className)}>
      <SwitchButton className="group inline-flex cursor-default items-center gap-2 text-sm">
        <span
          aria-hidden
          className="flex h-5 w-9 shrink-0 items-center rounded-full border border-input bg-muted p-0.5 transition-colors group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-ring group-data-selected:border-(--sen-color-accent) group-data-selected:bg-(--sen-color-accent) motion-reduce:transition-none"
        >
          <span className="size-3.5 rounded-full bg-muted-foreground transition-transform group-data-selected:translate-x-4 group-data-selected:bg-(--sen-color-on-accent) motion-reduce:transition-none" />
        </span>
        {children}
      </SwitchButton>
    </SwitchField>
  );
}
