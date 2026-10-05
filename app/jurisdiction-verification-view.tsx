import { findingVerification, identityLabels, locationLabels, type JurisdictionVerification } from "./jurisdiction-verification";

export function JurisdictionVerificationFacts({ finding }: { finding: JurisdictionVerification & { confidence?: string; evidenceStatus?: string } }) {
  const status = findingVerification(finding);
  return <>
    <dl className="review-facts">
      <div><dt>Jurisdiction identity</dt><dd>{identityLabels[status.identityStatus]}</dd></div>
      <div><dt>Ship-to location</dt><dd>{locationLabels[status.locationStatus]}</dd></div>
    </dl>
    <p>A confirmed jurisdiction identifies the assigned tax body’s official scope. It does not verify every ship-to address or establish customer tax liability.</p>
  </>;
}
