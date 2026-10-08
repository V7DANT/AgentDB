import { useMemo, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/utils/cn';
import { formatCompactNumber, formatFixed, formatTime } from '@/utils/format';
import type { TimeSeriesPoint } from '@/types';

/**
 * Chart primitives.
 *
 * All charts share one visual language — same grid, axis and tooltip styling —
 * so the dashboard reads as a single system rather than a collection of widgets.
 */

const AXIS_STYLE = {
  stroke: '#3a434f',
  tick: { fill: '#6b7686', fontSize: 11 },
} as const;

const GRID_STROKE = '#1a2029';

const SERIES_COLORS = {
  accent: '#4f7cff',
  ok: '#3fb950',
  warn: '#d29922',
  danger: '#f85149',
  info: '#58a6ff',
  violet: '#a371f7',
} as const;

export type SeriesTone = keyof typeof SERIES_COLORS;

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  valueFormatter?: (value: number, key: string) => string;
  labelFormatter?: (label: string | number) => string;
}

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
  labelFormatter,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-base-600/80 bg-base-850/98 px-2.5 py-2 shadow-xl backdrop-blur">
      <p className="mb-1 text-2xs uppercase tracking-wide text-base-400">
        {labelFormatter ? labelFormatter(label ?? '') : String(label ?? '')}
      </p>
      <div className="space-y-0.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-base-300">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="mono-num text-base-50">
              {typeof entry.value === 'number'
                ? valueFormatter
                  ? valueFormatter(entry.value, String(entry.dataKey ?? ''))
                  : formatFixed(entry.value, 2)
                : String(entry.value ?? '')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function legendFormatter(value: string) {
  return <span className="text-xs text-base-300">{value}</span>;
}

interface ChartFrameProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  height?: number;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

/** Panel wrapper giving every chart the same header and fixed height. */
export function ChartFrame({
  title,
  description,
  actions,
  height = 220,
  children,
  className,
  footer,
}: ChartFrameProps) {
  return (
    <section className={cn('panel overflow-hidden', className)}>
      {title ? (
        <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-3.5">
          <div>
            <h3 className="text-sm font-semibold text-base-50">{title}</h3>
            {description ? <p className="mt-0.5 text-xs text-base-300">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className="px-2 pb-2" style={{ height }}>
        {children}
      </div>
      {footer ? (
        <div className="border-t border-base-800/70 px-4 py-2 text-2xs text-base-400">{footer}</div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Time series                                                         */
/* ------------------------------------------------------------------ */

export function TimeSeriesChart({
  points,
  tone = 'accent',
  unit = '',
  decimals = 2,
  height,
  color,
}: {
  points: TimeSeriesPoint[];
  tone?: SeriesTone;
  unit?: string;
  decimals?: number;
  height?: number;
  color?: string;
}) {
  const data = useMemo(
    () => points.map((point) => ({ ...point, ts: new Date(point.timestamp).getTime() })),
    [points],
  );

  return (
    <ResponsiveContainer width="100%" height={height ?? '100%'}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id={`fill-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color ?? SERIES_COLORS[tone]} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color ?? SERIES_COLORS[tone]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="ts"
          type="number"
          domain={['dataMin', 'dataMax']}
          scale="time"
          tickFormatter={(value: number) => formatTime(new Date(value).toISOString(), false)}
          minTickGap={36}
          {...AXIS_STYLE}
        />
        <YAxis
          width={54}
          tickFormatter={(value: number) => formatCompactNumber(value, 1)}
          {...AXIS_STYLE}
        />
        <RechartsTooltip
          content={
            <ChartTooltip
              valueFormatter={(value) => `${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`}
              labelFormatter={(label) => formatTime(new Date(Number(label)).toISOString())}
            />
          }
          cursor={{ stroke: '#3a434f', strokeDasharray: '3 3' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          name={unit || 'value'}
          stroke={color ?? SERIES_COLORS[tone]}
          strokeWidth={1.8}
          fill={`url(#fill-${tone})`}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-series line chart                                             */
/* ------------------------------------------------------------------ */

export interface SeriesDefinition {
  key: string;
  label: string;
  tone: SeriesTone;
  /** Which Y axis this series belongs to. */
  axis?: 'left' | 'right';
}

export function MultiLineChart<T extends Record<string, number | string>>({
  data,
  series,
  xKey,
  xLabel,
  leftUnit = '',
  rightUnit = '',
  decimals = 2,
  height,
}: {
  data: T[];
  series: SeriesDefinition[];
  xKey: string;
  xLabel?: string;
  leftUnit?: string;
  rightUnit?: string;
  decimals?: number;
  height?: number;
}) {
  const usesRightAxis = series.some((entry) => entry.axis === 'right');

  return (
    <ResponsiveContainer width="100%" height={height ?? '100%'}>
      <LineChart data={data} margin={{ top: 8, right: usesRightAxis ? 8 : 12, bottom: 0, left: -8 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey={xKey} name={xLabel} {...AXIS_STYLE} />
        <YAxis
          yAxisId="left"
          width={54}
          tickFormatter={(value: number) => formatCompactNumber(value, 1)}
          {...AXIS_STYLE}
        />
        {usesRightAxis ? (
          <YAxis
            yAxisId="right"
            orientation="right"
            width={46}
            tickFormatter={(value: number) => formatCompactNumber(value, 1)}
            {...AXIS_STYLE}
          />
        ) : null}
        <RechartsTooltip
          content={
            <ChartTooltip
              valueFormatter={(value, key) => {
                const definition = series.find((entry) => entry.key === key);
                const unit = definition?.axis === 'right' ? rightUnit : leftUnit;
                return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
              }}
              labelFormatter={(label) => `${xLabel ?? xKey}: ${label}`}
            />
          }
          cursor={{ stroke: '#3a434f', strokeDasharray: '3 3' }}
        />
        <Legend formatter={legendFormatter} iconType="plainline" iconSize={12} />
        {series.map((definition) => (
          <Line
            key={definition.key}
            yAxisId={definition.axis === 'right' ? 'right' : 'left'}
            type="monotone"
            dataKey={definition.key}
            name={definition.label}
            stroke={SERIES_COLORS[definition.tone]}
            strokeWidth={1.8}
            dot={{ r: 2.5, strokeWidth: 0, fill: SERIES_COLORS[definition.tone] }}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Bar chart                                                           */
/* ------------------------------------------------------------------ */

export function CategoryBarChart({
  data,
  xKey,
  valueKey,
  tone = 'accent',
  unit = '',
  decimals = 2,
  height,
  colorByValue,
}: {
  data: Record<string, number | string>[];
  xKey: string;
  valueKey: string;
  tone?: SeriesTone;
  unit?: string;
  decimals?: number;
  height?: number;
  /** Optional per-bar colouring, e.g. to flag errors. */
  colorByValue?: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height ?? '100%'}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey={xKey} {...AXIS_STYLE} />
        <YAxis
          width={54}
          tickFormatter={(value: number) => formatCompactNumber(value, 1)}
          {...AXIS_STYLE}
        />
        <RechartsTooltip
          content={
            <ChartTooltip
              valueFormatter={(value) => `${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`}
            />
          }
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Bar dataKey={valueKey} name={valueKey} radius={[2, 2, 0, 0]} isAnimationActive={false}>
          {data.map((row, index) => (
            <Cell
              key={index}
              fill={colorByValue ? colorByValue(Number(row[valueKey])) : SERIES_COLORS[tone]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline (used inside table cells)                                 */
/* ------------------------------------------------------------------ */

export function Sparkline({
  values,
  tone = 'accent',
  width = 96,
  height = 26,
}: {
  values: number[];
  tone?: SeriesTone;
  width?: number;
  height?: number;
}) {
  const path = useMemo(() => {
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * width;
        const y = height - ((value - min) / range) * (height - 4) - 2;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [values, width, height]);

  if (path === '') return <span className="text-2xs text-base-500">—</span>;

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      <path d={path} fill="none" stroke={SERIES_COLORS[tone]} strokeWidth={1.4} />
    </svg>
  );
}

export { SERIES_COLORS };
