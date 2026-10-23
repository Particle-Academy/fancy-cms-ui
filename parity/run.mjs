/**
 * Dual-emitter CSS parity harness — the acceptance gate for every emitter change.
 *
 * Emits CSS for each canonical Stages document (`parity/canonical*.json`)
 * through BOTH engines:
 *   - JS:  emitDocCss from @particle-academy/fancy-cms-ui (../dist)
 *   - PHP: particle-academy/fancy-cms bin/emit-css.php (the published renderer)
 * and asserts byte-identical output for every one. Same discipline as the
 * dark-slide / holy-sheet PHP≡Node harness.
 *
 *   npm run build && node parity/run.mjs
 *
 * `canonical-doc-0.8.json` carries the 0.8 style properties AND values that
 * must be dropped (a token or colour trying to close its rule, an unknown
 * keyword), so the two engines are compared on what they refuse, not only on
 * what they emit.
 */
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { emitDocCss } from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const phpBin = resolve(here, "../../fancy-cms/bin/emit-css.php");
const files = readdirSync(here).filter((f) => /^canonical.*\.json$/.test(f)).sort();

let failed = 0;
for (const file of files) {
  const docPath = resolve(here, file);
  const jsCss = emitDocCss(JSON.parse(readFileSync(docPath, "utf8")));
  // No shell: a fixture's filename must never be read as shell text.
  const phpCss = execFileSync(process.env.FANCY_CMS_PHP || "php", [phpBin, docPath], { encoding: "utf8" });

  if (jsCss === phpCss) {
    console.log(`PARITY PASS  ${file}: byte-identical CSS (${jsCss.length} bytes).`);
    continue;
  }

  failed++;
  console.log(`PARITY FAIL  ${file}: outputs differ.`);
  const a = jsCss.split("\n");
  const b = phpCss.split("\n");
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      console.log(`  first diff at line ${i + 1}:`);
      console.log(`    JS:  ${JSON.stringify(a[i])}`);
      console.log(`    PHP: ${JSON.stringify(b[i])}`);
      break;
    }
  }
  console.log("\n--- JS ---\n" + jsCss);
  console.log("--- PHP ---\n" + phpCss);
}

console.log(`\n${files.length - failed} of ${files.length} canonical documents in parity.`);
process.exit(failed ? 1 : 0);
