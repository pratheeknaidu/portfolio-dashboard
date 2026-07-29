interface StatusPillProps {
  open: boolean;
  /** Last session close, e.g. "4:00 PM ET". */
  asOf: string;
}

/**
 * Market status in STATUS styling, deliberately not button styling.
 *
 * The shipped pill was a rounded-full bordered pill sitting between Add and
 * Sign in, identical in shape to both, so it read as a control — users click
 * it and nothing happens. No border, no pill radius, no hover state: a dot,
 * a word, and a timestamp.
 */
export function StatusPill({ open, asOf }: StatusPillProps) {
  return (
    <div
      role="status"
      className="inline-flex items-center gap-2 px-1 font-mono text-[11px] text-rd-muted"
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${open ? "bg-rd-gain" : "bg-rd-warning"}`}
      />
      {open ? <span>Open</span> : <span>Closed · as of {asOf}</span>}
    </div>
  );
}
