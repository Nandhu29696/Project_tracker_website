import { useEffect, useMemo, useRef, useState } from 'react';
import type { BurndownPoint } from '@tracker/shared';
import { cn } from '@/lib/utils';

const H = 220;
const PAD = { top: 16, right: 76, bottom: 28, left: 40 };

const fmtDay = (d: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${d}T00:00:00Z`),
  );

/** Round, readable y-axis maximum and 4 ticks. */
function niceTicks(max: number) {
  if (max <= 0) return { top: 4, ticks: [0, 1, 2, 3, 4] };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return { top: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => i * step) };
}

/**
 * Sprint burndown: remaining work (the data series) against the ideal line
 * (a dashed reference). Hover/focus shows a crosshair snapped to the nearest day.
 */
export function Burndown({ points, unit }: { points: BurndownPoint[]; unit: 'hours' | 'points' }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setWidth(Math.max(280, Math.round(e!.contentRect.width))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [showTable]); // the chart element is re-created when switching back from the table

  const value = (p: BurndownPoint) => (unit === 'hours' ? p.remainingWork : p.remainingPoints);
  const unitLabel = unit === 'hours' ? 'h' : 'pts';

  const geo = useMemo(() => {
    const max = Math.max(1, ...points.map((p) => Math.max(p.ideal, value(p) ?? 0)));
    const { top, ticks } = niceTicks(max);
    const innerW = width - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const x = (i: number) =>
      PAD.left + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
    const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
    const path = (vals: (number | null)[]) =>
      vals.reduce<string>(
        (d, v, i) =>
          v === null ? d : `${d}${d && vals[i - 1] !== null ? 'L' : 'M'}${x(i)},${y(v)}`,
        '',
      );
    const actual = points.map(value);
    const lastIdx = actual.reduce<number>((last, v, i) => (v !== null ? i : last), -1);
    const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 70))));
    return {
      top,
      ticks,
      x,
      y,
      innerW,
      innerH,
      actual,
      lastIdx,
      labelEvery,
      actualPath: path(actual),
      idealPath: path(points.map((p) => p.ideal)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- value() only depends on unit
  }, [points, width, unit]);

  if (!points.length) return null;
  const { x, y, ticks, actual, lastIdx } = geo;

  const onMove = (clientX: number) => {
    const rect = box.current!.getBoundingClientRect();
    const rel = clientX - rect.left - PAD.left;
    const i = Math.round((rel / geo.innerW) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  };
  const hp = hover !== null ? points[hover]! : null;
  const tipLeft = hover !== null ? Math.min(Math.max(x(hover) - 70, 4), width - 150) : 0;

  return (
    <div>
      {/* legend: identity never rests on colour alone */}
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden>
            <line
              x1="1"
              y1="4"
              x2="17"
              y2="4"
              className="stroke-blue-600 dark:stroke-blue-500"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Remaining ({unitLabel})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden>
            <line
              x1="1"
              y1="4"
              x2="17"
              y2="4"
              className="stroke-slate-400 dark:stroke-slate-500"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </svg>
          Ideal
        </span>
        <button
          type="button"
          onClick={() => setShowTable((s) => !s)}
          className="ml-auto cursor-pointer text-brand-600 hover:underline"
        >
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-1.5">Day</th>
                <th className="px-3 py-1.5 text-right">Remaining ({unitLabel})</th>
                <th className="px-3 py-1.5 text-right">Ideal</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {points.map((p) => (
                <tr key={p.date} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-1">{fmtDay(p.date)}</td>
                  <td className="px-3 py-1 text-right">{value(p) ?? '—'}</td>
                  <td className="px-3 py-1 text-right text-slate-500">{p.ideal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={box}
          className="relative touch-none select-none"
          onPointerMove={(e) => onMove(e.clientX)}
          onPointerLeave={() => setHover(null)}
          tabIndex={0}
          role="img"
          aria-label={`Burndown: ${actual[lastIdx] ?? 'no'} ${unitLabel} remaining, ideal ${points[lastIdx]?.ideal ?? 0}`}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1));
            if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? points.length) - 1));
            if (e.key === 'Escape') setHover(null);
          }}
          onBlur={() => setHover(null)}
        >
          <svg width={width} height={H} className="block overflow-visible">
            {/* recessive hairline grid + y labels */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + geo.innerW}
                  y1={y(t)}
                  y2={y(t)}
                  className={
                    t === 0
                      ? 'stroke-slate-300 dark:stroke-slate-600'
                      : 'stroke-slate-100 dark:stroke-slate-800'
                  }
                  strokeWidth="1"
                />
                <text
                  x={PAD.left - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-slate-500 text-[11px] tabular-nums dark:fill-slate-400"
                >
                  {t}
                </text>
              </g>
            ))}
            {points.map((p, i) =>
              i % geo.labelEvery === 0 || i === points.length - 1 ? (
                <text
                  key={p.date}
                  x={x(i)}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-slate-500 text-[11px] dark:fill-slate-400"
                >
                  {fmtDay(p.date)}
                </text>
              ) : null,
            )}

            <path
              d={geo.idealPath}
              fill="none"
              className="stroke-slate-400 dark:stroke-slate-500"
              strokeWidth="2"
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
            <path
              d={geo.actualPath}
              fill="none"
              className="stroke-blue-600 dark:stroke-blue-500"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* end marker with a surface ring + selective direct labels */}
            {lastIdx >= 0 && (
              <>
                <circle
                  cx={x(lastIdx)}
                  cy={y(actual[lastIdx]!)}
                  r="4"
                  className="fill-blue-600 stroke-white dark:fill-blue-500 dark:stroke-slate-900"
                  strokeWidth="2"
                />
                <text
                  x={x(lastIdx) + 8}
                  y={y(actual[lastIdx]!)}
                  dy="0.32em"
                  className="fill-slate-700 text-[11px] font-medium dark:fill-slate-200"
                >
                  {actual[lastIdx]} {unitLabel}
                </text>
              </>
            )}
            <text
              x={x(points.length - 1) + 8}
              y={y(points.at(-1)!.ideal)}
              dy="0.32em"
              className="fill-slate-500 text-[11px] dark:fill-slate-400"
            >
              Ideal
            </text>

            {hover !== null && (
              <>
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={PAD.top}
                  y2={PAD.top + geo.innerH}
                  className="stroke-slate-400 dark:stroke-slate-500"
                  strokeWidth="1"
                />
                {actual[hover] !== null && (
                  <circle
                    cx={x(hover)}
                    cy={y(actual[hover]!)}
                    r="4"
                    className="fill-blue-600 stroke-white dark:fill-blue-500 dark:stroke-slate-900"
                    strokeWidth="2"
                  />
                )}
              </>
            )}
          </svg>

          {hp && (
            <div
              className={cn(
                'pointer-events-none absolute top-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-900',
              )}
              style={{ left: tipLeft, width: 146 }}
            >
              <p className="font-medium text-slate-900 dark:text-slate-100">{fmtDay(hp.date)}</p>
              <p className="mt-1 flex justify-between gap-2 text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <span className="h-0.5 w-3 rounded bg-blue-600 dark:bg-blue-500" /> Remaining
                </span>
                <span className="tabular-nums">{value(hp) ?? '—'}</span>
              </p>
              <p className="flex justify-between gap-2 text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <span className="h-0.5 w-3 rounded bg-slate-400" /> Ideal
                </span>
                <span className="tabular-nums">{hp.ideal}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
