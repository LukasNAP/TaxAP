import { formatRate } from './rate-format';

export type ComponentEvidence = { kind: 'city'|'county'|'special'|'transit'|'combined-local'; name: string; aplusLabel: string; aplusRate: number; officialRate: number; difference: number; hasDifference: boolean; candidateCount: number };
export function ComponentRateEvidence({ rows }: { rows?: ComponentEvidence[] }) {
  if (!rows?.length) return <p>No equivalent component comparison is supported by the retained candidates and A+ labels. This does not mean the configured components are correct.</p>;
  return <section aria-label="Component rate evidence">
    <h4>{rows.some(row => row.hasDifference) ? 'Potential component-rate difference' : 'Supported component rates agree'}</h4>
    <div className="table-scroll"><table className="coverage-table al-candidate-table"><caption>Configured components versus official evidence</caption><thead><tr><th scope="col">Component</th><th scope="col">A+</th><th scope="col">Official</th></tr></thead><tbody>{rows.map((row,i) => <tr key={i}>
      <td data-label="Component"><strong>{row.name} · {row.kind === 'combined-local' ? 'combined local subtotal' : row.kind}</strong><small>A+ label: {row.aplusLabel}</small></td>
      <td data-label="A+">{formatRate(row.aplusRate)}</td><td data-label="Official">{formatRate(row.officialRate)}<small>{row.hasDifference ? 'Potential difference' : 'Rates agree'} · {row.candidateCount} supporting source rows</small></td>
    </tr>)}</tbody></table></div>
    <p>The retained official candidates agree on each displayed component or subtotal. The combined subtotal is the published total minus its published base; it is not a city or county rate. Jurisdiction and affected destinations still require review. This does not establish a replacement rate or customer tax; TaxAP does not update A+.</p>
  </section>;
}
