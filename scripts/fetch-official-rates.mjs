#!/usr/bin/env node
// Fetches a state's official-source rate snapshot (public DOR/SST data over the open
// internet - never touches A+/DWStage/SQL03/APLUS) using the same per-state adapter
// mapping /api/official/states/:code uses in server/aplus-connector.mjs, so a Layer 2
// investigation can cross-check A+'s configured rate against the real current one for
// any state whose official source is already connected.
//
// Usage: node --experimental-strip-types scripts/fetch-official-rates.mjs <STATE_CODE>
import { readOfficialGaRates, readOfficialSstStateRates } from "../server/sst-rates.mjs";
import { readOfficialCaRates } from "../server/ca-rates.mjs";
import { readOfficialTxRates } from "../server/tx-rates.mjs";
import { readOfficialFlRates } from "../server/fl-rates.mjs";
import { readOfficialMdRates } from "../server/md-rates.mjs";
import { readOfficialNjRates } from "../server/nj-rates.mjs";
import { readOfficialPaRates } from "../server/pa-rates.mjs";
import { readOfficialScRates } from "../server/sc-rates.mjs";
import { readOfficialNcRates } from "../server/ncdor-rates.mjs";
import { readOfficialVaRates } from "../server/va-rates.mjs";
import { readOfficialNyRates } from "../server/ny-rates.mjs";
import { readOfficialAzRates } from "../server/az-rates.mjs";
import { readOfficialAlRates } from "../server/al-rates.mjs";

const GENERIC_SST = new Set(["OH", "TN", "AR", "WY", "IN", "KY", "MI", "RI", "NV", "NE"]);

const stateCode = String(process.argv[2] || "").toUpperCase();
if (!stateCode) {
  console.error("Usage: fetch-official-rates.mjs <STATE_CODE>");
  process.exit(1);
}

let snapshot;
if (stateCode === "GA") snapshot = await readOfficialGaRates();
else if (stateCode === "CA") snapshot = await readOfficialCaRates();
else if (stateCode === "TX") snapshot = await readOfficialTxRates();
else if (stateCode === "FL") snapshot = await readOfficialFlRates();
else if (stateCode === "MD") snapshot = await readOfficialMdRates();
else if (stateCode === "NJ") snapshot = await readOfficialNjRates();
else if (stateCode === "PA") snapshot = await readOfficialPaRates();
else if (stateCode === "SC") snapshot = await readOfficialScRates();
else if (stateCode === "NC") snapshot = await readOfficialNcRates();
else if (stateCode === "VA") snapshot = await readOfficialVaRates();
else if (stateCode === "NY") snapshot = await readOfficialNyRates();
else if (stateCode === "AZ") snapshot = await readOfficialAzRates();
else if (stateCode === "AL") snapshot = await readOfficialAlRates();
else if (GENERIC_SST.has(stateCode)) snapshot = await readOfficialSstStateRates(stateCode);
else {
  console.error(`No official-source adapter is wired for ${stateCode} yet - see docs/roadmap-50-states.md.`);
  process.exit(2);
}

console.log(JSON.stringify(snapshot, null, 2));
