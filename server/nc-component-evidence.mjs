import { componentEvidence } from './component-evidence.mjs';
import { aggregateMatchDiagnostic } from './match-diagnostic.mjs';
import { describesOtherJurisdiction, isRetiredTaxBody } from '../app/tax-body-policy.ts';

export function northCarolinaComponentDiagnostics(stateDetail, source) {
  const official=new Map(source.rates.map(row=>[row.taxBody,row]));
  return Object.fromEntries((stateDetail.taxBodies ?? []).flatMap(row=>{
    const rate=official.get(row.taxBody);
    if(!rate || row.definitionStatus==='missing' || isRetiredTaxBody(row) || describesOtherJurisdiction(row,'NC')) return [];
    const candidate={name:`${rate.county} County`,totalGeneralRate:rate.officialRate};
    const components=componentEvidence(row,[candidate],{stateCode:'NC',source});
    if(!components?.some(layer=>layer.hasDifference)) return [];
    const diagnostic=aggregateMatchDiagnostic({version:1,stateCode:'NC',reason:'component_difference',inputs:{taxBody:row.taxBody,description:row.description},source,candidates:[candidate],componentEvidence:components});
    return diagnostic?[[row.taxBody,diagnostic]]:[];
  }));
}
