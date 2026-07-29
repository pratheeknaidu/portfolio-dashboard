interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

/** Below this the line implies a trend nobody measured. */
const MIN_POINTS = 5;

/**
 * Inline trend line for the summary card.
 *
 * Under five points it refuses to draw. `/api/snapshot` only accumulates from
 * the day a user first loads the dashboard, so a new account genuinely has one
 * or two points — and a two-point line is a straight segment that looks like a
 * measured trend.
 */
export function Sparkline({ values, width = 320, height = 44 }: SparklineProps) {
  if (values.length < MIN_POINTS) {
    return (
      <p className="font-mono text-[11px] text-rd-faint">
        Not enough history yet — a few more days and a trend appears here.
      </p>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series has zero range; dividing by it puts NaN into every y.
  const range = max - min || 1;
  const stepX = width / (values.length - 1);

  const d = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const rising = values[values.length - 1] >= values[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        d={d}
        fill="none"
        stroke={rising ? "var(--rd-gain)" : "var(--rd-loss)"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
