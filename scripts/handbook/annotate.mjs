// Adds genericPrereqs to public/uwa-units/graph.json, in place.
//
//   node scripts/handbook/annotate.mjs [--dry-run]
//
// parse.mjs already emits this field, so a full re-scrape produces the same
// output. This script exists so the field can be added to an existing
// graph.json without one: the classifier reads rules.prerequisites.html,
// which is already in the file, and touches nothing else.
//
// Idempotent. Running it twice must leave the file byte-identical, which is
// the check worth making after any change to requirements.mjs:
//
//   node scripts/handbook/annotate.mjs && sha256sum public/uwa-units/graph.json
//
// Three things make that hold: classification never reads its own previous
// output, the delete-before-assign below pins the key to last position so a
// re-run matches parse.mjs's key order, and JSON.stringify is called with no
// spacing argument, as parse.mjs does.
//
// That last one is why public/uwa-units/ is in .prettierignore. The committed
// graph.json had been formatted to 2-space indent, which costs 640KB on a
// file fetched on every page load, and prettier collapses short arrays in a
// way JSON.stringify does not - so a formatted copy and a generated copy can
// never agree, and every regeneration churned the whole file.

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyPrereqRule } from "./requirements.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GRAPH = join(ROOT, "public", "uwa-units", "graph.json");
const dryRun = process.argv.includes("--dry-run");

const data = JSON.parse(await readFile(GRAPH, "utf8"));

const prefixes = new Set(data.units.map((u) => u.code.slice(0, 4)));
const schools = new Set(data.units.map((u) => u.school).filter(Boolean));

const counts = {};
const unresolved = new Set();
let withRule = 0;
let withGeneric = 0;

for (const unit of data.units) {
  const html = unit.rules?.prerequisites?.html ?? "";
  if (html) withRule++;
  const result = classifyPrereqRule(html, {
    prefixes,
    schools,
    onUnresolved: (text) => unresolved.add(text.slice(0, 80)),
  });
  for (const req of result) counts[req.kind] = (counts[req.kind] ?? 0) + 1;
  if (result.length) withGeneric++;

  // Re-assign rather than mutate: delete first so the key returns to last
  // insertion position even on an already-annotated file.
  delete unit.genericPrereqs;
  if (result.length) unit.genericPrereqs = result;
}

console.log(`Rules with prerequisites: ${withRule}`);
console.log(`Units with generic requirements: ${withGeneric}`);
console.log("By kind:", counts);
console.log(`Unresolved subject phrases: ${unresolved.size}`);
for (const text of [...unresolved].sort().slice(0, 15)) console.log(`  ${text}`);

if (dryRun) {
  console.log("\n--dry-run: graph.json not written");
} else {
  await writeFile(GRAPH, JSON.stringify(data));
  console.log(`\nWrote ${GRAPH}`);
}
