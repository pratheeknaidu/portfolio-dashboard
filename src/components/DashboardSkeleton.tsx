/** Same proportions the treemap settles into, so arrival does not reflow. */
const SKELETON_TILES = [
  { w: "42%", h: "56%" },
  { w: "30%", h: "56%" },
  { w: "26%", h: "56%" },
  { w: "22%", h: "44%" },
  { w: "20%", h: "44%" },
  { w: "20%", h: "44%" },
  { w: "18%", h: "44%" },
  { w: "18%", h: "44%" },
];

const shimmer = "animate-pulse rounded bg-rd-inset";

/**
 * Loading state.
 *
 * Renders no numbers at all — not even zeros. The shipped dashboard mounted
 * with empty state and rendered `$0.00` plus "No holdings yet" until the first
 * fetch resolved, so a slow connection showed users a wiped-out portfolio.
 */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading portfolio">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div
          data-testid="skeleton-summary"
          className="rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6"
        >
          <div className={`${shimmer} h-3 w-28`} />
          <div className={`${shimmer} mt-3 h-10 w-64`} />
          <div className={`${shimmer} mt-4 h-7 w-48`} />
          <div className={`${shimmer} mt-6 h-11 w-full`} />
        </div>
        <div
          data-testid="skeleton-movers"
          className="rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6"
        >
          <div className={`${shimmer} h-3 w-36`} />
          <div className="mt-4 flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={`${shimmer} h-5 w-full`} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-rd-border bg-rd-card p-5 lg:p-6">
        <div className={`${shimmer} h-3 w-24`} />
        <div className="mt-4 flex h-[320px] flex-wrap gap-1.5 overflow-hidden">
          {SKELETON_TILES.map((t, i) => (
            <div
              key={i}
              data-testid="skeleton-tile"
              style={{ width: t.w, height: t.h }}
              className={shimmer}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
