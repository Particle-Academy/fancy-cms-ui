/**
 * Dual-emitter CSS parity harness — the Phase 0 acceptance gate.
 *
 * Emits CSS for a canonical Stages document through BOTH engines:
 *   - JS:  emitDocCss from @particle-academy/fancy-cms-ui (../dist)
 *   - PHP: particle-academy/fancy-cms bin/emit-css.php (the published renderer)
 * and asserts byte-identical output. Same discipline as the dark-slide /
 * holy-sheet PHP≡Node harness.
 *
 *   npm run build && node parity/run.mjs
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { emitDocCss } from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const docPath = resolve(here, "canonical-doc.json");
const doc = JSON.parse(readFileSync(docPath, "utf8"));

const jsCss = emitDocCss(doc);

const phpBin = resolve(here, "../../fancy-cms/bin/emit-css.php");
// `php` resolves through the shell on this machine.
const phpCss = execFileSync("php", [phpBin, docPath], { encoding: "utf8", shell: true });

if (jsCss === phpCss) {
  console.log(`PARITY PASS — JS and PHP emitters produced byte-identical CSS (${jsCss.length} bytes).`);
  process.exit(0);
}

console.log("PARITY FAIL — outputs differ.\n");
const a = jsCss.split("\n");
const b = phpCss.split("\n");
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  if (a[i] !== b[i]) {
    console.log(`first diff at line ${i + 1}:`);
    console.log(`  JS:  ${JSON.stringify(a[i])}`);
    console.log(`  PHP: ${JSON.stringify(b[i])}`);
    break;
  }
}
console.log("\n--- JS ---\n" + jsCss);
console.log("--- PHP ---\n" + phpCss);
process.exit(1);
