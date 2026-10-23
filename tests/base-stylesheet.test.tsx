import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDoc, type Node, type PageDoc } from "../src/document/types";
import { reduce } from "../src/document/reduce";
import { BASE_CSS, emitDocCss } from "../src/render/css";
import { CmsPage } from "../src/react/CmsPage";

/*
 * 0.9.0: one fixed base stylesheet instead of inline styles.
 *
 * Captured in the lab, a server-rendered page had browser-default margins on
 * every heading, paragraph and list stacked on top of the designed `gap`, and
 * its buttons were underlined links. The JS renderer hid this with inline
 * styles the PHP renderer cannot reproduce. Now both emit the same preamble,
 * every rule inside :where() so it has zero specificity and any style a node
 * sets wins, and elements carry data attributes instead of style objects.
 */

const mk = (id: string, parent: string | null, order: string, extra: Partial<Node> = {}): Node => ({
  id, type: extra.type ?? "section", parent, order, props: extra.props ?? {}, style: extra.style ?? { base: {} }, ...extra,
});
const docWith = (...nodes: Node[]): PageDoc => nodes.reduce((d, node) => reduce(d, { t: "insert_node", node }), emptyDoc("p"));
const html = (doc: PageDoc) => renderToStaticMarkup(<CmsPage doc={doc} includeStyles={false} />);

describe("the base stylesheet", () => {
  it("comes first in every emitted stylesheet", () => {
    expect(emitDocCss(docWith(mk("s", null, "a")))).toMatch(/^\/\* fancy-cms base \*\//);
    expect(emitDocCss(docWith(mk("s", null, "a"))).startsWith(BASE_CSS)).toBe(true);
  });

  it("puts every rule inside :where(), so a node's own style always wins", () => {
    const selectors = BASE_CSS.split("\n").filter((l) => l.trim().endsWith("{")).map((l) => l.trim());
    expect(selectors.length).toBeGreaterThan(0);
    for (const s of selectors) expect(s.startsWith(":where(")).toBe(true);
  });

  it("resets the margins of headings, paragraphs and lists", () => {
    expect(BASE_CSS).toContain(":where(h1, h2, h3, h4, h5, h6, p, ul, ol)[data-cms]");
    expect(BASE_CSS).toMatch(/:where\(h1, h2, h3, h4, h5, h6, p, ul, ol\)\[data-cms\] \{\n {2}margin: 0;\n\}/);
  });

  it("styles buttons by data attribute, with no underline, themed by token", () => {
    expect(BASE_CSS).toContain("text-decoration: none;");
    expect(BASE_CSS).toContain("var(--cms-color-primary, #7c3aed)");
  });
});

describe("elements carry data attributes, not inline styles", () => {
  it("a button is ONE element: the link itself, with its variant as an attribute", () => {
    const out = html(docWith(mk("b", null, "a", { type: "button", props: { label: "Go", href: "/go", variant: "outline" } })));
    expect(out).toBe('<a data-cms="b" href="/go" data-cms-button="outline">Go</a>');
  });

  it("a button with no variant is primary", () => {
    expect(html(docWith(mk("b", null, "a", { type: "button", props: { label: "Go", href: "/go" } })))).toContain('data-cms-button="primary"');
  });

  it("an unknown variant falls back to primary rather than being trusted", () => {
    expect(html(docWith(mk("b", null, "a", { type: "button", props: { label: "Go", href: "/go", variant: "x\" onclick=\"y" } })))).toContain('data-cms-button="primary"');
  });

  it("an image's fit is an attribute the stylesheet reads", () => {
    const out = html(docWith(mk("i", null, "a", { type: "image", props: { src: "/a.jpg", alt: "A", fit: "contain" } })));
    expect(out).toBe('<div data-cms="i"><img src="/a.jpg" alt="A" loading="lazy" data-cms-fit="contain"/></div>');
  });

  it("a callout carries its tone; divider and code have no inline style", () => {
    const out = html(docWith(
      mk("c", null, "a", { type: "callout", props: { content: "Heads up", variant: "warning" } }),
      mk("d", null, "b", { type: "divider" }),
      mk("k", null, "c", { type: "code", props: { content: "x = 1" } }),
    ));
    expect(out).toContain('<div data-cms="c" data-cms-callout="warning">Heads up</div>');
    expect(out).toContain('<div data-cms="d"><hr/></div>');
    expect(out).toContain('<div data-cms="k"><pre><code>x = 1</code></pre></div>');
    expect(out).not.toContain("style=");
  });
});
