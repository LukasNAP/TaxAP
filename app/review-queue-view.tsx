"use client";
import { assignmentTitle, gapGuidance, gapLabels, initialQueueFilters, type AssignmentGap, type QueueFilters } from './review-queue';
import { formatRate } from './rate-format';
import { MatchingEvidence } from './match-diagnostic-view';
import { STATE_NAME_BY_CODE } from './tax-body-policy';
export function QueueControls({ filters, onChange }: { filters: QueueFilters; onChange: (filters: QueueFilters) => void }) {
  return <section className="review-decision" aria-label="Review queue filters"><div className="review-form-grid">
    <label>State<select value={filters.state} onChange={e=>onChange({...filters,state:e.target.value})}><option value="all">All states</option>{[...STATE_NAME_BY_CODE].sort((a,b)=>a[1].localeCompare(b[1])).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
    <label>Minimum affected ship-tos<select value={filters.minimum} onChange={e=>onChange({...filters,minimum:Number(e.target.value)})}>{[0,1,10,50,100,500].map(n=><option key={n} value={n}>{n===0?'Any count':`${n} or more`}</option>)}</select></label>
    <label>Queue items<select value={filters.kind} onChange={e=>onChange({...filters,kind:e.target.value as QueueFilters['kind']})}><option value="all">Rates and assignment reviews</option><option value="rates">Rate findings</option><option value="assignments">Assignment reviews</option></select></label>
    <label>Evidence<select value={filters.evidence} onChange={e=>onChange({...filters,evidence:e.target.value as QueueFilters['evidence']})}><option value="all">Current and stale</option><option value="current">Current checks</option><option value="stale">Retained stale rate findings</option></select></label>
    <label>Assignment reason<select value={filters.reason} onChange={e=>onChange({...filters,reason:e.target.value})}><option value="all">All reasons</option>{Object.entries(gapLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  </div><button className="secondary-button" type="button" onClick={()=>onChange(initialQueueFilters)}>Clear filters</button><p>Assignment reasons filter assignment reviews only. Stale rate findings are unverified; failed states do not supply current assignment counts.</p></section>;
}
export function QueueSummary({ rateFindings, gaps }: { rateFindings: number; gaps: AssignmentGap[] }) {
  return <div className="queue-summary" aria-label="Items shown with current filters">
    <div><strong>{rateFindings.toLocaleString()}</strong><span>Rate findings</span></div>
    <div><strong>{gaps.length.toLocaleString()}</strong><span>Assignment-review groups</span></div>
    <div><strong>{gaps.reduce((sum,gap)=>sum+gap.shipTos,0).toLocaleString()}</strong><span>Ship-to assignments needing review</span></div>
    <p>Shown with current filters. Rate findings and assignment reviews are separate counts. A group can affect multiple ship-tos.</p>
  </div>;
}
export function AssignmentGapQueue({ gaps, onOpenGap }: { gaps: AssignmentGap[]; onOpenGap: (gap: AssignmentGap)=>void }) {
  return <section className="queue-panel attention-panel assignment-review-queue" aria-labelledby="assignment-gap-title">
    <div className="panel-heading"><div><span className="section-label">Jurisdiction and setup review</span><h2 id="assignment-gap-title">Assignments needing review</h2></div><span className="count-pill">{gaps.length.toLocaleString()} {gaps.length===1?'group':'groups'}</span></div>
    <p className="assignment-queue-intro">TaxAP could not complete the jurisdiction or tax-body comparison. Supported component-rate differences may still be shown inside these reviews; a combined replacement rate remains unconfirmed.</p>
    {gaps.length===0?<p className="assignment-queue-intro">No assignment groups match these filters in the available checks. Unavailable state counts are unknown.</p>:gaps.map((gap,i)=><button className="history-card assignment-review-card" type="button" key={`${gap.stateCode}-${gap.taxBody}-${gap.reason}-${i}`} onClick={()=>onOpenGap(gap)}>
      <span className="status-mark comparison-not-checked" aria-hidden="true">?</span>
      <span><strong>{assignmentTitle(gap)}</strong><small>{STATE_NAME_BY_CODE.get(gap.stateCode) ?? gap.stateCode} · {gap.taxBody ?? 'State aggregate'}{gap.taxBodyDescription && ' · A+ tax-body description'}</small><span className="assignment-review-reason">{gapLabels[gap.reason]}</span>{gap.matchDiagnostic?.componentEvidence?.some(row => row.hasDifference) && <small>Potential component-rate difference</small>}</span>
      <span className="assignment-review-count">{gap.shipTos.toLocaleString()}<small>affected ship-tos</small></span><span className="row-arrow" aria-hidden="true">›</span>
    </button>)}
  </section>;
}
export function AssignmentReviewDetail({ gap, status, currentRow }: { gap: AssignmentGap; status: 'idle'|'loading'|'ready'|'error'; currentRow?: {description: string|null; currentRate: number|null}; }) {
  const guidance=gapGuidance[gap.reason];
  return <section className="assignment-review-detail" aria-labelledby="assignment-review-detail-title">
    <span className="section-label">Selected assignment group</span><h3 id="assignment-review-detail-title">{gapLabels[gap.reason]}</h3>
    <dl className="review-facts"><div><dt>State</dt><dd>{STATE_NAME_BY_CODE.get(gap.stateCode) ?? gap.stateCode}</dd></div><div><dt>A+ tax body</dt><dd>{gap.taxBody ?? 'Not supplied for this aggregate'}</dd></div><div><dt>A+ description</dt><dd>{currentRow?.description || gap.taxBodyDescription || 'Not supplied'}</dd></div><div><dt>Affected ship-tos in the batch</dt><dd>{gap.shipTos.toLocaleString()}</dd></div>{currentRow && <div><dt>Configured A+ rate</dt><dd>{currentRow.currentRate === null ? 'Unavailable' : formatRate(currentRow.currentRate)}</dd></div>}</dl>
    {gap.matchDiagnostic ? <MatchingEvidence diagnostic={gap.matchDiagnostic} /> : <>
      <h4>Why it needs review</h4><p>{guidance.why}</p>
      <h4>What to check next</h4><p>{guidance.next} TaxAP does not update A+.</p>
      {(gap.reason==='ambiguous_jurisdiction'||gap.reason==='unresolved_jurisdiction') && <p>Candidate jurisdictions were not supplied for this group. Use the official jurisdiction records and source links below; TaxAP has not selected a candidate. Refresh the main queue to load any newly available matching evidence.</p>}
    </>}
    {status==='loading' && <p role="status">Loading the current tax-body definition and state evidence…</p>}
    {status==='error' && <p role="alert">Current state evidence is unavailable. This group’s reason and count come from the last returned batch.</p>}
    <p className="assignment-detail-note">The reason and affected count describe the batch that opened this review. Refresh the main queue after investigating to see whether the issue remains. State evidence below covers the whole state.</p>
  </section>;
}
