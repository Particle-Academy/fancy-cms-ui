/**
 * Dual-renderer HTML parity harness (0.9.0): the markup half of the
 * acceptance gate, beside `run.mjs` for CSS.
 *
 * Renders each canonical document (`parity/canonical*.json`) through BOTH
 * engines with styles excluded:
 *   - JS:  renderToStaticMarkup(<CmsPage doc includeStyles={false} />) from ../dist
 *   - PHP: particle-academy/fancy-cms bin/render-html.php (PageRenderer html)
 * and asserts byte-identical output. A server-rendered page and a
 * browser-rendered page must be the same page.
 *
 *   npm run build && node parity/html.mjs
 */
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CmsPage } from "../dist/react.js";
import icons from "../icons/all.js";
import { iconNames, emptyDoc } from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const phpBin = resolve(here, "../../fancy-cms/bin/render-html.php");
const assetPath = resolve(here, "image-assets.json");
const assets = JSON.parse(readFileSync(assetPath, "utf8"));
const imageResolver = handle => assets[handle] ?? null;
const files = readdirSync(here).filter((f) => /^canonical.*\.json$/.test(f)).sort();
const scratch = mkdtempSync(resolve(tmpdir(), "fancy-cms-icons-html-"));
const fullPath = resolve(scratch, "all-names.json");
const fullDoc = emptyDoc("all-lucide-names");
for (const [index, name] of iconNames().entries()) {
  const id = `icon-${index}`;
  fullDoc.nodes[id] = { id, type: "icon", parent: null, order: name, props: { name, decorative: index % 2 === 0, label: `${name} <label> & \"quoted\"` }, style: { base: {} } };
}
writeFileSync(fullPath, JSON.stringify(fullDoc));
const cases = [...files.map(file => ({ file, docPath: resolve(here, file) })), { file: "all 1803 Lucide names/aliases", docPath: fullPath }];

let failed = 0;
for (const { file, docPath } of cases) {
  const doc = JSON.parse(readFileSync(docPath, "utf8"));
  const jsHtml = renderToStaticMarkup(createElement(CmsPage, { doc, icons, imageResolver, includeStyles: false }));
  let phpHtml;
  try {
    // No shell: a fixture's filename must never be read as shell text.
    phpHtml = execFileSync(process.env.FANCY_CMS_PHP || "php", [phpBin, docPath, assetPath], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  } catch (e) {
    failed++;
    console.log(`HTML PARITY FAIL  ${file}: the PHP renderer could not run (${e.message.split("\n")[0]})`);
    continue;
  }

  if (jsHtml === phpHtml) {
    console.log(`HTML PARITY PASS  ${file}: byte-identical markup (${jsHtml.length} bytes).`);
    continue;
  }

  failed++;
  let i = 0;
  while (i < jsHtml.length && jsHtml[i] === phpHtml[i]) i++;
  console.log(`HTML PARITY FAIL  ${file}: first difference at byte ${i}.`);
  console.log(`  JS:  ${JSON.stringify(jsHtml.slice(Math.max(0, i - 60), i + 80))}`);
  console.log(`  PHP: ${JSON.stringify(phpHtml.slice(Math.max(0, i - 60), i + 80))}`);
}

unlinkSync(fullPath);
rmdirSync(scratch);
console.log(`\n${cases.length - failed} of ${cases.length} canonical documents in HTML parity.`);
process.exit(failed ? 1 : 0);
