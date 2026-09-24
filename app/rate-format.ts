// Presentation only: rates are already percentage units, not fractions.
export function formatRateValue(value: number): string {
  return value.toFixed(3);
}
export function formatRate(value: number): string {
  return `${formatRateValue(value)}%`;
}
// Format prose/history percentages, preserving identifiers such as NC7%CR.
export function formatRateText(text: string): string {
  return text.replace(/(?<![\w.])([+-]?\d+(?:\.\d+)?)%(?!\w)/g, (_match, number: string) => {
    const sign = number.startsWith("+") ? "+" : "";
    return sign + formatRate(Number(number));
  });
}
