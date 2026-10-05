import { AlabamaMatchEvidence } from './al-match-diagnostic-view';
import { evidenceSourceLink, matchDiagnosticCopy, type MatchDiagnostic } from './match-diagnostic';
import { formatRate } from './rate-format';

export function MatchingEvidence({ diagnostic }: { diagnostic: MatchDiagnostic }) {
  if (!('version' in diagnostic)) return <AlabamaMatchEvidence diagnostic={diagnostic} />;
  const [why, next] = matchDiagnosticCopy[diagnostic.reason];
  const source = evidenceSourceLink(diagnostic.source.sourceUrl);
  const data = evidenceSourceLink(diagnostic.source.machineReadableSourceUrl);
  return <section className="al-match-evidence" aria-label="Matching evidence">
    <h4>Why this match needs review</h4><p>{why}</p>
    <dl className="review-facts">
      <div><dt>State of official lookup</dt><dd>{diagnostic.stateCode}</dd></div>
      <div><dt>A+ description used in the batch</dt><dd>{diagnostic.inputs.description || 'Not supplied'}</dd></div>
      {diagnostic.inputs.lookup && <div><dt>Lookup value</dt><dd>{diagnostic.inputs.lookup}</dd></div>}
      {diagnostic.inputs.countyHint && <div><dt>County hint</dt><dd>{diagnostic.inputs.countyHint}</dd></div>}
      {diagnostic.inputs.jurisdictionType && <div><dt>Requested jurisdiction type</dt><dd>{diagnostic.inputs.jurisdictionType}</dd></div>}
    </dl>
    {!!diagnostic.reasonCounts?.length && <><h4>Boundary lookup reasons in this batch</h4><ul>{diagnostic.reasonCounts.map(row => <li key={row.reason}>{row.reason} · {row.count.toLocaleString()} assignments</li>)}</ul></>}
    <h4>Official rows considered</h4>
    {diagnostic.candidates.length ? <>
      <p>{diagnostic.candidates.length.toLocaleString()} source rows retained from this state’s matching lookup. These rows do not verify a ship-to’s physical location.</p>
      <div className="table-scroll"><table className="coverage-table al-candidate-table"><caption>Candidate evidence for human review</caption><thead><tr><th scope="col">Jurisdiction</th><th scope="col">County / scope</th><th scope="col">Rate evidence</th></tr></thead><tbody>{diagnostic.candidates.map((row, i) => <tr key={`${row.jurisdictionCode ?? row.name}-${i}`}>
        <td data-label="Jurisdiction"><strong>{row.name ?? 'Name not supplied'}</strong><small>{row.jurisdictionType ?? 'Type not supplied'} · {row.jurisdictionCode ?? row.locationCode ?? 'Code not supplied'}</small>{row.beginDate && <small>From {row.beginDate}</small>}{row.endDate && <small>Through {row.endDate}</small>}</td>
        <td data-label="County / scope">{row.county ?? row.parish ?? 'Not supplied'}{row.ambiguousArea && <small>Inconsistent official identity</small>}{row.multiCounty && <small>Multiple counties</small>}{row.specialDistrict && <small>Special district</small>}</td>
        <td data-label="Rate evidence">{Number.isFinite(row.totalGeneralRate) ? <>{formatRate(row.totalGeneralRate!)}<small>Source comparison total</small></> : Number.isFinite(row.componentRate) ? <>{formatRate(row.componentRate!)}<small>Component only</small></> : 'Current total unavailable'}</td>
      </tr>)}</tbody></table></div>
      <p>These are comparison-source rates, not calculated customer tax. A shared place name or equal rate does not confirm jurisdiction identity.</p>
    </> : <p>No individual official candidate rows were retained for this lookup or exclusion. TaxAP has not substituted a broader place-name search.</p>}
    <h4>What to check next</h4><p>{next} TaxAP does not update A+.</p>
    <p className="assignment-detail-note">Batch source period: {diagnostic.source.asOfDate ?? diagnostic.source.effectivePeriod ?? 'Not supplied'}{diagnostic.source.retrievedAt && ` · Retrieved ${new Date(diagnostic.source.retrievedAt).toLocaleString()}`}{diagnostic.source.sourceHash && ` · Fingerprint ${diagnostic.source.sourceHash.slice(0,12)}…`}</p>
    <div className="official-source-links">{source && <a href={source} target="_blank" rel="noreferrer">Open official source ↗</a>}{data && data !== source && <a href={data} target="_blank" rel="noreferrer">Open source data ↗</a>}</div>
  </section>;
}
