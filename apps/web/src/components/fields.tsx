import { ComboBox, ComboBoxItem, Select, SelectItem } from "@ductmofficial/sen-ui";
import { cn } from "@even/ui";
import { useMemo, useState, type ReactNode } from "react";
import { Collection, Header, ListBoxSection } from "react-aria-components";

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

const textOf = (o: TreeOption) => (o.hint ? `${o.hint} › ${o.label}` : o.label);

interface TreeSection {
  id: string;
  name: string;
  items: (TreeOption & { id: string })[];
}

/**
 * Sen UI's ComboBox for long tree-shaped lists such as categories: type to filter by name or
 * parent, ignoring accents.
 *
 * The list is filtered here and passed as `items`. React Aria's built-in filter clones the
 * collection, and cloning a section header fails in React's development build ("childNodes is
 * not supported"), which froze the field while typing.
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
  const selectedText = useMemo(() => {
    const selected = options.find((o) => o.value === value);
    return selected ? textOf(selected) : "";
  }, [options, value]);
  // What the user typed; null shows the selected option.
  const [typed, setTyped] = useState<string | null>(null);
  const inputValue = typed ?? selectedText;
  const query = typed === null || typed === selectedText ? "" : fold(typed.trim());
  const sections = useMemo<TreeSection[]>(
    () =>
      groupOptions(options)
        .map(([group, items]) => ({
          id: `group:${group}`,
          name: group,
          items: (query ? items.filter((o) => fold(textOf(o)).includes(query)) : items).map(
            (o) => ({ ...o, id: o.value }),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [options, query],
  );

  return (
    <ComboBox
      {...props}
      label={label}
      emptyText="Không tìm thấy"
      items={sections}
      inputValue={inputValue}
      onInputChange={(text) => {
        setTyped(text === selectedText ? null : text);
      }}
      value={value ?? null}
      onChange={(key) => {
        setTyped(null);
        if (typeof key === "string") onChange(key);
      }}
      menuTrigger="focus"
      className={cn(hideLabel && "[&>:first-child]:sr-only", className)}
    >
      {(section) => (
        <ListBoxSection id={section.id}>
          {section.name ? <Header className={sectionHeader}>{section.name}</Header> : null}
          <Collection items={section.items}>
            {(o) => (
              <ComboBoxItem id={o.value} textValue={textOf(o)}>
                <span
                  className={cn((o.depth ?? 0) === 0 && "font-medium")}
                  style={{ paddingInlineStart: `${String((o.depth ?? 0) * 0.75)}rem` }}
                >
                  {o.label}
                </span>
              </ComboBoxItem>
            )}
          </Collection>
        </ListBoxSection>
      )}
    </ComboBox>
  );
}
