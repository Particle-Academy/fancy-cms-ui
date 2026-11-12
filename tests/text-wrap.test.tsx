// @vitest-environment jsdom
/**
 * Lab finding S11: a text node holding an unbroken long string scrolled the
 * page sideways at 375px (hostile-facts measured 380px), and a document had
 * no way to fix it.
 *
 * Text-bearing nodes now get `overflow-wrap: anywhere` from the base
 * stylesheet. `anywhere`, not `break-word`: only `anywhere` lowers a node's
 * min-content width, which is what a grid track (`1fr` is `minmax(auto, 1fr)`)
 * and a flex item's automatic minimum size are sized from, so `break-word`
 * still lets a long token push a grid or a shrink-to-fit stack wider than the
 * screen. Text that fits looks exactly as before; only a token wider than its
 * line is broken.
 *
 * `tests/fixtures/text-wrap.json` is byte-identical in particle-academy/fancy-cms,
 * whose suite checks the same rule, markup and declarations.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { CmsPage } from "../src/react/CmsPage";
import { BASE_CSS, emitDocCss } from "../src/render/css";
import type { Node, PageDoc, StyleProps } from "../src/document/types";

interface Fixture {
  rule: string;
  cases: { name: string; wraps: boolean; nodes: Node[]; html: string }[];
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

/** The rule's selector, as written in the stylesheet. */
const selector = fixture.rule.slice(0, fixture.rule.indexOf(" {"));

describe("long unbroken tokens wrap (S11)", () => {
  it("the base stylesheet carries the shared rule", () => {
    expect(BASE_CSS).toContain(`\n\n${fixture.rule}\n\n`);
  });

  it("the rule has zero specificity beyond [data-cms], so a node's own overflowWrap wins", () => {
    expect(selector.startsWith(":where(")).toBe(true);
    expect(selector.endsWith(")[data-cms]")).toBe(true);
  });

  it("comes after the margin reset, in every emitted stylesheet", () => {
    const css = emitDocCss(doc(fixture.cases[0]!.nodes));
    expect(css.indexOf(fixture.rule)).toBeGreaterThan(css.indexOf(":where(h1, h2, h3, h4, h5, h6, p, ul, ol)[data-cms] {"));
  });

  it.each(fixture.cases.map((c) => [c.name, c] as const))("%s renders the shared markup", (_name, c) => {
    expect(renderToStaticMarkup(<CmsPage doc={doc(c.nodes)} includeStyles={false} />)).toBe(c.html);
  });

  it.each(fixture.cases.map((c) => [c.name, c] as const))("%s: the rule matches its element exactly when it should", (_name, c) => {
    const host = document.createElement("div");
    host.innerHTML = c.html;
    const el = host.firstElementChild!;
    expect(el.getAttribute("data-cms")).toBe(c.nodes[0]!.id);
    expect(el.matches(selector)).toBe(c.wraps);
  });

  it.each(fixture.styles.map((s) => [s.name, s] as const))("overflowWrap: %s", (_name, s) => {
    const node: Node = { id: "a", type: "text", parent: null, order: "a0", props: {}, style: { base: s.style as Partial<StyleProps> } };
    const css = emitDocCss(doc([node]));
    expect(css.startsWith(BASE_CSS)).toBe(true);
    expect(css === `${BASE_CSS}\n` ? "" : css.slice(BASE_CSS.length + 2)).toBe(s.css);
  });

  it("the fixture is byte-identical to fancy-cms's copy, when that repo is beside this one", () => {
    const theirs = resolve(__dirname, "../../fancy-cms/tests/fixtures/text-wrap.json");
    if (!existsSync(theirs)) return;
    expect(readFileSync(fixturePath, "utf8")).toBe(readFileSync(theirs, "utf8"));
  });
});
