/** npm run build && node parity/run-ops.mjs — canonical JSON parity, no snapshots. */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { reduce, reduceAll, invert, rootIds, keyBetween } from "../dist/index.js";
import { generate, SEED } from "./page-ops/generate.mjs";
import { generateNumbers } from "./page-ops/numbers.mjs";
import { iconCases } from "./page-ops/icons.mjs";
import { decorativeCases } from "./page-ops/decorative.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const edge = JSON.parse(readFileSync(resolve(here, "page-ops/edges.json"), "utf8"));
const random = generate(edge.base);
const numbers = generateNumbers();
const cases = edge.cases.map(({ name, ops, extraNodes = [] }) => {
  const doc = structuredClone(edge.base);
  for (const node of extraNodes) doc.nodes[node.id] = node;
  return { name, doc, ops };
}).concat(random.cases, iconCases(edge.base), decorativeCases(edge.base));
const wire = (value) => JSON.parse(JSON.stringify(value));
const canonical = (value) => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])]));
  return value;
}
function runCase({ name, doc: initial, ops }) {
  let doc = structuredClone(initial);
  const states = [];
  for (const op of ops) {
    const prior = doc;
    const before = canonical(doc), beforeOp = canonical(op);
    const inverse = wire(invert(doc, op));
    const invalid = [];
    doc = reduce(doc, op, { onInvalid: (_, reason) => invalid.push(reason) });
    // Inputs are compared to private copies in the PHP runner too.
    if (before !== canonical(prior) || beforeOp !== canonical(op)) throw new Error(`${name}: JS mutated input`);
    const undo = reduceAll(doc, structuredClone(inverse));
    states.push({ doc: wire(doc), inverse, undo: wire(undo), roots: rootIds(doc), invalid });
  }
  return { name, states, all: wire(reduceAll(structuredClone(initial), ops)) };
}
const js = { cases: cases.map(runCase), numbers: numbers.map((value) => String(value)), keys: random.keys.map(([a, b]) => {
  try { return { value: keyBetween(a, b) }; } catch { return { error: true }; }
}) };
const phpDriver = process.env.FANCY_CMS_PHP_DRIVER || resolve(here, "../../fancy-cms/bin/page-ops.php");
const php = JSON.parse(execFileSync(process.env.FANCY_CMS_PHP || "php", [phpDriver], {
  input: JSON.stringify({ cases, keys: random.keys, numbers }), encoding: "utf8", timeout: 120000,
  maxBuffer: 32 * 1024 * 1024, windowsHide: true,
}));
let failures = 0;
for (let i = 0; i < js.cases.length; i++) {
  if (canonical(js.cases[i]) !== canonical(php.cases[i])) {
    failures++;
    const step = js.cases[i].states.findIndex((state, j) => canonical(state) !== canonical(php.cases[i].states[j]));
    console.error(`PARITY FAIL ${js.cases[i].name} step=${step}: JS=${canonical(js.cases[i].states[step])} PHP=${canonical(php.cases[i].states[step])}`);
  }
}
if (canonical(js.keys) !== canonical(php.keys)) {
  failures++;
  console.error("PARITY FAIL fractional ordering keys");
}
if (canonical(js.numbers) !== canonical(php.numbers)) {
  failures++;
  const index = js.numbers.findIndex((value, i) => value !== php.numbers[i]);
  console.error(`PARITY FAIL number formatting index=${index}: JS=${js.numbers[index]} PHP=${php.numbers[index]}`);
}
if (failures) process.exit(1);
const operations = cases.reduce((sum, item) => sum + item.ops.length, 0);
console.log(`PARITY PASS: ${cases.length} sequences, ${operations} intermediate documents/inverses/wire undo replays, ${random.keys.length} fractional keys, ${numbers.length} number strings; seed=0x${SEED.toString(16)}; byte-identical canonical JSON (only key order normalized).`);
