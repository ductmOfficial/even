/** Joins class names, skipping falsy values: `cx("a", false, "b")` → `"a b"`. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
