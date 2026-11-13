/**
 * Text wrapping, measured in a real browser (lab finding S11 and the 0.14.0
 * regression its first fix caused). Uses the workspace's installed sidecar
 * Playwright and its Chrome; adds no dependency and downloads no browser.
 *
 *   npm run build && node parity/text-wrap-browser.mjs            # assert
 *   npm run build && node parity/text-wrap-browser.mjs --rules=0.14   # measure 0.14.0's rule, no assertion
 *   npm run build && node parity/text-wrap-browser.mjs --rules=none   # measure no wrap rule (before S11), no assertion
 *
 * Fixtures (parity/text-wrap/):
 *   - lab-run-542/546/549/552/554.json: the finished documents of the lab
 *     runs whose judges reported "Discriminatio/n", prices wrapping "$ over 9"
 *     and a "41%" stat broken across lines, under two builder models. Served
 *     with fancy-labs' SiteRenderController host CSS.
 *   - hostile-facts.json: the hostile-facts header, home page and footer from
 *     the run that measured 380px wide at 375px (S11). Served with the
 *     kit-site host's Tailwind preflight and its Instrument Sans.
 *   - s11-adversarial.json: the hostile tokens in every container where a long
 *     token can widen a page (grid tracks, row stacks, a shrink-to-fit stack,
 *     a wrapping nav, an auto-fit grid) beside ordinary words, prices and stats.
 *
 * Every page is rendered by fancy-cms (PHP, what the lab serves) and asserted
 * byte-identical to this package's renderer and emitter first. Then, at 375,
 * 768 and 1280px:
 *   - the page never scrolls sideways;
 *   - no word breaks mid-word if it fits its track. A word "fits" when its
 *     unbroken width is at most the content width of its nearest grid or
 *     row-flex container (the width the track could grow to), else of its own
 *     element. A break right after a hyphen, dash or zero-width space is a
 *     normal break opportunity, not mid-word. Only the adversarial page's
 *     hostile tokens may break anywhere.
 *
 * The run fixtures name Windows system fonts (Segoe UI, Georgia, Palatino
 * Linotype, Arial Narrow), as the lab's Chrome renders them; on another OS the
 * fallbacks differ and so may the measurements.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CmsPage } from "../dist/react.js";
import { emitDocCss } from "../dist/index.js";
import icons from "../icons/all.js";
import { chromium } from "../../fancy-labs/vendor/particle-academy/prism-browser/sidecar/node_modules/playwright/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const mode = (process.argv.find((a) => a.startsWith("--rules=")) ?? "--rules=current").slice(8);
if (!["current", "0.14", "none"].includes(mode)) throw new Error(`--rules must be current, 0.14 or none, not ${mode}`);
const before = mode !== "current";
const WIDTHS = [375, 768, 1280];
const SEL = ":where(h1, h2, h3, h4, h5, h6, p, ul, ol, a:not([data-cms-button]), span, [data-cms-callout])";
const RULES = `${SEL}[data-cms] {\n  overflow-wrap: break-word;\n}\n\n${SEL}[data-cms-wrap="anywhere"] {\n  overflow-wrap: anywhere;\n}`;
const RULE_0_14 = `${SEL}[data-cms] {\n  overflow-wrap: anywhere;\n}`;
/** The adversarial page's hostile tokens: the only words allowed to break anywhere. */
const HOSTILE = /pwned|example\.com\/a\/|AAAAAAAAAA/;

// fancy-labs SiteRenderController's host stylesheet (lab runs).
const FLABS_HOST = "html,body{margin:0;padding:0}body{font-family:var(--cms-font-body,system-ui,sans-serif);color:var(--cms-color-ink,#0f172a);background:var(--cms-color-surface,#fff)}";
// The kit-site host: Tailwind v4 preflight's core and its --font-sans.
const KIT_HOST = "*,::after,::before{box-sizing:border-box;margin:0;padding:0;border:0 solid}html{line-height:1.5;font-family:'Instrument Sans',ui-sans-serif,system-ui,sans-serif}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}ol,ul{list-style:none}";
const fontDir = resolve(here, "../../fancy-labs/public/build/assets");
const fontFiles = readdirSync(fontDir).filter((f) => /^instrument-sans-(400|500|600)-normal-.*\.woff2$/.test(f));
const FACES = fontFiles.map((f) => `@font-face{font-family:"Instrument Sans";font-weight:${f.split("-")[2]};src:url(/font/${f}) format("woff2")}`).join("");

const scratch = mkdtempSync(resolve(tmpdir(), "fancy-cms-wrap-"));
const php = (script, docPath) => execFileSync(process.env.FANCY_CMS_PHP || "php", [resolve(here, `../../fancy-cms/bin/${script}.php`), docPath], { encoding: "utf8" });

/** PHP-rendered markup + CSS for a list of documents, asserted equal to the JS twins. */
function render(name, docs) {
  let html = "", css = "";
  docs.forEach((doc, i) => {
    const path = resolve(scratch, `${name}-${i}.json`);
    writeFileSync(path, JSON.stringify(doc));
    const phpHtml = php("render-html", path), phpCss = php("emit-css", path);
    assert.equal(phpHtml, renderToStaticMarkup(createElement(CmsPage, { doc, icons, includeStyles: false })), `${name}: HTML parity`);
    assert.equal(phpCss, emitDocCss(doc), `${name}: CSS parity`);
    assert.ok(phpCss.includes(RULES), `${name}: the stylesheet carries the wrap rules`);
    html += phpHtml;
    css += `${phpCss}\n`;
  });
  if (before) css = css.split(RULES).join(mode === "0.14" ? RULE_0_14 : "");
  return { html, css };
}

