import { Button, TextField } from "@ductmofficial/sen-ui";
import {
  AmountField,
  buttonClass,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  SegmentedControl,
  Switch,
  linkButtonClass,
} from "@even/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlusIcon, SettingsIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";

const meta = { title: "Controls" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function AmountDemo() {
  const [value, setValue] = useState<number | null>(120_000);
  return (
    <div className="grid max-w-sm gap-4">
      <AmountField
        label="Số tiền"
        description="Gõ 120k, 1,5tr hoặc 1.234.567"
        value={value}
        onValueChange={setValue}
      />
      <AmountField
        label="Số tiền (USD)"
        currency="USD"
        value={4200}
        onValueChange={() => undefined}
      />
      <AmountField
        label="Số tiền"
        error="Nhập số tiền"
        value={null}
        onValueChange={() => undefined}
      />
      <TextField label="Mô tả" placeholder="VD: Market - Kingfood" />
    </div>
  );
}
export const Amount: Story = { render: () => <AmountDemo /> };

function ModeDemo() {
  const [mode, setMode] = useState<"expense" | "income" | "transfer">("expense");
  const [privacy, setPrivacy] = useState(false);
  return (
    <div className="grid gap-4">
      <SegmentedControl
        aria-label="Loại giao dịch"
        value={mode}
        onChange={setMode}
        options={[
          { value: "expense", label: "Chi" },
          { value: "income", label: "Thu" },
          { value: "transfer", label: "Chuyển tiền" },
        ]}
      />
      <Switch isSelected={privacy} onChange={setPrivacy}>
        Ẩn số tiền
      </Switch>
    </div>
  );
}
export const ModeAndSwitch: Story = { render: () => <ModeDemo /> };

export const ButtonLooks: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button className={buttonClass()}>
        <PlusIcon /> Thêm
      </Button>
      <Button variant="secondary" className={buttonClass()}>
        Huỷ
      </Button>
      <Button variant="secondary" className={buttonClass({ tone: "ghost", size: "sm" })}>
        Bỏ lọc
      </Button>
      <Button variant="secondary" className={buttonClass({ tone: "danger" })}>
        <Trash2Icon /> Xoá
      </Button>
      <Button className={buttonClass({ tone: "danger-solid" })}>Xoá hết</Button>
      <Button
        variant="secondary"
        aria-label="Đóng"
        className={buttonClass({ tone: "ghost", size: "icon" })}
      >
        <XIcon />
      </Button>
      <a href="#import" className={linkButtonClass()}>
        Import Excel
      </a>
    </div>
  ),
};

function PaletteDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Mở bảng lệnh
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} label="Tìm và chạy lệnh">
        <CommandInput placeholder="Gõ lệnh hoặc tên trang…" />
        <CommandList>
          <CommandEmpty>Không có kết quả</CommandEmpty>
          <CommandGroup heading="Thao tác">
            <CommandItem>
              <PlusIcon /> Thêm giao dịch <CommandShortcut>N</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <SettingsIcon /> Cài đặt
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
export const CommandPalette: Story = { render: () => <PaletteDemo /> };
