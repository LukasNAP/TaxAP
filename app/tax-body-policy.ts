type TaxBodyIdentity = { taxBody?: string | null; description?: string | null };

const knownRetiredTaxBodies = new Set(["NCUSE", "NC060XXX"]);
const retiredCodePattern = /(?:DNU|DONOTUSE|INACTIVE|OBSOLETE|XXX$)/i;
const retiredDescriptionPattern = /\b(?:DO NOT USE|DONT USE|INACTIVE|OBSOLETE)\b/;

export function isRetiredTaxBody({ taxBody, description }: TaxBodyIdentity) {
  const normalizedCode = String(taxBody ?? "").trim().toUpperCase();
  const normalizedDescription = String(description ?? "")
    .toUpperCase()
    .replace(/['’]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

  return knownRetiredTaxBodies.has(normalizedCode) || retiredCodePattern.test(normalizedCode) || retiredDescriptionPattern.test(normalizedDescription);
}

export const STATE_BY_FIPS: Record<string, { code: string; name: string }> = {
  "01": { code: "AL", name: "Alabama" }, "02": { code: "AK", name: "Alaska" }, "04": { code: "AZ", name: "Arizona" },
  "05": { code: "AR", name: "Arkansas" }, "06": { code: "CA", name: "California" }, "08": { code: "CO", name: "Colorado" },
  "09": { code: "CT", name: "Connecticut" }, "10": { code: "DE", name: "Delaware" }, "11": { code: "DC", name: "District of Columbia" },
  "12": { code: "FL", name: "Florida" }, "13": { code: "GA", name: "Georgia" }, "15": { code: "HI", name: "Hawaii" },
  "16": { code: "ID", name: "Idaho" }, "17": { code: "IL", name: "Illinois" }, "18": { code: "IN", name: "Indiana" },
  "19": { code: "IA", name: "Iowa" }, "20": { code: "KS", name: "Kansas" }, "21": { code: "KY", name: "Kentucky" },
  "22": { code: "LA", name: "Louisiana" }, "23": { code: "ME", name: "Maine" }, "24": { code: "MD", name: "Maryland" },
  "25": { code: "MA", name: "Massachusetts" }, "26": { code: "MI", name: "Michigan" }, "27": { code: "MN", name: "Minnesota" },
  "28": { code: "MS", name: "Mississippi" }, "29": { code: "MO", name: "Missouri" }, "30": { code: "MT", name: "Montana" },
  "31": { code: "NE", name: "Nebraska" }, "32": { code: "NV", name: "Nevada" }, "33": { code: "NH", name: "New Hampshire" },
  "34": { code: "NJ", name: "New Jersey" }, "35": { code: "NM", name: "New Mexico" }, "36": { code: "NY", name: "New York" },
  "37": { code: "NC", name: "North Carolina" }, "38": { code: "ND", name: "North Dakota" }, "39": { code: "OH", name: "Ohio" },
  "40": { code: "OK", name: "Oklahoma" }, "41": { code: "OR", name: "Oregon" }, "42": { code: "PA", name: "Pennsylvania" },
  "44": { code: "RI", name: "Rhode Island" }, "45": { code: "SC", name: "South Carolina" }, "46": { code: "SD", name: "South Dakota" },
  "47": { code: "TN", name: "Tennessee" }, "48": { code: "TX", name: "Texas" }, "49": { code: "UT", name: "Utah" },
  "50": { code: "VT", name: "Vermont" }, "51": { code: "VA", name: "Virginia" }, "53": { code: "WA", name: "Washington" },
  "54": { code: "WV", name: "West Virginia" }, "55": { code: "WI", name: "Wisconsin" }, "56": { code: "WY", name: "Wyoming" },
};

export const STATE_NAME_BY_CODE = new Map(Object.values(STATE_BY_FIPS).map((state) => [state.code, state.name]));

// Only multi-word state names are treated as unambiguous jurisdiction signals. Single-word state
// names (Georgia, Washington, Virginia, ...) collide with ordinary county/city names inside other
// states — e.g. "Washington County, GA" is a real Georgia county, not a reference to Washington
// State — so flagging on those would create false positives.
const MULTI_WORD_STATE_NAMES = Object.values(STATE_BY_FIPS).filter((state) => state.name.includes(" "));

// Free-text tax-body descriptions in XATXBD occasionally name a jurisdiction entirely outside the
// United States. These are unambiguous regardless of word count.
// Confirmed live across multiple states' investigations (NV, MD, MS, FL) - a small, recurring set
// of generic non-US "no tax" placeholder codes, not specific to any one state's contamination.
const KNOWN_NON_US_JURISDICTIONS = [
  "DOMINICAN REPUBLIC",
  "PUERTO RICO",
  "CANADA",
  "MEXICO",
  "UNITED KINGDOM",
  "HONDURAS",
  "EL SALVADOR",
];

/**
 * True when a tax body's A+ description names a state (or non-US jurisdiction) other than the
 * ship-to state it is assigned under. This flags real A+ data-quality issues — a mis-assigned or
 * mislabeled tax-body code — rather than treating them as ordinary counties of the selected state.
 */
export function describesOtherJurisdiction({ taxBody, description }: TaxBodyIdentity, stateCode: string) {
  const normalized = String(description ?? "").toUpperCase().replace(/['’]/g, "").trim();
  const normalizedStateCode = String(stateCode ?? "").trim().toUpperCase();
  const normalizedTaxBody = String(taxBody ?? "").trim().toUpperCase();
  const codedState = normalizedTaxBody.match(/^([A-Z]{2})\d/)?.[1];
  if (codedState && STATE_NAME_BY_CODE.has(codedState) && codedState !== normalizedStateCode) return true;
  if (!normalized) return false;
  const matchedState = MULTI_WORD_STATE_NAMES.find((state) => normalized.includes(state.name.toUpperCase()));
  if (matchedState && matchedState.code !== normalizedStateCode) return true;
  // New Mexico contains a country name; remove that complete state phrase before
  // checking for foreign jurisdictions, while retaining any separate Mexico reference.
  const countryText = normalized.replace(/\bNEW\s+MEXICO\b/g, "");
  return KNOWN_NON_US_JURISDICTIONS.some((name) => countryText.includes(name));
}