const fixtures = readdirSync(resolve(here, "text-wrap")).filter((f) => f.endsWith(".json")).sort().map((file) => {
  const json = JSON.parse(readFileSync(resolve(here, "text-wrap", file), "utf8"));
  const name = file.replace(/\.json$/, "");
  const { html, css } = render(name, json.docs ?? [json]);
  const host = name === "hostile-facts" ? KIT_HOST : FLABS_HOST;
  return { name, page: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${FACES}${host}\n${css}</style></head><body>${html}</body></html>` };
});

/** In the page: horizontal overflow, and every mid-word break with its measurements. */
function probe() {
  const vw = document.documentElement.clientWidth;
  const natural = (el, word) => {
    const s = document.createElement("span");
    s.textContent = word;
    s.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;left:0;top:0";
    el.appendChild(s);
    const w = s.getBoundingClientRect().width;
    s.remove();
    return w;
  };
  const contentWidth = (el) => {
    const cs = getComputedStyle(el);
    return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  };
  const track = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.display.includes("grid") || (cs.display.includes("flex") && cs.flexDirection.startsWith("row"))) return contentWidth(a);
    }
    return contentWidth(el);
  };
  const breaks = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const el = t.parentElement;
    if (!el || el.closest("[data-cms-sr], style, script")) continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    for (const m of t.data.matchAll(/\S+/g)) {
      const word = m[0];
      if (word.length < 2) continue;
      const at = [];
      let prev = null;
      for (let i = 0; i < word.length; i++) {
        const r = document.createRange();
        r.setStart(t, m.index + i);
        r.setEnd(t, m.index + i + 1);
        const rect = [...r.getClientRects()].find((x) => x.width > 0) ?? r.getBoundingClientRect();
        const top = Math.round(rect.top);
        if (prev !== null && top > prev + 2 && !/[-\u2010\u2013\u2014\u200b]/.test(word[i - 1])) at.push(i);
        prev = top;
      }
      if (!at.length) continue;
      const width = natural(el, word);
      const room = track(el);
      breaks.push({ word, shown: at.map((i) => `${word.slice(0, i)}/${word.slice(i)}`).join(" | "), node: el.closest("[data-cms]")?.getAttribute("data-cms") ?? null, width: Math.round(width), track: Math.round(room), fits: width <= room });
    }
  }
  return { scrollWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth - vw, breaks };
}

const output = resolve(here, `../../../sandbox/text-wrap-browser-${mode}`);
mkdirSync(output, { recursive: true });
let browser;
const results = [];
const failures = [];
try {
  browser = await chromium.launch({ headless: true });
  for (const fixture of fixtures) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== "http://fixture.test") return route.abort();
        if (url.pathname === "/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: fixture.page });
        const font = url.pathname.startsWith("/font/") ? url.pathname.slice(6) : "";
        if (fontFiles.includes(font)) return route.fulfill({ status: 200, contentType: "font/woff2", body: readFileSync(resolve(fontDir, font)) });
        return route.fulfill({ status: 404, body: "" });
      });
      await page.goto("http://fixture.test/", { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      if (fixture.name === "hostile-facts") assert.ok(await page.evaluate(() => document.fonts.check('18px "Instrument Sans"')), "Instrument Sans loaded");
      const r = await page.evaluate(probe);
      const midWord = r.breaks.filter((b) => b.fits && !(fixture.name === "s11-adversarial" && HOSTILE.test(b.word)));
      const tokens = r.breaks.filter((b) => !midWord.includes(b));
      results.push({ fixture: fixture.name, width, overflow: r.overflow, scrollWidth: r.scrollWidth, midWord, tokens });
      console.log(`${fixture.name.padEnd(16)} ${String(width).padStart(4)}  page ${r.scrollWidth}px  overflow ${r.overflow}  mid-word ${midWord.length}${midWord.length ? ` (${midWord.map((b) => b.shown).join(", ")})` : ""}  long tokens broken ${tokens.length}`);
      if (r.overflow > 0) failures.push(`${fixture.name} @${width}: page is ${r.scrollWidth}px wide`);
      for (const b of midWord) failures.push(`${fixture.name} @${width}: "${b.shown}" (${b.width}px word, ${b.track}px track, node ${b.node})`);
      await page.screenshot({ path: resolve(output, `${fixture.name}-${width}.png`), fullPage: true });
      await page.close();
    }
  }
} finally {
  if (browser) await browser.close();
  rmSync(scratch, { recursive: true, force: true });
}
writeFileSync(resolve(output, "evidence.json"), JSON.stringify({ rules: mode, results, failures }, null, 2));
console.log(`\n${results.length} measurements (${fixtures.length} fixtures x ${WIDTHS.length} widths); evidence in ${output}`);
if (before) {
  console.log(`--rules=${mode}: ${failures.length} problems (not asserted).`);
} else if (failures.length) {
  console.log(`FAIL\n  ${failures.join("\n  ")}`);
  process.exit(1);
} else {
  console.log("PASS: no overflow and no mid-word break in a word that fits, at every width.");
}
