import { alDiagnosticCopy, alSourceLink, type AlabamaMatchDiagnostic } from './al-match-diagnostic';
import { formatRate } from './rate-format';

export function AlabamaMatchEvidence({ diagnostic }: { diagnostic: AlabamaMatchDiagnostic }) {
  const copy = alDiagnosticCopy(diagnostic);
  const source = alSourceLink(diagnostic.source.sourceUrl);
  const csv = alSourceLink(diagnostic.source.machineReadableSourceUrl);
  return <section className="al-match-evidence" aria-labelledby="al-match-evidence-title">
    <h4 id="al-match-evidence-title">Alabama matching evidence</h4>
    <p>{copy.why}</p>
    <dl className="review-facts">
      <div><dt>Locality code from A+</dt><dd>{diagnostic.localityCode ?? 'Unsupported code format'}</dd></div>
      <div><dt>Place text from batch description</dt><dd>{diagnostic.expectedName || 'Not supplied'}</dd></div>
      <div><dt>County hint from batch description</dt><dd>{diagnostic.countyHint === null ? 'No parenthetical hint' : diagnostic.countyHint || 'Empty hint'}</dd></div>
      {diagnostic.reason === 'name_mismatch' && <div><dt>Existing name-check token</dt><dd>{diagnostic.nameCheckToken || 'Empty'}</dd></div>}
    </dl>
    <h4>{diagnostic.reason === 'name_mismatch' ? 'Official row rejected by the name check' : 'Official rows considered'}</h4>
    {diagnostic.candidates.length ? <>
      <p>{diagnostic.candidates.length} official {diagnostic.candidates.length === 1 ? 'row' : 'rows'} from the {diagnostic.candidateBasis === 'county-hint' ? 'county-hint' : 'locality-code'} lookup. These are evidence for review, not confirmed destination jurisdictions.</p>
      <div className="table-scroll"><table className="coverage-table al-candidate-table"><caption>Official general-sales components — no combined rate selected</caption><thead><tr><th scope="col">Official locality</th><th scope="col">County-tax reference</th><th scope="col">Local component</th></tr></thead><tbody>{diagnostic.candidates.map((row, i) => <tr key={`${row.jurisdictionCode}-${row.countyCode}-${i}`}>
        <td data-label="Official locality"><strong>{row.name}</strong><small>{row.jurisdictionType ?? 'Locality'} · Code {row.localityCode ?? 'Not supplied'}</small>{row.beginDate && <small>Effective {row.beginDate}</small>}</td>
        <td data-label="County-tax reference">{row.countyCode ? <><strong>{row.countyCode}</strong>{row.countyReferences.length ? row.countyReferences.map((county,j) => <small key={j}>{county.name}{Number.isFinite(county.componentRate) ? ` · ${formatRate(county.componentRate!)}` : ''} county component</small>) : <small>Reference not resolved in the supported general-sales county rows</small>}</> : 'No county-tax reference supplied'}</td>
        <td data-label="Local component">{Number.isFinite(row.componentRate) ? formatRate(row.componentRate!) : 'Unavailable'}</td>
      </tr>)}</tbody></table></div>
      <p>Components are not customer tax or a confirmed combined rate. County-tax references can describe different tax scopes within the same county; a reference does not verify a ship-to’s physical location.</p>
    </> : <p>No official candidate rows were returned by this lookup. TaxAP has not substituted a place-name search or selected a rate.</p>}
    <h4>What to check next</h4><p>{copy.next} Use the affected ship-to list to investigate; TaxAP does not update A+.</p>
    <p className="assignment-detail-note">Evidence from the batch source: {diagnostic.source.asOfDate ?? 'update period not supplied'}{diagnostic.source.retrievedAt ? ` · Retrieved ${new Date(diagnostic.source.retrievedAt).toLocaleString()}` : ' · Retrieval time not supplied'}{diagnostic.source.sourceHash ? ` · Fingerprint ${diagnostic.source.sourceHash.slice(0,12)}…` : ''}</p>
    <div className="official-source-links">{source && <a href={source} target="_blank" rel="noreferrer">Open Alabama DOR source ↗</a>}{csv && <a href={csv} target="_blank" rel="noreferrer">Open source CSV ↗</a>}</div>
  </section>;
}
