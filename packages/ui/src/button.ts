import { cn } from "./cn";

export interface ButtonStyle {
  /**
   * Looks Sen UI's two button variants do not have: `ghost` (no background until hovered),
   * `danger` (red text), `danger-solid` (a filled red button for destructive confirmations) and
   * `link` (looks like a link).
   */
  tone?: "ghost" | "danger" | "danger-solid" | "link";
  size?: "sm" | "icon" | "icon-sm";
}

const TONES: Record<NonNullable<ButtonStyle["tone"]>, string> = {
  ghost: "border-transparent bg-transparent hover:bg-accent",
  danger: "text-destructive",
  "danger-solid": "border-destructive bg-destructive text-card hover:bg-destructive/90",
  link: "min-h-0 border-transparent bg-transparent p-0 font-medium text-primary underline-offset-4 hover:bg-transparent hover:underline",
};

const SIZES: Record<NonNullable<ButtonStyle["size"]>, string> = {
  sm: "min-h-8 px-3 py-1 text-xs",
  icon: "size-9 min-h-0 p-0",
  "icon-sm": "size-8 min-h-0 p-0",
};

/** Classes for Sen UI's `Button`: icons sized to the text, plus an optional extra look and size. */
export function buttonClass({ tone, size }: ButtonStyle = {}, className?: string): string {
  return cn(
    "shrink-0 whitespace-nowrap [&_svg]:size-4 [&_svg]:shrink-0",
    tone && TONES[tone],
    size && SIZES[size],
    className,
  );
}

/**
 * Classes that make a link look like Sen UI's `Button`, for navigation that should read as an
 * action. Use a real `Button` for anything that is not navigation.
 */
export function linkButtonClass(
  variant: "primary" | "secondary" = "secondary",
  style: ButtonStyle = {},
  className?: string,
): string {
  return buttonClass(
    style,
    cn(
      "inline-flex min-h-(--sen-control-height-md) items-center justify-center gap-2 rounded-md border px-4 py-2 font-semibold leading-tight transition-colors",
      variant === "primary"
        ? "border-(--sen-color-accent) bg-(--sen-color-accent) text-(--sen-color-on-accent) hover:bg-(--sen-color-accent-hover)"
        : "border-input bg-muted text-foreground hover:bg-(--sen-color-surface-hover)",
      className,
    ),
  );
}
