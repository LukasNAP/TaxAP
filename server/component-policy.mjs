// Reviewed adapter semantics, not inference from a row's jurisdictionType alone.
// combined means comparison of the entire local subtotal, never a city/county levy.
const named = ['AL','FL','PA','AZ','AR','OH','NE','WV','WI','SD','GA','IA','VT','OK','MN'];
const combined = ['AZ','AR','CA','CO','FL','IL','IA','KS','LA','MN','MO','NC','NE','NV','NM','NY','OH','OK','PA','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI'];
const statewide = ['CT','DC','IN','KY','MA','MD','ME','MI','NJ','RI'];
const noTaxPolicy = ['AK','HI','ND','WY'];
const noGeneralSalesTax = ['DE','MT','NH','OR'];
export const componentPolicies = Object.fromEntries([...new Set([...named,...combined,...statewide,...noTaxPolicy,...noGeneralSalesTax,'ID','MS','NC'])].sort().map(code => [code, {
  named: named.includes(code), combined: combined.includes(code),
  status: noTaxPolicy.includes(code) ? 'deliberate-no-tax' : noGeneralSalesTax.includes(code) ? 'no-general-sales-tax'
    : statewide.includes(code) ? 'statewide-total' : ['ID','MS'].includes(code) ? 'restricted-statewide-total' : 'local-components',
}]));
export function componentCoverageText(code) {
  const policy=componentPolicies[code];
  if (policy?.status === 'local-components') return `Component review: ${policy.named?'named published components require equivalent labels and agreeing candidates':'no separately named components'}${policy.combined?'; subtotal above the published base requires base and total reconciliation':''}.`;
  if (policy?.status === 'statewide-total') return 'Component review: statewide total comparison; no separate local layer in the supported scope.';
  if (policy?.status === 'restricted-statewide-total') return 'Component review: restricted statewide-total comparison; unsupported local scopes remain unresolved.';
  return 'Component review: not applicable under the no-general-sales-tax classification or approved deliberate no-tax policy.';
}

const pureRows = new Set(['AL','FL','PA','OH','NE','WV','WI','SD','GA']);
export function sourceComponents(stateCode, candidate) {
  const policy = componentPolicies[stateCode];
  if (!policy?.named || candidate.ambiguousArea) return [];
  if (Array.isArray(candidate.components)) return candidate.components.filter(c => ['city','county','special','transit'].includes(c.type) && c.name && c.name.toLowerCase() !== 'n/a')
    .map(c => ({ kind:c.type, name:c.name, rate:c.rate }));
  if (pureRows.has(stateCode) && ['city','county'].includes(candidate.jurisdictionType)) return [{kind:candidate.jurisdictionType,name:candidate.name,rate:candidate.componentRate}];
  if (stateCode === 'AZ' && candidate.jurisdictionType === 'city') return [{kind:'city',name:candidate.name,rate:candidate.componentRate}];
  if (candidate.componentKind) return [{kind:candidate.componentKind,name:candidate.name,rate:candidate.componentRate}];
  return [];
}
