import {
  Badge,
  BarChart,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Kbd,
  MoneyText,
  ShareBars,
  Skeleton,
} from "@even/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { InboxIcon } from "lucide-react";

const meta = { title: "Display" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Money: Story = {
  render: () => (
    <div className="grid gap-1 text-lg">
      <MoneyText amount={1_234_567} />
      <MoneyText amount={-320_000} tone="auto" signed />
      <MoneyText amount={2_500_000} tone="auto" signed />
      <MoneyText amount={42_000} currency="USD" />
      <MoneyText amount={1_250_000_000} compact />
    </div>
  ),
};

export const Badges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Biến đổi</Badge>
      <Badge tone="primary">Thiết yếu</Badge>
      <Badge tone="positive">Khớp</Badge>
      <Badge tone="warning">Cần duyệt</Badge>
      <Badge tone="negative">Chưa rõ</Badge>
      <Badge tone="outline">An</Badge>
    </div>
  ),
};

export const StatCard: Story = {
  render: () => (
    <div className="grid max-w-md gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Tài sản ròng</CardTitle>
        </CardHeader>
        <CardContent>
          <MoneyText amount={417_956_000} className="text-2xl font-semibold" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Đang tải</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-7 w-32" />
        </CardContent>
      </Card>
    </div>
  ),
};

export const Charts: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-8">
      <BarChart
        title="Thu và chi theo tháng"
        series={[
          { key: "income", label: "Thu", className: "fill-chart-1" },
          { key: "expense", label: "Chi", className: "fill-chart-2" },
        ]}
        data={["T6", "T7", "T8", "T9", "T10", "T11"].map((label, i) => ({
          label,
          values: {
            income: 60_000_000 + i * 1_500_000,
            expense: 18_000_000 + ((i * 7) % 5) * 2_000_000,
          },
        }))}
        selectedIndex={5}
      />
      <ShareBars
        barClassName="bg-chart-2"
        items={[
          { key: "housing", label: "Nhà ở", value: 7_029_000 },
          { key: "food", label: "Ăn uống", value: 1_866_000 },
          { key: "family", label: "Gia đình & con cái", value: 276_000 },
        ]}
      />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <EmptyState
      icon={<InboxIcon />}
      title="Chưa có giao dịch"
      description="Thử đổi tháng hoặc bỏ bộ lọc."
    />
  ),
};

export const Keys: Story = {
  render: () => (
    <p className="flex items-center gap-2 text-sm">
      Thêm giao dịch <Kbd>N</Kbd> · Tìm và chạy lệnh <Kbd>⌘K</Kbd>
    </p>
  ),
};
