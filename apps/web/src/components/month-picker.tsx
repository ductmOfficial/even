import { addMonths, currentMonth, formatMonth } from "@even/domain";
import { Button } from "@ductmofficial/sen-ui";
import { buttonClass } from "@even/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (month: string) => void;
}) {
  const isCurrent = value === currentMonth();
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Chọn tháng">
      <Button
        variant="secondary"
        className={buttonClass({ size: "icon-sm" })}
        aria-label="Tháng trước"
        onClick={() => {
          onChange(addMonths(value, -1));
        }}
      >
        <ChevronLeftIcon />
      </Button>
      <span className="min-w-28 text-center text-sm font-medium tabular-nums" aria-live="polite">
        {formatMonth(value)}
      </span>
      <Button
        variant="secondary"
        className={buttonClass({ size: "icon-sm" })}
        aria-label="Tháng sau"
        onClick={() => {
          onChange(addMonths(value, 1));
        }}
      >
        <ChevronRightIcon />
      </Button>
      {!isCurrent ? (
        <Button
          variant="secondary"
          className={buttonClass({ tone: "ghost", size: "sm" })}
          onClick={() => {
            onChange(currentMonth());
          }}
        >
          Tháng này
        </Button>
      ) : null}
    </div>
  );
}
