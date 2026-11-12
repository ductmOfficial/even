import { TextField, type TextFieldProps } from "@ductmofficial/sen-ui";
import { formatMoney, fromMinor, parseAmount, toMinor, type Currency } from "@even/domain";
import { useState, type ComponentProps } from "react";

import { cn } from "./cn";

export interface MoneyTextProps extends Omit<ComponentProps<"span">, "children"> {
  /** Minor units. */
  amount: number;
  currency?: Currency;
  signed?: boolean;
  compact?: boolean;
  /** Color by sign (green in, red out) or keep neutral. */
  tone?: "auto" | "neutral" | "negative-only";
}

/** A formatted amount, marked with data-money so privacy mode can blur it. */
export function MoneyText({
  amount,
  currency = "VND",
  signed,
  compact,
  tone = "neutral",
  className,
  ...props
}: MoneyTextProps) {
  const color =
    tone === "auto"
      ? amount > 0
        ? "text-positive"
        : amount < 0
          ? "text-negative"
          : undefined
      : tone === "negative-only" && amount < 0
        ? "text-negative"
        : undefined;
  return (
    <span data-money className={cn("whitespace-nowrap tabular-nums", color, className)} {...props}>
      {formatMoney(amount, currency, { signed, compact })}
    </span>
  );
}

export interface AmountFieldProps extends Omit<
  TextFieldProps,
  "value" | "defaultValue" | "onChange" | "type"
> {
  /** Minor units, or null when empty or invalid. */
  value: number | null;
  onValueChange: (minor: number | null) => void;
  currency?: Currency;
  /** Keep the label for assistive technology only, e.g. in a row of inputs. */
  hideLabel?: boolean;
}

function display(value: number | null, currency: Currency): string {
  if (value === null) return "";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(
    fromMinor(value, currency),
  );
}

/**
 * Sen UI's `TextField` for amounts: accepts "120k", "1,5tr" or "1.234.567" and tidies the display
 * on blur.
 */
export function AmountField({
  value,
  onValueChange,
  currency = "VND",
  hideLabel,
  className,
  onBlur,
  ...props
}: AmountFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <TextField
      inputMode="decimal"
      autoComplete="off"
      {...props}
      className={cn(
        "[&_input]:text-right [&_input]:tabular-nums",
        hideLabel && "[&>:first-child]:sr-only",
        className,
      )}
      value={draft ?? display(value, currency)}
      onChange={(e) => {
        setDraft(e.target.value);
        const parsed = parseAmount(e.target.value, currency);
        onValueChange(parsed === null ? null : toMinor(parsed, currency));
      }}
      onBlur={(e) => {
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}
