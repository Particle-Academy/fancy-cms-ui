import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDoc, type Node, type PageDoc, type StyleProps } from "../src/document/types";
import { reduce } from "../src/document/reduce";
import { emitDocCss } from "../src/render/css";
import { CmsPage } from "../src/react/CmsPage";

/*
 * What a professional landing page needs from the renderer (0.8.0). Found by
 * mapping the stack for the lab's website-builder agent: headings rendered as
 * plain divs, a button with an href linked nowhere, and a grid could not go
 * from one column on a phone to three on a desktop, because `direction` and
 * `columns` were read from `base` only.
 */

function mk(id: string, parent: string | null, order: string, extra: Partial<Node> = {}): Node {
  return { id, type: extra.type ?? "section", parent, order, props: extra.props ?? {}, style: extra.style ?? { base: {} }, ...extra };
}

function docWith(...nodes: Node[]): PageDoc {
  let doc = emptyDoc("p");
  for (const node of nodes) doc = reduce(doc, { t: "insert_node", node });
  return doc;
}

const html = (doc: PageDoc) => renderToStaticMarkup(<CmsPage doc={doc} includeStyles={false} />);

describe("responsive layout", () => {
  it("a grid's column count can change per breakpoint", () => {
    const doc = docWith(mk("g", null, "a", { type: "grid", layout: "grid", style: { base: { columns: 1 }, md: { columns: 2 }, lg: { columns: 3 } } }));
    const css = emitDocCss(doc);
    expect(css).toContain('[data-cms="g"] {\n  display: grid;\n  grid-template-columns: repeat(1, 1fr);\n}');
    expect(css).toContain('@media (min-width: 768px) {\n  [data-cms="g"] {\n    grid-template-columns: repeat(2, 1fr);\n  }\n}');
    expect(css).toContain('@media (min-width: 1024px) {\n  [data-cms="g"] {\n    grid-template-columns: repeat(3, 1fr);\n  }\n}');
  });

  it("a stack's direction can change per breakpoint", () => {
    const doc = docWith(mk("s", null, "a", { type: "stack", layout: "stack", style: { base: { direction: "column" }, md: { direction: "row" } } }));
    const css = emitDocCss(doc);
    expect(css).toContain("flex-direction: column;");
    expect(css).toContain('@media (min-width: 768px) {\n  [data-cms="s"] {\n    flex-direction: row;\n  }\n}');
  });

  it("an auto-fit grid needs no breakpoints: columnMin sets the narrowest column", () => {
    const doc = docWith(mk("g", null, "a", { type: "grid", layout: "grid", style: { base: { columnMin: { value: 240, unit: "px" } } } }));
    expect(emitDocCss(doc)).toContain("grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));");
  });

  it("a stack can wrap", () => {
    const doc = docWith(mk("s", null, "a", { type: "stack", layout: "stack", style: { base: { direction: "row", wrap: true } } }));
    expect(emitDocCss(doc)).toContain("flex-wrap: wrap;");
  });

  it("a node can be hidden at one breakpoint and shown at another", () => {
    const doc = docWith(mk("n", null, "a", { style: { base: { hidden: true }, md: { hidden: false } } }));
    const css = emitDocCss(doc);
    expect(css).toContain('[data-cms="n"] {\n  display: none;\n}');
    // Shown again from md up: the layout's own display, or block.
    expect(css).toContain('@media (min-width: 768px) {\n  [data-cms="n"] {\n    display: block;\n  }\n}');
  });

  it("shown again, a stack gets back flex, not block", () => {
    const doc = docWith(mk("n", null, "a", { type: "stack", layout: "stack", style: { base: { hidden: true }, md: { hidden: false } } }));
    expect(emitDocCss(doc)).toContain('@media (min-width: 768px) {\n  [data-cms="n"] {\n    display: flex;\n  }\n}');
  });
});

describe("box, size and position", () => {
  const css = (style: Partial<StyleProps>) => emitDocCss(docWith(mk("n", null, "a", { style: { base: style } })));

  it("per-axis padding and margin, and a centred container", () => {
    const out = css({ paddingX: { value: 24, unit: "px" }, paddingY: { value: 96, unit: "px" }, marginX: "auto", maxWidth: { value: 1120, unit: "px" } });
    expect(out).toContain("padding-left: 24px;");
    expect(out).toContain("padding-right: 24px;");
    expect(out).toContain("padding-top: 96px;");
    expect(out).toContain("padding-bottom: 96px;");
    expect(out).toContain("margin-left: auto;");
    expect(out).toContain("margin-right: auto;");
    expect(out).toContain("max-width: 1120px;");
  });

  it("a per-axis value overrides the shorthand, because it sorts after it", () => {
    const out = css({ padding: { value: 8, unit: "px" }, paddingX: { value: 24, unit: "px" } });
    expect(out.indexOf("padding: 8px;")).toBeLessThan(out.indexOf("padding-left: 24px;"));
  });

  it("min height, sticky, z-index, overflow", () => {
    const out = css({ minHeight: { value: 80, unit: "vh" }, sticky: true, zIndex: 10, overflow: "hidden" });
    expect(out).toContain("min-height: 80vh;");
    expect(out).toContain("position: sticky;");
    expect(out).toContain("top: 0;");
    expect(out).toContain("z-index: 10;");
    expect(out).toContain("overflow: hidden;");
  });

  it("text transform, background size and position, aspect ratio", () => {
    const out = css({ textTransform: "uppercase", backgroundSize: "cover", backgroundPosition: "center", aspectRatio: "16 / 9" });
    expect(out).toContain("text-transform: uppercase;");
    expect(out).toContain("background-size: cover;");
    expect(out).toContain("background-position: center;");
    expect(out).toContain("aspect-ratio: 16 / 9;");
  });

  it("an unknown style key emits nothing rather than raw CSS", () => {
    const out = css({ ["behavior" as keyof StyleProps]: "url(x.htc)" } as Partial<StyleProps>);
    expect(out).not.toContain("behavior");
  });
});

