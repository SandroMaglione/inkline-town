/** A thin ink line of `values`, scaled to its own range. */
export const sparkline = (values: ReadonlyArray<number>): string => {
  if (values.length < 2) return ""
  const w = 300
  const h = 36
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`)
    .join(" ")
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="#3d4943" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`
}
