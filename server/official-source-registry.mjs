import { NCDOR_CURRENT_RATES_URL } from "./ncdor-rates.mjs";
import { CALIFORNIA_DOR_OVERVIEW_URL } from "./ca-rates.mjs";
import { FLORIDA_DOR_RATES_URL } from "./fl-rates.mjs";
import { PENNSYLVANIA_DOR_RATES_URL } from "./pa-rates.mjs";
import { TEXAS_DOR_RATES_URL } from "./tx-rates.mjs";

export const SST_RATE_DIRECTORY_URL = "https://www.streamlinedsalestax.org/ratesandboundry/Rates/";

const STATES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska",
  NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
  UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const SST_RATE_STATES = new Set([
  "AR", "GA", "IA", "IN", "KS", "KY", "MI", "MN", "NC", "ND", "NE", "NJ", "NV", "OH", "OK", "RI", "SD", "TN", "UT", "VT", "WA", "WI", "WV", "WY",
]);

export function listOfficialSourceRegistry() {
  return Object.entries(STATES).map(([stateCode, stateName]) => {
    if (stateCode === "NC") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-dor-html",
        coverage: "county", sourceName: "North Carolina Department of Revenue", sourceUrl: NCDOR_CURRENT_RATES_URL,
      };
    }
    if (stateCode === "GA") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "state, county, city, and special-jurisdiction components", sourceName: "Georgia DOR via Streamlined Sales Tax rate file",
        sourceUrl: "https://dor.georgia.gov/sales-tax-rates-general",
      };
    }
    if (stateCode === "CA") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-dor-html",
        coverage: "current city and county total rates", sourceName: "California Department of Tax and Fee Administration",
        sourceUrl: CALIFORNIA_DOR_OVERVIEW_URL,
      };
    }
    if (stateCode === "TX") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-comptroller-text-html",
        coverage: "quarterly combined city and local-area rates", sourceName: "Texas Comptroller of Public Accounts",
        sourceUrl: TEXAS_DOR_RATES_URL,
      };
    }
    if (stateCode === "FL") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-dor-xlsx",
        coverage: "all 67 county discretionary surtax totals", sourceName: "Florida Department of Revenue",
        sourceUrl: FLORIDA_DOR_RATES_URL,
      };
    }
    if (stateCode === "SC") {
      return {
        stateCode, stateName, status: "official-document-source", adapter: "state-dor-pdf-pending",
        coverage: "official municipality and unincorporated-area totals in ST-575; validated parser pending",
        sourceName: "South Carolina Department of Revenue", sourceUrl: "https://dor.sc.gov/sites/dor/files/forms/ST575.pdf",
      };
    }
    if (stateCode === "PA") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-dor-rules-census",
        coverage: "all 67 counties using the official state rate and Philadelphia/Allegheny add-ons",
        sourceName: "Pennsylvania Department of Revenue", sourceUrl: PENNSYLVANIA_DOR_RATES_URL,
      };
    }
    if (stateCode === "IL") {
      return {
        stateCode, stateName, status: "machine-readable-source", adapter: "state-dor-machine-file-pending",
        coverage: "official machine-readable sales-tax files; adapter validation pending",
        sourceName: "Illinois Department of Revenue", sourceUrl: "https://tax.illinois.gov/research/taxrates/sales-tax-rate-machine-readable-files.html",
      };
    }
    if (stateCode === "VA") {
      return {
        stateCode, stateName, status: "machine-readable-source", adapter: "state-dor-xlsx-pending",
        coverage: "official locality lookup and downloadable workbook; adapter validation pending",
        sourceName: "Virginia Department of Taxation", sourceUrl: "https://www.tax.virginia.gov/sales-tax-rate-and-locality-code-lookup",
      };
    }
    if (stateCode === "MD") {
      return {
        stateCode, stateName, status: "official-document-source", adapter: "state-comptroller-guidance-pending",
        coverage: "official statewide guidance identified; validated locality model pending",
        sourceName: "Comptroller of Maryland", sourceUrl: "https://services.marylandcomptroller.gov/taxes/en/sales-and-use-tax-faqs?id=kb_article_view&sysparm_article=KB0010157",
      };
    }
    if (stateCode === "OH" || stateCode === "TN") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "state, county, city, and special-jurisdiction rate components",
        sourceName: `${stateName} via Streamlined Sales Tax`, sourceUrl: SST_RATE_DIRECTORY_URL,
      };
    }
    if (SST_RATE_STATES.has(stateCode)) {
      return {
        stateCode, stateName, status: "machine-readable-source", adapter: "sst-rate-file",
        coverage: "jurisdiction rate components; adapter pending", sourceName: "Streamlined Sales Tax rate and boundary files", sourceUrl: SST_RATE_DIRECTORY_URL,
      };
    }
    return {
      stateCode, stateName, status: "research-needed", adapter: "state-specific",
      coverage: "official DOR source mapping pending", sourceName: "State tax authority", sourceUrl: null,
    };
  });
}

export function officialSourceForState(stateCode) {
  return listOfficialSourceRegistry().find((source) => source.stateCode === String(stateCode || "").toUpperCase()) ?? null;
}
