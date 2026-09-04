import { NCDOR_CURRENT_RATES_URL } from "./ncdor-rates.mjs";
import { CALIFORNIA_DOR_OVERVIEW_URL } from "./ca-rates.mjs";
import { CONNECTICUT_DRS_RATES_URL } from "./ct-rates.mjs";
import { DISTRICT_OF_COLUMBIA_OTR_RATES_URL } from "./dc-rates.mjs";
import { FLORIDA_DOR_RATES_URL } from "./fl-rates.mjs";
import { HAWAII_GET_URL } from "./hi-rates.mjs";
import { ILLINOIS_IDOR_OVERVIEW_URL } from "./il-rates.mjs";
import { IDAHO_TAX_COMMISSION_RATES_URL } from "./id-rates.mjs";
import { MARYLAND_RATE_CHART_URL } from "./md-rates.mjs";
import { MAINE_REVENUE_RATES_URL } from "./me-rates.mjs";
import { MASSACHUSETTS_DOR_RATES_URL } from "./ma-rates.mjs";
import { MISSISSIPPI_DOR_RATES_URL } from "./ms-rates.mjs";
import { NJ_USE_TAX_FAQ_URL } from "./nj-rates.mjs";
import { PENNSYLVANIA_DOR_RATES_URL } from "./pa-rates.mjs";
import { TEXAS_DOR_RATES_URL } from "./tx-rates.mjs";
import { VIRGINIA_DOR_RATES_URL } from "./va-rates.mjs";
import { ARIZONA_DOR_RATE_TABLE_URL } from "./az-rates.mjs";
import { NEW_YORK_CURRENT_RATES_URL } from "./ny-rates.mjs";
import { ALASKA_REMOTE_SELLER_RATES_URL } from "./ak-rates.mjs";
import { NEW_MEXICO_GIS_DATA_URL } from "./nm-rates.mjs";
import { ALABAMA_LOCAL_RATES_URL } from "./al-rates.mjs";
import { COLORADO_RATE_LOOKUP_URL } from "./co-rates.mjs";
import { LOUISIANA_REMOTE_SELLER_LOOKUP_URL } from "./la-rates.mjs";
import { MISSOURI_RATE_TABLES_URL } from "./mo-rates.mjs";

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
  "GA", "IA", "KS", "MN", "NC", "ND", "NE", "NV", "OH", "OK", "SD", "TN", "UT", "VT", "WA", "WI", "WV",
]);

// Confirmed 2026-08-26 (see docs/roadmap-50-states.md): real, current, validated GENERIC_SST_STATES
// entries in server/sst-rates.mjs - either a clean drop-in county model (AR, WY) or a confirmed flat/
// no-local-tax state (IN, KY, MI, RI). Listed separately from SST_RATE_STATES above, which is now only
// the "claimed but not independently wired into a config entry yet" bucket.
const CONNECTED_GENERIC_SST_STATES = new Set(["AR", "WY", "IN", "KY", "MI", "RI"]);

// Confirmed 2026-08-26: these states impose no general state or local sales/use tax at all (4 of the
// 5 well-known "NOMAD" states; Alaska is the 5th but has real local-only sales tax and isn't included
// here). Per Lukas's decision, excluded from the rate-comparison dashboard entirely - there is no rate
// to monitor, not an unbuilt one.
const NO_GENERAL_SALES_TAX_STATES = new Set(["DE", "MT", "NH", "OR"]);