describe("theme tokens", () => {
  it("are emitted as --cms-* custom properties, nested keys joined with a dash", () => {
    let doc = emptyDoc("p");
    doc = reduce(doc, { t: "set_theme", patch: { color: { primary: "#1d4ed8", ink: "#0f172a" }, font: { body: "Inter, sans-serif" }, radius: 12 } });
    const out = emitDocCss(doc);
    expect(out).toContain(":root {\n  --cms-color-ink: #0f172a;\n  --cms-color-primary: #1d4ed8;\n  --cms-font-body: Inter, sans-serif;\n  --cms-radius: 12;\n}");
    // `name` labels the theme; it is not a token.
    expect(out).not.toContain("--cms-name");
  });

  it("a token value cannot break out of its declaration", () => {
    let doc = emptyDoc("p");
    doc = reduce(doc, { t: "set_theme", patch: { color: { bad: "red; } body { display: none" } } });
    expect(emitDocCss(doc)).not.toContain("display: none");
  });
});

describe("semantic elements", () => {
  it("a heading is a real h1-h6 element, level 2 by default", () => {
    const out = html(docWith(mk("h", null, "a", { type: "heading", props: { content: "Pricing", level: 1 } }), mk("h2", null, "b", { type: "heading", props: { content: "Plans" } })));
    expect(out).toContain('<h1 data-cms="h">Pricing</h1>');
    expect(out).toContain('<h2 data-cms="h2">Plans</h2>');
  });

  it("an out-of-range level falls back to 2, never an invalid tag", () => {
    const out = html(docWith(mk("h", null, "a", { type: "heading", props: { content: "X", level: 9 } })));
    expect(out).toContain('<h2 data-cms="h">');
  });

  it("text is a paragraph", () => {
    expect(html(docWith(mk("t", null, "a", { type: "text", props: { content: "Hello" } })))).toContain('<p data-cms="t">Hello</p>');
  });

  it("a container can be a landmark: header, nav, main, footer, section, article, aside", () => {
    const out = html(docWith(mk("hd", null, "a", { type: "stack", props: { as: "header" } }), mk("ft", null, "b", { type: "section", props: { as: "footer" } })));
    expect(out).toContain('<header data-cms="hd">');
    expect(out).toContain('<footer data-cms="ft">');
  });

  it("an unknown `as` is ignored, not trusted as a tag name", () => {
    const out = html(docWith(mk("x", null, "a", { type: "stack", props: { as: "script" } })));
    expect(out).not.toContain("<script");
    expect(out).toContain('<div data-cms="x">');
  });

  it("a section is a <section> by default", () => {
    expect(html(docWith(mk("s", null, "a")))).toContain('<section data-cms="s">');
  });

  it("a button with an href IS a link: the whole button is clickable and focusable", () => {
    const out = html(docWith(mk("b", null, "a", { type: "button", props: { label: "Start free", href: "/signup" } })));
    expect(out).toMatch(/<a data-cms="b" href="\/signup"[^>]*>/);
    expect(out).toContain("Start free");
  });

  it("an external link opens safely", () => {
    const out = html(docWith(mk("b", null, "a", { type: "link", props: { content: "Docs", href: "https://example.com/docs" } })));
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("a javascript: href is dropped, never rendered", () => {
    const out = html(docWith(mk("b", null, "a", { type: "button", props: { label: "Go", href: "javascript:alert(1)" } })));
    expect(out).not.toContain("javascript:");
  });

  it("a list block renders ul, or ol when ordered", () => {
    const out = html(docWith(mk("l", null, "a", { type: "list", props: { items: ["Fast", "Private"] } }), mk("o", null, "b", { type: "list", props: { items: ["Sign up", "Invite"], ordered: true } })));
    expect(out).toContain('<ul data-cms="l"><li>Fast</li><li>Private</li></ul>');
    expect(out).toContain('<ol data-cms="o"><li>Sign up</li><li>Invite</li></ol>');
  });

  it("an image takes its fit from props, and keeps its alt", () => {
    const out = html(docWith(mk("i", null, "a", { type: "image", props: { src: "/team.jpg", alt: "The team", fit: "contain" } })));
    expect(out).toContain('alt="The team"');
    expect(out).toContain("object-fit:contain");
  });
});
