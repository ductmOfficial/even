import { formatMoney } from "@even/domain";
import type { ReactNode } from "react";

import { cn } from "./cn";

export interface BarSeries {
  key: string;
  label: string;
  /** Tailwind fill class, e.g. "fill-chart-1". */
  className: string;
}

export interface BarChartProps {
  title: string;
  data: readonly { label: string; values: Record<string, number> }[];
  series: readonly BarSeries[];
  height?: number;
  className?: string;
  onSelect?: (index: number) => void;
  selectedIndex?: number;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

/**
 * Grouped bar chart in plain SVG (no chart library), with a visually hidden data table
 * so screen readers get the numbers.
 */
export function BarChart({
  title,
  data,
  series,
  height = 220,
  className,
  onSelect,
  selectedIndex,
}: BarChartProps) {
  const width = 640;
  const pad = { top: 12, right: 8, bottom: 24, left: 48 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0))));
  const groupW = innerW / Math.max(data.length, 1);
  const barW = Math.min(18, (groupW * 0.7) / series.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  return (
    <figure className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        className="h-auto w-full"
        role="img"
        aria-label={title}
      >
        {ticks.map((t) => {
          const y = pad.top + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeDasharray={t ? "3 3" : undefined}
              />
              <text
                x={pad.left - 6}
                y={y}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {formatMoney(t, "VND", { compact: true }).replace(/\s?₫/, "")}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x0 = pad.left + i * groupW + (groupW - barW * series.length) / 2;
          const selected = selectedIndex === i;
          return (
            <g
              key={d.label}
              className={cn(
                onSelect && "cursor-pointer",
                selectedIndex !== undefined && !selected && "opacity-60",
              )}
              onClick={
                onSelect
                  ? () => {
                      onSelect(i);
                    }
                  : undefined
              }
            >
              <rect
                x={pad.left + i * groupW}
                y={pad.top}
                width={groupW}
                height={innerH}
                className="fill-transparent"
              />
              {series.map((s, j) => {
                const v = Math.max(0, d.values[s.key] ?? 0);
                const h = (v / max) * innerH;
                return (
                  <rect
                    key={s.key}
                    x={x0 + j * barW}
                    y={pad.top + innerH - h}
                    width={barW - 2}
                    height={h}
                    rx={2}
                    className={s.className}
                  >
                    <title>{`${d.label} · ${s.label}: ${formatMoney(v)}`}</title>
                  </rect>
                );
              })}
              <text
                x={pad.left + i * groupW + groupW / 2}
                y={height - 6}
                textAnchor="middle"
                className={cn(
                  "text-[10px]",
                  selected ? "fill-foreground font-semibold" : "fill-muted-foreground",
                )}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <svg width="10" height="10" aria-hidden>
              <rect width="10" height="10" rx="2" className={s.className} />
            </svg>
            {s.label}
          </span>
        ))}
      </figcaption>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Kỳ</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              {series.map((s) => (
                <td key={s.key}>{formatMoney(d.values[s.key] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export interface ShareBarItem {
  key: string;
  label: ReactNode;
  value: number;
  hint?: ReactNode;
}

export interface ShareBarsProps {
  items: readonly ShareBarItem[];
  onSelect?: (key: string) => void;
  className?: string;
  barClassName?: string;
}

/** Horizontal share bars (e.g. spending by category), sorted by the caller. */
export function ShareBars({
  items,
  onSelect,
  className,
  barClassName = "bg-chart-1",
}: ShareBarsProps) {
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className={cn("grid gap-2.5", className)}>
      {items.map((item) => {
        const pct = total > 0 ? Math.round((Math.max(0, item.value) / total) * 100) : 0;
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">{item.label}</span>
              <span className="flex items-baseline gap-2">
                <span data-money className="tabular-nums">
                  {formatMoney(item.value)}
                </span>
                <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                  {pct}%
                </span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", barClassName)}
                style={{ width: `${String(Math.max(0, (item.value / max) * 100))}%` }}
              />
            </div>
            {item.hint ? (
              <div className="mt-0.5 text-xs text-muted-foreground">{item.hint}</div>
            ) : null}
          </>
        );
        return (
          <li key={item.key}>
            {onSelect ? (
              <button
                type="button"
                className="w-full rounded-md text-left hover:bg-accent/60 focus-visible:bg-accent/60"
                onClick={() => {
                  onSelect(item.key);
                }}
              >
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
