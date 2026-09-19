/**
 * The depth ruler. Progressive disclosure only works if you can feel how deep
 * you are, so depth is drawn as a measurement, not described in a breadcrumb.
 * Depth 0 is the surface; depth 5 is an implementation detail.
 */
export function Ruler({ depth, label }: { depth: number; label: string }) {
  return (
    <div className="ruler">
      <span className="ruler__ticks" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((tick) => (
          <span key={tick} className="ruler__tick" data-on={tick <= depth} />
        ))}
      </span>
      <span>
        <span className="visually-hidden">Depth {depth} of 5. </span>
        {label}
      </span>
    </div>
  );
}
