// @vitest-environment jsdom
/**
 * Lab finding S11: a text node holding an unbroken long string scrolled the
 * page sideways at 375px (hostile-facts measured 380px).
 *
 * 0.14.0 fixed it with `overflow-wrap: anywhere` on every text node. That
 * lowered every text node's min-content width, which is what grid tracks
 * (`1fr` is `minmax(auto, 1fr)`) and a flex item's automatic minimum are sized
 * from, so at tablet widths tracks shrank below ordinary words and broke them
 * mid-word: "Discriminatio/n", "$/9", "41/%" (lab runs 542 to 554, two builder
 * models).
 *
 * Now text nodes get `break-word`, which breaks a word only when it cannot fit
 * its line and leaves min-content alone, and only a node whose text holds a
 * long token (`longToken` code points with no break opportunity) is marked
 * `data-cms-wrap="anywhere"`, so that token alone stops widening a track.
 * `parity/text-wrap-browser.mjs` measures both halves in a real browser.
 *
 * `tests/fixtures/text-wrap.json` is byte-identical in particle-academy/fancy-cms,
 * whose suite checks the same rules, markup and declarations.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { CmsPage } from "../src/react/CmsPage";
import { BASE_CSS, emitDocCss } from "../src/render/css";
import { LONG_TOKEN, hasLongToken } from "../src/render/wrap";
import type { Node, PageDoc, StyleProps } from "../src/document/types";

interface Fixture {
  rule: string;
  longRule: string;
  longToken: number;
  cases: { name: string; wraps: boolean; anywhere: boolean; nodes: Node[]; html: string }[];
  styles: { name: string; style: Record<string, unknown>; css: string }[];
}

const fixturePath = resolve(__dirname, "fixtures/text-wrap.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;

function doc(nodes: Node[]): PageDoc {
  return {
    id: "wrap",
    seq: 0,
    meta: { title: "Wrap", slug: "/", scrollMode: "smooth" },
    theme: { name: "default" },
    breakpoints: ["base", "md", "lg"],
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
  };
}

/** A rule's selector, as written in the stylesheet. */
const selectorOf = (rule: string) => rule.slice(0, rule.indexOf(" {"));
const selector = selectorOf(fixture.rule);
const longSelector = selectorOf(fixture.longRule);

describe("text wraps without breaking ordinary words (S11 + runs 542 to 554)", () => {
  it("the base stylesheet carries the shared rules, the long-token rule straight after", () => {
    expect(BASE_CSS).toContain(`\n\n${fixture.rule}\n\n${fixture.longRule}\n\n`);
  });

  it("ordinary text breaks only words that cannot fit, and never lowers min-content", () => {
    expect(fixture.rule).toContain("overflow-wrap: break-word;");
    expect(BASE_CSS).not.toContain(`[data-cms] {\n  overflow-wrap: anywhere;`);
  });

  it("both rules have zero specificity beyond one attribute, so a node's own overflowWrap wins", () => {
    expect(selector.startsWith(":where(")).toBe(true);
    expect(selector.endsWith(")[data-cms]")).toBe(true);
    expect(longSelector.startsWith(":where(")).toBe(true);
    expect(longSelector.endsWith(')[data-cms-wrap="anywhere"]')).toBe(true);
  });

  it("comes after the margin reset, in every emitted stylesheet", () => {
    const css = emitDocCss(doc(fixture.cases[0]!.nodes));
    expect(css.indexOf(fixture.rule)).toBeGreaterThan(css.indexOf(":where(h1, h2, h3, h4, h5, h6, p, ul, ol)[data-cms] {"));
  });

  it("the threshold is the shared one", () => {
    expect(LONG_TOKEN).toBe(fixture.longToken);
    expect(hasLongToken("a".repeat(fixture.longToken - 1))).toBe(false);
    expect(hasLongToken("a".repeat(fixture.longToken))).toBe(true);
  });

  it.each(fixture.cases.map((c) => [c.name, c] as const))("%s renders the shared markup", (_name, c) => {
    expect(renderToStaticMarkup(<CmsPage doc={doc(c.nodes)} includeStyles={false} />)).toBe(c.html);
  });

  it.each(fixture.cases.map((c) => [c.name, c] as const))("%s: each rule matches its element exactly when it should", (_name, c) => {
    const host = document.createElement("div");
    host.innerHTML = c.html;
    const el = host.firstElementChild!;
    expect(el.getAttribute("data-cms")).toBe(c.nodes[0]!.id);
    expect(el.matches(selector)).toBe(c.wraps);
    expect(el.matches(longSelector)).toBe(c.anywhere);
  });

  it.each(fixture.styles.map((s) => [s.name, s] as const))("overflowWrap: %s", (_name, s) => {
    const node: Node = { id: "a", type: "text", parent: null, order: "a0", props: {}, style: { base: s.style as Partial<StyleProps> } };
    const css = emitDocCss(doc([node]));
    expect(css.startsWith(BASE_CSS)).toBe(true);
    expect(css === `${BASE_CSS}\n` ? "" : css.slice(BASE_CSS.length + 2)).toBe(s.css);
  });

  it("a bound value is measured after it resolves", () => {
    const node: Node = { id: "b", type: "text", parent: null, order: "a0", props: { content: { $bind: "site.url" } as never }, style: { base: {} } };
    const html = renderToStaticMarkup(<CmsPage doc={doc([node])} data={{ site: { url: "https://example.com/a/very/long/path" } }} includeStyles={false} />);
    expect(html).toBe('<p data-cms="b" data-cms-wrap="anywhere">https://example.com/a/very/long/path</p>');
  });

  it("the fixture is byte-identical to fancy-cms's copy, when that repo is beside this one", () => {
    const theirs = resolve(__dirname, "../../fancy-cms/tests/fixtures/text-wrap.json");
    if (!existsSync(theirs)) return;
    expect(readFileSync(fixturePath, "utf8")).toBe(readFileSync(theirs, "utf8"));
  });
});
