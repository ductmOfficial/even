import type { ComponentProps } from "react";

import { cx } from "./cx.js";

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", type = "button", className, ...props }: ButtonProps) {
  return <button type={type} className={cx("btn", `btn-${variant}`, className)} {...props} />;
}
