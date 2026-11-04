import { useId, useState } from 'react';
import './ClinicCharts.css';

// Dependency-free charts for the clinic admin pages: stacked or grouped bars
// (HTML) and a line with area (inline SVG). Each has a legend for 2+ series,
// a hover and focus tooltip, and a table for screen readers. Series colors
// were checked with the dataviz palette validator; identity is never color
// alone (fixed order, gaps, legend, tooltip).

/** A round axis top and step for a maximum value. */
export function niceScale(max, steps = 4) {
  if (max <= 0) return { top: steps, step: 1 };
  const rough = max / steps;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough);
  // Whole numbers on count axes: a step of 0.5 would label "half" visits.
  const whole = Math.max(step, 1);
  return { top: Math.ceil(max / whole) * whole, step: whole };
}

const ticksOf = ({ top, step }) => {
  const ticks = [];
  for (let value = top; value >= 0; value -= step) ticks.push(value);
  return ticks;
};

function Legend({ series }) {
  if (series.length < 2) return null;
  return (
    <ul className="clinic-chart-legend">
      {series.map((s) => (
        <li key={s.key}>
          <span className={`clinic-chart-swatch is-${s.color}`} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function ChartTable({ caption, labelHeader, rows, series, formatValue }) {
  return (
    <table className="visually-hidden">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{labelHeader}</th>
          {series.map((s) => (
            <th key={s.key} scope="col">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.fullLabel ?? row.label}</th>
            {series.map((s) => (
              <td key={s.key}>{formatValue(row[s.key] ?? 0)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * rows: [{ key, label, fullLabel?, [series.key]: number }]
 * series: [{ key, label, color }] (color: blue | amber | red)
 * layout: 'stacked' | 'grouped'
 */
export function BarChart({ caption, rows, series, layout = 'stacked', height = 240, labelHeader = 'Period', formatValue = String }) {
  const [active, setActive] = useState(null);
  const highest = Math.max(
    0,
    ...rows.map((row) => (layout === 'stacked' ? series.reduce((sum, s) => sum + (row[s.key] ?? 0), 0) : Math.max(...series.map((s) => row[s.key] ?? 0))))
  );
  const scale = niceScale(highest);
  const percent = (value) => (value / scale.top) * 100;

  return (
    <figure className="clinic-chart">
      <Legend series={series} />
      <div className="clinic-bars-plot" style={{ height }}>
        <div className="clinic-chart-grid" aria-hidden="true">
          {ticksOf(scale).map((tick) => (
            <div key={tick} className="clinic-chart-gridline" style={{ bottom: `${percent(tick)}%` }}>
              <span>{formatValue(tick)}</span>
            </div>
          ))}
        </div>
        <div className="clinic-bars-columns">
          {rows.map((row) => {
            const summary = `${row.fullLabel ?? row.label}: ${series.map((s) => `${s.label} ${formatValue(row[s.key] ?? 0)}`).join(', ')}`;
            return (
              <div
                key={row.key}
                className="clinic-bars-column"
                tabIndex={0}
                role="img"
                aria-label={summary}
                onMouseEnter={() => setActive(row.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(row.key)}
                onBlur={() => setActive(null)}
              >
                <div className={`clinic-bars-stack is-${layout}`}>
                  {series.map((s) => {
                    const value = row[s.key] ?? 0;
                    return value > 0 ? <span key={s.key} className={`clinic-bars-segment is-${s.color}`} style={{ height: `${percent(value)}%` }} /> : null;
                  })}
                </div>
                {active === row.key && (
                  <div className="clinic-chart-tooltip" aria-hidden="true">
                    <strong>{row.fullLabel ?? row.label}</strong>
                    {series.map((s) => (
                      <span key={s.key}>
                        <i className={`clinic-chart-swatch is-${s.color}`} />
                        {s.label}: {formatValue(row[s.key] ?? 0)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="clinic-bars-labels" aria-hidden="true">
        {rows.map((row) => (
          <span key={row.key}>{row.label}</span>
        ))}
      </div>
      <ChartTable caption={caption} labelHeader={labelHeader} rows={rows} series={series} formatValue={formatValue} />
    </figure>
  );
}

/** Smooth path through points (monotone in x; no overshoot below the axis). */
function smoothPath(points) {
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const middle = (previous.x + point.x) / 2;
    return `${path} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }, '');
}

/** rows: [{ key, label, fullLabel?, value }]. One series, so the title names it. */
export function LineChart({ caption, rows, height = 240, valueLabel = 'Value', labelHeader = 'Month', formatValue = String, formatAxis = formatValue }) {
  const gradientId = useId();
  const [active, setActive] = useState(null);
  const scale = niceScale(Math.max(0, ...rows.map((r) => r.value)));
  const x = (index) => (rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100);
  const y = (value) => 100 - (value / scale.top) * 100;
  const points = rows.map((row, index) => ({ x: x(index), y: y(row.value) }));
  const line = smoothPath(points);
  const activeRow = active === null ? null : rows[active];

  return (
    <figure className="clinic-chart">
      <div className="clinic-line-plot" style={{ height }}>
        <div className="clinic-chart-grid" aria-hidden="true">
          {ticksOf(scale).map((tick) => (
            <div key={tick} className="clinic-chart-gridline" style={{ bottom: `${(tick / scale.top) * 100}%` }}>
              <span>{formatAxis(tick)}</span>
            </div>
          ))}
        </div>
        <div className="clinic-line-area">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#003f87" stopOpacity="0.14" />
                <stop offset="1" stopColor="#003f87" stopOpacity="0" />
              </linearGradient>
            </defs>
            {rows.length > 1 && <path d={`${line} L 100 100 L 0 100 Z`} fill={`url(#${gradientId})`} />}
            <path d={line} fill="none" stroke="#003f87" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          {rows.length === 1 && <span className="clinic-line-dot" style={{ left: '50%', top: `${points[0].y}%` }} aria-hidden="true" />}
          {activeRow && (
            <>
              <span className="clinic-line-cross" style={{ left: `${points[active].x}%` }} aria-hidden="true" />
              <span className="clinic-line-dot" style={{ left: `${points[active].x}%`, top: `${points[active].y}%` }} aria-hidden="true" />
              <div className={`clinic-chart-tooltip is-line${points[active].x > 70 ? ' is-left' : ''}`} style={{ left: `${points[active].x}%`, top: `${Math.min(points[active].y, 60)}%` }} aria-hidden="true">
                <strong>{activeRow.fullLabel ?? activeRow.label}</strong>
                <span>
                  {valueLabel}: {formatValue(activeRow.value)}
                </span>
              </div>
            </>
          )}
          <div className="clinic-line-hits">
            {rows.map((row, index) => (
              <div
                key={row.key}
                tabIndex={0}
                role="img"
                aria-label={`${row.fullLabel ?? row.label}: ${valueLabel} ${formatValue(row.value)}`}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="clinic-line-labels" aria-hidden="true">
        {rows.map((row, index) => (
          <span key={row.key} style={{ left: `${x(index)}%` }}>
            {row.label}
          </span>
        ))}
      </div>
      <ChartTable caption={caption} labelHeader={labelHeader} rows={rows} series={[{ key: 'value', label: valueLabel }]} formatValue={formatValue} />
    </figure>
  );
}
