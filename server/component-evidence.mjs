import { hasRateDifference } from '../app/rate-comparison.ts';
import { componentPolicies, sourceComponents } from './component-policy.mjs';

// Labels identify a configured component, never a destination or a replacement total.
const normalize = value => String(value ?? '').trim().replace(/^\d+\s+/, '').toUpperCase()
  .replace(/\bCO\.?$/,'COUNTY').replace(/[^A-Z0-9]+/g,' ').trim();
const kinds = new Set(['city', 'county', 'special', 'transit', 'combined-local']);
const finiteRate = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function componentEvidence(row, candidates, { stateCode, source = {}, allowCombined = true } = {}) {
  if (!candidates.length || candidates.some(c => c.ambiguousArea)) return null;
  const layers = candidates.map(c => stateCode ? sourceComponents(stateCode,c)
    : [{kind:c.componentKind,name:c.name,rate:c.componentRate}]);
  const stateRate=finiteRate(source.stateRate)?source.stateRate
    : candidates.every(c=>finiteRate(c.stateComponentRate)&&c.stateComponentRate===candidates[0].stateComponentRate)?candidates[0].stateComponentRate:null;
  const evidence = [];
  if (Array.isArray(row.localDescriptions)) for (const layer of layers[0]) {
    if (!kinds.has(layer.kind) || !layer.name || !finiteRate(layer.rate)) continue;
    // Require exactly one equivalent layer in EVERY candidate. Missing is not zero.
    const same = layers.map(list => list.filter(c => c.kind === layer.kind && normalize(c.name) === normalize(layer.name)));
    if (same.some(list => list.length !== 1 || list[0].rate !== layer.rate)) continue;
    const indexes = row.localDescriptions.flatMap((label,i) => normalize(label) && normalize(label) === normalize(layer.name) ? [i] : []);
    if (indexes.length !== 1 || !finiteRate(row.localRates?.[indexes[0]])) continue;
    const index=indexes[0];
    evidence.push({kind:layer.kind,name:layer.name,aplusLabel:row.localDescriptions[index].trim(),aplusRate:row.localRates[index],officialRate:layer.rate,candidateCount:candidates.length});
  }
  // Compare the complete local subtotal only when A+'s base equals the source base
  // and the configured components reconcile to its stored total. Do not allocate it.
  if (allowCombined && componentPolicies[stateCode]?.combined && finiteRate(stateRate)
    && row.baseRate === stateRate && Array.isArray(row.localRates) && row.localRates.length === 4 && row.localRates.every(finiteRate)
    && finiteRate(row.currentRate) && candidates.every(c => finiteRate(c.totalGeneralRate) && c.totalGeneralRate >= stateRate && c.totalGeneralRate === candidates[0].totalGeneralRate)) {
    const subtotal=Number(row.localRates.reduce((sum,rate)=>sum+rate,0).toFixed(4));
    if (Math.abs(row.baseRate+subtotal-row.currentRate)<0.00001) evidence.push({kind:'combined-local',name:'Local subtotal above published base',aplusLabel:'Sum of all four configured local components',aplusRate:subtotal,
      officialRate:Number((candidates[0].totalGeneralRate-stateRate).toFixed(4)),candidateCount:candidates.length});
  }
  // A label that matches different layer kinds is not a verified allocation.
  const unique=evidence.filter(r=>r.kind==='combined-local'||evidence.filter(other=>other.aplusLabel===r.aplusLabel).length===1);
  return unique.length ? aggregateComponentEvidence(unique) : null;
}

// Nested persistence/API allowlist: no raw A+ rows or arbitrary candidate fields.
export function aggregateComponentEvidence(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(r => kinds.has(r?.kind) && typeof r.name === 'string' && typeof r.aplusLabel === 'string'
    && finiteRate(r.aplusRate) && finiteRate(r.officialRate) && Number.isInteger(r.candidateCount) && r.candidateCount > 0)
    .map(r => {
      const difference = Number((r.officialRate - r.aplusRate).toFixed(4));
      return { kind: r.kind, name: r.name, aplusLabel: r.aplusLabel, aplusRate: r.aplusRate,
        officialRate: r.officialRate, difference, hasDifference: hasRateDifference(difference), candidateCount: r.candidateCount };
    });
}
