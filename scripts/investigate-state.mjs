#!/usr/bin/env node
// Read-only Layer 2 investigation helper: prints one state's real, active A+ tax-body
// data (the same query and exclusion filters `readStateDetail` uses for the live
// dashboard) as JSON, so a state's Step 1/2 questions (docs/state-rollout.md) can be
// answered from real data without hand-rolling OPENQUERY SQL per state.
//
// Usage: node --experimental-strip-types --env-file-if-exists=.env.local scripts/investigate-state.mjs <STATE_CODE>
//
// Never writes to A+/DWStage/SQL03/APLUS - read-only, same as the dashboard connector.
import { readStateDetail } from "../server/aplus-connector.mjs";

const stateCode = process.argv[2];
if (!stateCode) {
  console.error("Usage: investigate-state.mjs <STATE_CODE>");
  process.exit(1);
}

const detail = await readStateDetail(stateCode);
console.log(JSON.stringify(detail, null, 2));
