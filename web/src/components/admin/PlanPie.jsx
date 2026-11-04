const SIZE = 180;
const CENTER = SIZE / 2;
const RADIUS = 80;

// In fixed order so a plan keeps its color. Checked with the dataviz palette validator;
// amber is under 3:1 against white, so every slice is also named beside the chart.
const COLORS = ['#1f6fd0', '#c98500', '#0f9d7a', '#6b7280'];

const point = (fraction) => {
  const angle = 2 * Math.PI * fraction - Math.PI / 2;
  return `${(CENTER + RADIUS * Math.cos(angle)).toFixed(2)} ${(CENTER + RADIUS * Math.sin(angle)).toFixed(2)}`;
};

/** Clinics per plan: a pie with every slice named beside it, and a table for screen readers. */
function PlanPie({ plans, caption }) {
  const total = plans.reduce((sum, plan) => sum + plan.total, 0);
  let used = 0;
  const slices = plans.map((plan, index) => {
    const start = used;
    used += total ? plan.total / total : 0;
    return { ...plan, start, end: used, color: COLORS[index % COLORS.length] };
  });

  return (
    <figure className="admin-pie">
      {total === 0 ? (
        <p className="admin-muted">No clinics on a plan yet.</p>
      ) : (
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="admin-pie-chart" role="presentation" aria-hidden="true">
          {slices
            .filter((slice) => slice.total > 0)
            .map((slice) =>
              slice.end - slice.start >= 1 ? (
                <circle key={slice.key} cx={CENTER} cy={CENTER} r={RADIUS} fill={slice.color}>
                  <title>{`${slice.name}: ${slice.total}`}</title>
                </circle>
              ) : (
                <path
                  key={slice.key}
                  d={`M ${CENTER} ${CENTER} L ${point(slice.start)} A ${RADIUS} ${RADIUS} 0 ${slice.end - slice.start > 0.5 ? 1 : 0} 1 ${point(slice.end)} Z`}
                  fill={slice.color}
                  stroke="#ffffff"
                  strokeWidth="2"
                >
                  <title>{`${slice.name}: ${slice.total}`}</title>
                </path>
              )
            )}
        </svg>
      )}
      <ul className="admin-pie-legend">
        {slices.map((slice) => (
          <li key={slice.key}>
            <span className="admin-pie-swatch" style={{ backgroundColor: slice.color }} aria-hidden="true" />
            {slice.name}: {slice.total}
          </li>
        ))}
      </ul>
      <figcaption className="visually-hidden">{caption}</figcaption>
    </figure>
  );
}

export default PlanPie;
