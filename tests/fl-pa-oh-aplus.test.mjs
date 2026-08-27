import assert from "node:assert/strict";
import test from "node:test";
import { readFloridaAplusComparison } from "../server/fl-aplus.mjs";
import { readPennsylvaniaAplusComparison } from "../server/pa-aplus.mjs";
import { readOhioAplusComparison } from "../server/oh-aplus.mjs";

// server/fl-aplus.mjs matches by the real county name in TBTXNAM, not by numeric code index - an
// earlier claim that FL### is a reliable alphabetical index was found wrong live (FL055 is really
// St. Johns, not the 55th county alphabetically). These fixtures exercise that name-based path,
// including the "St." abbreviation normalization St. Johns/St. Lucie need.
test("Florida matches tax bodies by their real county name, not a numeric index", async () => {
  const stateDetail = {
    stateCode: "FL",
    activeShipTos: 4,
    taxBodies: [
      { taxBody: "FL055", description: "Florida St. Johns", activeShipTos: 2, currentRate: 7 },
      { taxBody: "FL000", description: null, activeShipTos: 1, currentRate: null, definitionStatus: "missing" },
      { taxBody: "HN000", description: "HONDURAS no tax", activeShipTos: 1, currentRate: 0 },
    ],
  };
  const officialSnapshot = {
    stateRate: 6,
    rates: [
      { jurisdictionType: "county", county: "ST JOHNS", name: "ST JOHNS County", totalGeneralRate: 6.5 },
      { jurisdictionType: "county", county: "SARASOTA", name: "SARASOTA County", totalGeneralRate: 7 },
    ],
  };
  const result = await readFloridaAplusComparison(stateDetail, { readOfficialFlRates: async () => officialSnapshot });
  const stJohns = result.findings.find((f) => f.taxBody === "FL055");
  assert.equal(stJohns.matched, true);
  assert.equal(stJohns.officialRate, 6.5);
  assert.equal(stJohns.hasDifference, true);
  assert.equal(result.totals.misinputShipTos, 1);
});

test("Pennsylvania compares PA000 against the flat base rate and PA001 against Philadelphia specifically", async () => {
  const stateDetail = {
    stateCode: "PA",
    activeShipTos: 3,
    taxBodies: [
      { taxBody: "PA000", description: "Pennsylvania", activeShipTos: 2, currentRate: 6 },
      { taxBody: "PA001", description: "Pennsylvania Philadelphia", activeShipTos: 1, currentRate: 6 },
    ],
  };
  const officialSnapshot = {
    rates: [
      { name: "Allegheny", totalGeneralRate: 7 },
      { name: "Philadelphia", totalGeneralRate: 8 },
      { name: "Franklin", totalGeneralRate: 6 },
    ],
  };
  const result = await readPennsylvaniaAplusComparison(stateDetail, { readOfficialPaRates: async () => officialSnapshot });
  const catchAll = result.findings.find((f) => f.taxBody === "PA000");
  const philly = result.findings.find((f) => f.taxBody === "PA001");
  assert.equal(catchAll.officialRate, 6);
  assert.equal(catchAll.hasDifference, false);
  assert.equal(philly.officialRate, 8);
  assert.equal(philly.hasDifference, true);
  assert.equal(philly.rateDifference, 2);
});

test("Ohio folds a matching transit-authority surcharge into the county total before comparing", async () => {
  const stateDetail = {
    stateCode: "OH",
    activeShipTos: 3,
    taxBodies: [
      { taxBody: "OH000", description: "Ohio", activeShipTos: 1, currentRate: 0 },
      { taxBody: "OH018", description: "OHIO CUYAHOGA CO.", activeShipTos: 1, currentRate: 8 },
      { taxBody: "OH042", description: "OHIO KNOX CO.", activeShipTos: 1, currentRate: 6.75 },
    ],
  };
  const officialSnapshot = {
    rates: [
      { jurisdictionType: "county", jurisdictionCode: "018", name: "Cuyahoga County", totalGeneralRate: 7 },
      { jurisdictionType: "county", jurisdictionCode: "042", name: "Knox County", totalGeneralRate: 7.25 },
      { jurisdictionType: "special", jurisdictionCode: "18000", componentRate: 1 },
    ],
  };
  const result = await readOhioAplusComparison(stateDetail, { readOfficialSstStateRates: async () => officialSnapshot });
  const cuyahoga = result.findings.find((f) => f.taxBody === "OH018");
  const knox = result.findings.find((f) => f.taxBody === "OH042");
  assert.equal(cuyahoga.officialRate, 8, "Cuyahoga's 7% county row + 1% transit surcharge should fold to 8%, matching A+");
  assert.equal(cuyahoga.hasDifference, false);
  assert.equal(knox.officialRate, 7.25, "Knox has no matching special row, so its plain county rate is used");
  assert.equal(knox.hasDifference, true, "Knox is a genuine confirmed stale rate, not surcharge noise");
  assert.equal(result.totals.misinputShipTos, 1);
});
