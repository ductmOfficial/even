import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { buttonClass, linkButtonClass } from "./button";
import { BarChart, ShareBars } from "./charts";
import { CommandDialog, CommandInput, CommandItem, CommandList } from "./command";
import { AmountField, MoneyText } from "./money";
import { SegmentedControl } from "./segmented";
import { Switch } from "./switch";

describe("button classes", () => {
  it("merges a tone, a size and the caller's classes", () => {
    const classes = buttonClass({ tone: "ghost", size: "icon" }, "p-2");
    expect(classes).toContain("bg-transparent");
    expect(classes).toContain("size-9");
    // tailwind-merge keeps the caller's padding over the size's p-0.
    expect(classes).toContain("p-2");
    expect(classes).not.toContain("p-0");
    expect(linkButtonClass("primary")).toContain("bg-(--sen-color-accent)");
  });
});

describe("MoneyText", () => {
  it("formats and colors by sign", () => {
    render(<MoneyText amount={-120000} tone="auto" />);
    const el = screen.getByText(/120\.000/);
    expect(el).toHaveClass("text-negative");
    expect(el).toHaveAttribute("data-money");
  });
});

function AmountHarness({ onChange }: { onChange: (v: number | null) => void }) {
  const [value, setValue] = useState<number | null>(null);
  return (
    <AmountField
      label="Số tiền"
      description="VD: 120k"
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe("AmountField", () => {
  it("parses shorthand and tidies the value on blur", async () => {
    const onChange = vi.fn();
    render(<AmountHarness onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "Số tiền" });
    expect(input).toHaveAccessibleDescription("VD: 120k");
    await userEvent.type(input, "1,5tr");
    expect(onChange).toHaveBeenLastCalledWith(1_500_000);
    await userEvent.tab();
    expect(input).toHaveValue("1.500.000");
  });

  it("reports null for invalid input", async () => {
    const onChange = vi.fn();
    render(<AmountHarness onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Số tiền" }), "abc");
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("shows an error and keeps a hidden label accessible", () => {
    render(
      <AmountField
        label="Phần của An"
        hideLabel
        error="Nhập số tiền"
        value={null}
        onValueChange={vi.fn()}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Phần của An" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Nhập số tiền");
  });
});

describe("Switch", () => {
  it("toggles with a click and exposes the switch role", async () => {
    const onChange = vi.fn();
    render(<Switch onChange={onChange}>Ẩn số tiền</Switch>);
    await userEvent.click(screen.getByRole("switch", { name: "Ẩn số tiền" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("SegmentedControl", () => {
  it("keeps exactly one option pressed", async () => {
    function Harness() {
      const [value, setValue] = useState<"in" | "out">("out");
      return (
        <SegmentedControl
          aria-label="Loại"
          value={value}
          onChange={setValue}
          options={[
            { value: "out", label: "Chi" },
            { value: "in", label: "Thu" },
          ]}
        />
      );
    }
    render(<Harness />);
    const out = screen.getByRole("radio", { name: "Chi" });
    const income = screen.getByRole("radio", { name: "Thu" });
    expect(out).toBeChecked();
    await userEvent.click(income);
    expect(income).toBeChecked();
    expect(out).not.toBeChecked();
    await userEvent.click(income);
    expect(income).toBeChecked();
  });
});

describe("CommandDialog", () => {
  it("filters commands and runs the selected one", async () => {
    const onSelect = vi.fn();
    render(
      <CommandDialog open onOpenChange={vi.fn()} label="Lệnh">
        <CommandInput placeholder="Gõ lệnh" />
        <CommandList>
          <CommandItem onSelect={onSelect}>Thêm giao dịch</CommandItem>
          <CommandItem>Cài đặt</CommandItem>
        </CommandList>
      </CommandDialog>,
    );
    expect(screen.getByRole("dialog", { name: "Lệnh" })).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText("Gõ lệnh"), "them");
    expect(screen.queryByText("Cài đặt")).not.toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe("charts", () => {
  it("exposes chart data as an accessible table", () => {
    render(
      <BarChart
        title="Thu chi"
        series={[{ key: "in", label: "Thu", className: "fill-chart-1" }]}
        data={[{ label: "T1", values: { in: 1000 } }]}
      />,
    );
    expect(screen.getByRole("img", { name: "Thu chi" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Thu chi" })).toHaveTextContent("1.000");
  });

  it("makes share bars selectable", async () => {
    const onSelect = vi.fn();
    render(
      <ShareBars
        items={[
          { key: "food", label: "Ăn uống", value: 300 },
          { key: "home", label: "Nhà", value: 100 },
        ]}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText("75%")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Ăn uống/ }));
    expect(onSelect).toHaveBeenCalledWith("food");
  });
});
