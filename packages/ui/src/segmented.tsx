import type { Key } from "react-aria-components";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";

import { cn } from "./cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  "aria-label": string;
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  className?: string;
}

/**
 * A row of mutually exclusive toggle buttons for switching a form's mode, on React Aria's
 * ToggleButtonGroup. Exactly one option is always pressed. Use Sen UI's Tabs when each option has
 * its own panel.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  ...aria
}: SegmentedControlProps<T>) {
  return (
    <ToggleButtonGroup
      {...aria}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys: Set<Key>) => {
        const [next] = keys;
        if (typeof next === "string") onChange(next as T);
      }}
      className={cn("inline-flex w-fit gap-1 rounded-lg bg-muted p-1", className)}
    >
      {options.map((o) => (
        <ToggleButton
          key={o.value}
          id={o.value}
          className="cursor-default rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground outline-none data-focus-visible:outline-2 data-focus-visible:outline-ring data-hovered:text-foreground data-selected:bg-card data-selected:text-foreground data-selected:shadow-xs"
        >
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