export function listOfficialSourceRegistry() {
  return Object.entries(STATES).map(([stateCode, stateName]) => {
    if (stateCode === "AL") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-dor-monthly-general-sales-csv",
        coverage: "current general sales-tax locality rows plus explicit corporate-limit, county, police-jurisdiction, and available sellers-use rates; address-to-zone and A+ matching remain unresolved",
        sourceName: "Alabama Department of Revenue", sourceUrl: ALABAMA_LOCAL_RATES_URL,
      };
    }
    if (stateCode === "AK") {
      return {
        stateCode, stateName, status: "connected", adapter: "local-only-arsstc-xlsx",
        coverage: "zero state sales tax plus 56 current ARSSTC remote-seller destination rows (10 borough-area and 46 city rows); nonmember municipalities and address boundaries remain unresolved",
        sourceName: "Alaska Remote Seller Sales Tax Commission", sourceUrl: ALASKA_REMOTE_SELLER_RATES_URL,
      };
    }
    if (stateCode === "NM") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-trd-rgis-grt-csv-archive",
        coverage: "all current official district location codes and GRT totals, including county remainders, municipalities, special districts, and paired tribal classes; address-to-polygon and A+ matching remain unresolved",
        sourceName: "New Mexico Taxation and Revenue Department / RGIS", sourceUrl: NEW_MEXICO_GIS_DATA_URL,
      };
    }
    if (stateCode === "CO") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-dor-half-year-layered-xlsx",
        coverage: "current jurisdiction codes, counties, layered totals, and self-collected-home-rule flags; city-name matching is prohibited and address-to-district/A+ matching remain unresolved",
        sourceName: "Colorado Department of Revenue", sourceUrl: COLORADO_RATE_LOOKUP_URL,
      };
    }
    if (stateCode === "LA") {
      return {
        stateCode, stateName, status: "connected", adapter: "remote-seller-current-parish-html",
        coverage: "all current domicile-rate rows across 64 parish selectors, keyed by parish plus domicile because the same domicile code can have different parish-context rates; address/A+ matching remain unresolved",
        sourceName: "Louisiana Sales and Use Tax Commission for Remote Sellers / Louisiana DOR", sourceUrl: LOUISIANA_REMOTE_SELLER_LOOKUP_URL,
      };
    }
    if (stateCode === "MO") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-dor-quarterly-filing-code-xlsx",
        coverage: "all current city/county/special-district filing-code combinations with general sales, use, food, domestic-utility, and AMJ rates; address-to-code and A+ matching remain unresolved",
        sourceName: "Missouri Department of Revenue", sourceUrl: MISSOURI_RATE_TABLES_URL,
      };
    }
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
        stateCode, stateName, status: "connected", adapter: "state-dor-pdf",
        coverage: "all 46 county (unincorporated) and municipality totals from ST-575; A+ tax-body matching not yet built",
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
        stateCode, stateName, status: "connected", adapter: "state-dor-fixed-width",
        coverage: "current jurisdiction-wide standard-merchandise totals from IDOR's fixed-width file; address-override locations and A+ tax-body matching remain intentionally unresolved",
        sourceName: "Illinois Department of Revenue", sourceUrl: ILLINOIS_IDOR_OVERVIEW_URL,
      };
    }
    if (stateCode === "VA") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-dor-xlsx",
        coverage: "all 95 counties and 38 independent cities with official FIPS codes and current combined rates; address-level and A+ tax-body matching remain unresolved",
        sourceName: "Virginia Department of Taxation", sourceUrl: VIRGINIA_DOR_RATES_URL,
      };
    }
    if (stateCode === "MD") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-flat-rate",
        coverage: "flat 6% statewide rate (Tax-General Article Section 11-104); Maryland preempts local general sales tax, so no address matching is ever needed",
        sourceName: "Comptroller of Maryland", sourceUrl: MARYLAND_RATE_CHART_URL,
      };
    }
    if (stateCode === "NJ") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-flat-rate",
        coverage: "flat statewide rate (6.625% since 2018), cross-validated live against two independent NJ Division of Taxation pages and wired to A+'s NJ000 assignment; different-state ship-to assignments are counted separately. One open caveat: NJ's Urban Enterprise Zone / Salem County reduced rate depends on Atlantic's own seller certification, not modeled - see docs/states/nj.md",
        aplusMatchingStatus: "connected", comparisonEndpoint: "/api/official/states/NJ/aplus",
        sourceName: "New Jersey Division of Taxation", sourceUrl: NJ_USE_TAX_FAQ_URL,
      };
    }
    if (stateCode === "IA") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "6% statewide rate plus validated county, city, and special local-option components; A+ code-to-jurisdiction matching remains unresolved",
        sourceName: "Iowa Department of Revenue via Streamlined Sales Tax", sourceUrl: "https://revenue.iowa.gov/taxes/tax-guidance/sales-use-excise-tax/sales-use-tax-guide",
      };
    }
    if (stateCode === "AZ") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-dor-monthly-csv-retail",
        coverage: "monthly business-code-017 retail inventory across all 15 counties, cities, and tribal/special regions; city totals and A+ discrepancy decisions remain unresolved",
        sourceName: "Arizona Department of Revenue", sourceUrl: ARIZONA_DOR_RATE_TABLE_URL,
      };
    }
    if (stateCode === "HI") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-dotax-get-policy-html",
        coverage: "seller-side 4% GET base, four 0.5% county surcharges, Kalawao exemption, and optional 4.712% maximum visible pass-on; not treated as a conventional sales-tax mismatch",
        sourceName: "Hawaii Department of Taxation", sourceUrl: HAWAII_GET_URL,
      };
    }
    if (stateCode === "ID") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-tax-commission-html-partial-local",
        coverage: "validated 6% state sales/use rate plus an official inventory of 23 separately administered resort-city local-tax jurisdictions; local rates unavailable centrally and never guessed",
        sourceName: "Idaho State Tax Commission", sourceUrl: IDAHO_TAX_COMMISSION_RATES_URL,
      };
    }
    if (stateCode === "ME") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-dor-html-flat-rate",
        coverage: "flat 5.5% general sales/use-tax rate effective 2026-01-01; special category rates remain outside the general comparison",
        sourceName: "Maine Revenue Services", sourceUrl: MAINE_REVENUE_RATES_URL,
      };
    }
    if (stateCode === "MA") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-dor-html-flat-rate",
        coverage: "flat 6.25% general sales/use-tax rate for tangible personal property; category-specific local options remain outside the general comparison",
        sourceName: "Massachusetts Department of Revenue", sourceUrl: MASSACHUSETTS_DOR_RATES_URL,
      };
    }
    if (stateCode === "MS") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-dor-html-general-plus-city",
        coverage: "7% general tangible-property rate plus Jackson's 1% and Tupelo's 0.25% general-retail levies; other category-specific tourism levies excluded",
        sourceName: "Mississippi Department of Revenue", sourceUrl: MISSISSIPPI_DOR_RATES_URL,
      };
    }
    if (stateCode === "NY") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-dtf-pdf-combined-rates",
        coverage: "all 77 current Publication 718 state/local reporting rows (57 county areas, 19 cities, and the state-only row); ZIP derivation and A+ alias/discrepancy matching remain intentionally unresolved",
        sourceName: "New York State Department of Taxation and Finance", sourceUrl: NEW_YORK_CURRENT_RATES_URL,
      };
    }
    if (stateCode === "CT") {
      return {
        stateCode, stateName, status: "connected", adapter: "state-dor-html-flat-rate",
        coverage: "flat 6.35% general rate with no additional local-jurisdiction sales tax; special product/service rates remain outside the general-rate comparison",
        sourceName: "Connecticut Department of Revenue Services", sourceUrl: CONNECTICUT_DRS_RATES_URL,
      };
    }
    if (stateCode === "DC") {
      return {
        stateCode, stateName, status: "connected", adapter: "district-otr-html-flat-rate",
        coverage: "citywide 6% general rate through 2026-09-30 and the enacted 7% rate beginning 2026-10-01; no local boundary matching required",
        sourceName: "District of Columbia Office of Tax and Revenue", sourceUrl: DISTRICT_OF_COLUMBIA_OTR_RATES_URL,
      };
    }
    if (stateCode === "KS") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "6.5% statewide rate plus validated county, city, and special-jurisdiction components; address-level and A+ tax-body matching remain intentionally unresolved",
        sourceName: "Kansas Department of Revenue via Streamlined Sales Tax", sourceUrl: "https://www.ksrevenue.gov/salesratechanges.html",
      };
    }
    if (stateCode === "MN") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "6.875% statewide rate plus validated active county, city, and special-jurisdiction components; address-level and A+ tax-body matching remain unresolved",
        sourceName: "Minnesota Department of Revenue via Streamlined Sales Tax", sourceUrl: "https://www.revenue.state.mn.us/local-sales-tax-information",
      };
    }
    if (stateCode === "ND") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "5% statewide rate plus validated county and city components; local maximum-tax caps and A+ matching remain unresolved",
        sourceName: "North Dakota Office of State Tax Commissioner via Streamlined Sales Tax", sourceUrl: "https://www.tax.nd.gov/sales-and-use-tax/local-taxes-city-and-county-taxes",
      };
    }
    if (stateCode === "NE") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "5.5% statewide rate plus validated active city, county, and special-jurisdiction components; complete-total and A+ matching remain unresolved",
        sourceName: "Nebraska Department of Revenue via Streamlined Sales Tax", sourceUrl: "https://revenue.nebraska.gov/businesses/local-sales-and-use-tax-rates",
      };
    }
    if (stateCode === "NV") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file-total-rates",
        coverage: "6.85% minimum statewide rate plus all 17 county/equivalent totals and special-jurisdiction totals; A+ matching remains unresolved",
        sourceName: "Nevada Department of Taxation via Streamlined Sales Tax", sourceUrl: "https://tax.nv.gov/tax-types/consumer-use-tax/",
      };
    }
    if (stateCode === "OK") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "4.5% statewide rate plus validated county, municipality, and special-jurisdiction components; address-level and A+ matching remain unresolved",
        sourceName: "Oklahoma Tax Commission via Streamlined Sales Tax", sourceUrl: "https://oklahoma.gov/tax/businesses/sales-use-tax.html",
      };
    }
    if (stateCode === "SD") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "4.2% statewide rate plus validated county, municipality, and tribal/special-jurisdiction records; address-level and A+ matching remain unresolved",
        sourceName: "South Dakota Department of Revenue via Streamlined Sales Tax", sourceUrl: "https://dor.sd.gov/individuals/taxes/sales-use-tax/",
      };
    }
    if (stateCode === "UT") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "4.85% statewide rate plus validated county and city components; ZIP+4/address-level and A+ matching remain unresolved",
        sourceName: "Utah State Tax Commission via Streamlined Sales Tax", sourceUrl: "https://tax.utah.gov/business/sales-tax/sales/rates/",
      };
    }
    if (stateCode === "VT") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "6% statewide rate plus 1% destination-based municipal local-option components; address-level and A+ matching remain unresolved",
        sourceName: "Vermont Department of Taxes via Streamlined Sales Tax", sourceUrl: "https://tax.vermont.gov/business/industry/contractors",
      };
    }
    if (stateCode === "WA") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "6.5% statewide rate plus validated county, city, and special/location-code components; address-level and A+ matching remain unresolved",
        sourceName: "Washington Department of Revenue via Streamlined Sales Tax", sourceUrl: "https://dor.wa.gov/taxes-rates/sales-use-tax-rates",
      };
    }
    if (stateCode === "WI") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "5% statewide rate plus validated county and city components; premier-resort/local-exposition taxes and A+ matching remain unresolved",
        sourceName: "Wisconsin Department of Revenue via Streamlined Sales Tax", sourceUrl: "https://www.revenue.wi.gov/Pages/Apps/strb.aspx",
      };
    }
    if (stateCode === "WV") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "6% statewide rate plus validated 1% municipal components; municipal-boundary and A+ matching remain unresolved",
        sourceName: "West Virginia Tax Division via Streamlined Sales Tax", sourceUrl: "https://tax.wv.gov/business/salesandusetax/municipalsalesandusetax/pages/municipalsalesandusetax.aspx",
      };
    }
    if (stateCode === "OH" || stateCode === "TN") {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "state, county, city, and special-jurisdiction rate components",
        sourceName: `${stateName} via Streamlined Sales Tax`, sourceUrl: SST_RATE_DIRECTORY_URL,
      };
    }
    if (CONNECTED_GENERIC_SST_STATES.has(stateCode)) {
      return {
        stateCode, stateName, status: "connected", adapter: "sst-rate-file",
        coverage: "jurisdiction rate components, validated 2026-08-26", sourceName: `${stateName} via Streamlined Sales Tax`, sourceUrl: SST_RATE_DIRECTORY_URL,
      };
    }
    if (NO_GENERAL_SALES_TAX_STATES.has(stateCode)) {
      return {
        stateCode, stateName, status: "no-general-sales-tax", adapter: "none",
        coverage: "confirmed 2026-08-26: no general state or local sales/use tax exists in this state; excluded from rate comparison, not an unbuilt adapter",
        sourceName: "N/A", sourceUrl: null,
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
