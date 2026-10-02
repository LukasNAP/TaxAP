// Rates are percentage units. Compare at the existing four-decimal calculation
// precision, with one thousandth of a percentage point as the review threshold.
export function hasRateDifference(difference: number | null): boolean {
  return difference !== null && Number.isFinite(difference) && Math.abs(Number(difference.toFixed(4))) >= 0.001;
}
