"use client";

import { useId, useState } from "react";
import { TrendingDown } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { BurndownDayPoint } from "@/lib/project-analytics-logic";

const MONTHS_TR = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];

function formatDayLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return `${date.getDate()} ${MONTHS_TR[date.getMonth()]}`;
}

const VIEW_WIDTH = 700;
const VIEW_HEIGHT = 320;
const PADDING_LEFT = 40;
const PADDING_RIGHT = 20;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 40;
const PLOT_WIDTH = VIEW_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const PLOT_HEIGHT = VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

export function BurndownChart({ points }: { points: BurndownDayPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradientId = useId();

  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <EmptyState icon={TrendingDown} title="Bu sprint için burndown verisi yok" />
      </div>
    );
  }

  const maxRemaining = Math.max(
    points[0]?.idealRemaining ?? 0,
    ...points.map((p) => p.actualRemaining),
    1,
  );

  const xForIndex = (index: number): number => {
    if (points.length === 1) return PADDING_LEFT + PLOT_WIDTH / 2;
    return PADDING_LEFT + (index / (points.length - 1)) * PLOT_WIDTH;
  };

  const yForValue = (value: number): number => {
    return PADDING_TOP + PLOT_HEIGHT - (value / maxRemaining) * PLOT_HEIGHT;
  };

  const idealPath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xForIndex(index)} ${yForValue(point.idealRemaining)}`)
    .join(" ");

  const actualPath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xForIndex(index)} ${yForValue(point.actualRemaining)}`)
    .join(" ");

  const actualAreaPath = `${actualPath} L ${xForIndex(points.length - 1)} ${yForValue(0)} L ${xForIndex(0)} ${yForValue(0)} Z`;

  const gridlineCount = 4;
  const gridlines = Array.from({ length: gridlineCount + 1 }, (_, i) => {
    const value = (maxRemaining / gridlineCount) * i;
    return { value: Math.round(value), y: yForValue(value) };
  });

  const totalScopeAdded = points.reduce((sum, point) => sum + point.scopeAdded, 0);
  const hovered = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Sprint Burndown</h2>
        {totalScopeAdded > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Kapsam genişledi: {totalScopeAdded} görev eklendi
          </span>
        ) : null}
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="h-auto w-full overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {gridlines.map((line) => (
            <g key={line.value}>
              <line
                x1={PADDING_LEFT}
                x2={VIEW_WIDTH - PADDING_RIGHT}
                y1={line.y}
                y2={line.y}
                className="stroke-zinc-100 dark:stroke-zinc-800"
                strokeWidth={1}
              />
              <text
                x={PADDING_LEFT - 8}
                y={line.y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-zinc-400 text-[9px] dark:fill-zinc-500"
              >
                {line.value}
              </text>
            </g>
          ))}

          {/* X-axis day labels */}
          {points.map((point, index) => (
            <text
              key={point.date}
              x={xForIndex(index)}
              y={VIEW_HEIGHT - PADDING_BOTTOM + 18}
              textAnchor="middle"
              className="fill-zinc-400 text-[9px] dark:fill-zinc-500"
            >
              {formatDayLabel(point.date)}
            </text>
          ))}

          {/* Ideal line (dashed) */}
          <path d={idealPath} fill="none" stroke="#a1a1aa" strokeWidth={1.5} strokeDasharray="4 4" />

          {/* Actual area + line */}
          <path d={actualAreaPath} fill={`url(#${gradientId})`} stroke="none" />
          <path d={actualPath} fill="none" stroke="#3b82f6" strokeWidth={2} />

          {/* Data points + hit areas */}
          {points.map((point, index) => {
            const x = xForIndex(index);
            const y = yForValue(point.actualRemaining);
            return (
              <g key={point.date}>
                <circle cx={x} cy={y} r={3} className="fill-blue-500" />
                <circle
                  cx={x}
                  cy={y}
                  r={10}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${formatDayLabel(point.date)}: Kalan ${point.actualRemaining}, Tamamlanan ${point.completedCount}`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onFocus={() => setHoveredIndex(index)}
                  onBlur={() => setHoveredIndex(null)}
                  className="cursor-pointer outline-none"
                />
              </g>
            );
          })}
        </svg>

        {hovered ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
            style={{
              left: `${(xForIndex(hoveredIndex as number) / VIEW_WIDTH) * 100}%`,
              top: `${(yForValue(hovered.actualRemaining) / VIEW_HEIGHT) * 100}%`,
            }}
          >
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">{formatDayLabel(hovered.date)}</p>
            <p className="text-zinc-500 dark:text-zinc-400">Kalan: {hovered.actualRemaining}</p>
            <p className="text-zinc-500 dark:text-zinc-400">Tamamlanan: {hovered.completedCount}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-zinc-400" />
          İdeal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-blue-500" />
          Gerçek Kalan
        </span>
      </div>
    </div>
  );
}
