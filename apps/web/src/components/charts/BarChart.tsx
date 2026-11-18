import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface BarSeries {
  key: string;
  label: string;
}

interface Props {
  /** one row per category; values keyed by series key */
  data: { label: string; values: Record<string, number> }[];
  series: BarSeries[]; // 1 or 2 series (slots 1 and 2 of the validated palette)
  height?: number;
  unit?: string;
  /** accessible summary of what the chart shows */
  title: string;
}

const COLORS = ['var(--chart-1)', 'var(--chart-2)'];
const PAD = { top: 18, right: 8, bottom: 30, left: 34 };
const MAX_BAR = 24;
const GAP = 2; // surface gap between bars of one group

/** Axis top = 2 tidy steps (1, 2, 2.5 or 5 x a power of ten) covering the data. */
function niceMax(v: number) {
  if (v <= 4) return 4;
  const raw = v / 2;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return step * 2;
}

/** Thin, rounded-top bars from one baseline; hover/focus tooltip; table view. */
export function BarChart({ data, series, height = 200, unit = '', title }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setWidth(Math.max(240, Math.round(e!.contentRect.width))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [table]);

  const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0))));
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const band = innerW / Math.max(1, data.length);
  const barW = Math.min(MAX_BAR, (band * 0.6 - GAP * (series.length - 1)) / series.length);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const showValues = series.length === 1 && data.length <= 8; // selective direct labels

  const fmt = (v: number) => `${Math.round(v * 10) / 10}${unit}`;
  const hp = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
        {series.length > 1 &&
          series.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: COLORS[i] }}
                aria-hidden
              />
              {s.label}
            </span>
          ))}
        <button
          type="button"
          onClick={() => setTable((t) => !t)}
          className="ml-auto cursor-pointer text-brand-600 hover:underline"
        >
          {table ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {table ? (
        <table className="w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1 pr-2 font-medium" />
              {series.map((s) => (
                <th key={s.key} className="py-1 text-right font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.map((d) => (
              <tr key={d.label} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1 pr-2">{d.label}</td>
                {series.map((s) => (
                  <td key={s.key} className="py-1 text-right">
                    {fmt(d.values[s.key] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div
          ref={box}
          className="relative"
          role="img"
          aria-label={title}
          onPointerLeave={() => setHover(null)}
        >
          <svg width={width} height={height} className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + innerW}
                  y1={y(t)}
                  y2={y(t)}
                  strokeWidth="1"
                  className={
                    t === 0
                      ? 'stroke-slate-300 dark:stroke-slate-600'
                      : 'stroke-slate-100 dark:stroke-slate-800'
                  }
                />
                <text
                  x={PAD.left - 6}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-slate-500 text-[11px] tabular-nums dark:fill-slate-400"
                >
                  {Math.round(t * 10) / 10}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const groupW = barW * series.length + GAP * (series.length - 1);
              const gx = PAD.left + band * i + (band - groupW) / 2;
              return (
                <g key={d.label}>
                  {/* hit target: the whole band, bigger than the bars */}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${d.label}: ${series.map((s) => `${s.label} ${fmt(d.values[s.key] ?? 0)}`).join(', ')}`}
                    onPointerEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className={cn(
                      'outline-none',
                      hover === i && 'fill-slate-100/60 dark:fill-slate-800/40',
                    )}
                  />
                  {series.map((s, si) => {
                    const v = d.values[s.key] ?? 0;
                    const h = Math.max(0, (v / max) * innerH);
                    const x = gx + si * (barW + GAP);
                    const r = Math.min(4, barW / 2, h);
                    // rounded data end, square at the baseline
                    const path =
                      h <= 0
                        ? ''
                        : `M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + barW - r} Q${x + barW},${y(v)} ${x + barW},${y(v) + r} V${y(0)} Z`;
                    return (
                      <g key={s.key} pointerEvents="none">
                        {path && <path d={path} style={{ fill: COLORS[si] }} />}
                        {showValues && (
                          <text
                            x={x + barW / 2}
                            y={y(v) - 5}
                            textAnchor="middle"
                            className="fill-slate-700 text-[11px] font-medium tabular-nums dark:fill-slate-200"
                          >
                            {fmt(v)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  <text
                    x={PAD.left + band * i + band / 2}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-slate-500 text-[11px] dark:fill-slate-400"
                  >
                    {d.label.length > 12 ? `${d.label.slice(0, 11)}…` : d.label}
                  </text>
                </g>
              );
            })}
          </svg>
          {hp && hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-900"
              style={{
                left: Math.min(Math.max(PAD.left + band * hover + band / 2 - 70, 0), width - 140),
                width: 140,
              }}
            >
              <p className="font-medium text-slate-900 dark:text-slate-100">{hp.label}</p>
              {series.map((s, si) => (
                <p
                  key={s.key}
                  className="mt-0.5 flex justify-between gap-2 text-slate-600 dark:text-slate-300"
                >
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm" style={{ background: COLORS[si] }} />
                    {s.label}
                  </span>
                  <span className="tabular-nums">{fmt(hp.values[s.key] ?? 0)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
