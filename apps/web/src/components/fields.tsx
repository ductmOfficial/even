import { ComboBox, ComboBoxItem, Select, SelectItem } from "@ductmofficial/sen-ui";
import { cn } from "@even/ui";
import type { ReactNode } from "react";
import { Header, ListBoxSection } from "react-aria-components";

export interface SelectOption {
  value: string;
  label: string;
  /** Options with a group are listed under that heading. */
  group?: string;
}

function groupOptions<T extends SelectOption>(options: readonly T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const o of options) {
    const list = groups.get(o.group ?? "") ?? [];
    list.push(o);
    groups.set(o.group ?? "", list);
  }
  return [...groups];
}

const sectionHeader = "px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground";

interface FieldBase {
  label: ReactNode;
  /** Keep the label (the field's first child) for assistive technology only, e.g. in a toolbar. */
  hideLabel?: boolean;
  description?: ReactNode;
  error?: ReactNode;
  placeholder?: string;
  isDisabled?: boolean;
  className?: string;
}

export interface SelectFieldProps extends FieldBase {
  value: string | undefined;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
}

/** Sen UI's Select fed from a list of options, grouped into sections. */
export function SelectField({
  label,
  hideLabel,
  value,
  onChange,
  options,
  className,
  ...props
}: SelectFieldProps) {
  return (
    <Select
      {...props}
      label={label}
      value={value ?? null}
      onChange={(key) => {
        if (typeof key === "string") onChange(key);
      }}
      className={cn(hideLabel && "[&>:first-child]:sr-only", className)}
    >
      {groupOptions(options).map(([group, items]) => {
        const children = items.map((o) => (
          <SelectItem key={o.value} id={o.value} textValue={o.label}>
            {o.label}
          </SelectItem>
        ));
        return group ? (
          <ListBoxSection key={group} id={`group:${group}`}>
            <Header className={sectionHeader}>{group}</Header>
            {children}
          </ListBoxSection>
        ) : (
          children
        );
      })}
    </Select>
  );
}

export interface TreeOption extends SelectOption {
  /** The parent path, shown before the label once selected and searched as well. */
  hint?: string;
  /** Indentation level in the list. */
  depth?: number;
}

/** Lowercase and without Vietnamese diacritics, so "ca phe" finds "Cà phê". */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export interface TreeFieldProps extends FieldBase {
  value: string | undefined;
  onChange: (value: string) => void;
  options: readonly TreeOption[];
}

/**
 * Sen UI's ComboBox for long tree-shaped lists such as categories: type to filter by name or
 * parent, ignoring accents.
 */
export function TreeField({
  label,
  hideLabel,
  value,
  onChange,
  options,
  className,
  ...props
}: TreeFieldProps) {
  return (
    <ComboBox
      {...props}
      label={label}
      emptyText="Không tìm thấy"
      value={value ?? null}
      onChange={(key) => {
        if (typeof key === "string") onChange(key);
      }}
      defaultFilter={(text, input) => fold(text).includes(fold(input))}
      menuTrigger="focus"
      className={cn(hideLabel && "[&>:first-child]:sr-only", className)}
    >
      {groupOptions(options).map(([group, items]) => {
        const children = items.map((o) => (
          <ComboBoxItem
            key={o.value}
            id={o.value}
            textValue={o.hint ? `${o.hint} › ${o.label}` : o.label}
          >
            <span
              className={cn((o.depth ?? 0) === 0 && "font-medium")}
              style={{ paddingInlineStart: `${String((o.depth ?? 0) * 0.75)}rem` }}
            >
              {o.label}
            </span>
          </ComboBoxItem>
        ));
        return group ? (
          <ListBoxSection key={group} id={`group:${group}`}>
            <Header className={sectionHeader}>{group}</Header>
            {children}
          </ListBoxSection>
        ) : (
          children
        );
      })}
    </ComboBox>
  );
}
