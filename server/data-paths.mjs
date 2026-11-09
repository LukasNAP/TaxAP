import { dirname, resolve } from "node:path";

/** TaxAP's own aggregate evidence directory; production uses /data/state-evidence beside the review database. */
export const evidenceDirectory = () => process.env.TAXAP_EVIDENCE_DIR || resolve(dirname(process.env.TAXAP_REVIEW_DB || resolve(".data", "taxap-reviews.sqlite")), "state-evidence");
