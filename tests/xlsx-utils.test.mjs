import assert from "node:assert/strict";
import test from "node:test";
import { workbookRows } from "../server/xlsx-utils.mjs";

test("XLSX empty cells cannot consume the next cell or shift its value", () => {
  const xml = '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" s="1"/><c r="C1"/><c r="D1" t="s"><v>1</v></c><c r="E1"/><c r="Z1"><v>0.0735</v></c></row>';
  assert.deepEqual(workbookRows(xml, ["Beaver City", "01-002"]), [{ A: "Beaver City", B: "", C: "", D: "01-002", E: "", Z: "0.0735" }]);
});
