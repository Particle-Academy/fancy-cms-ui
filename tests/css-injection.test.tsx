import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDoc, type Node, type PageDoc } from "../src/document/types";
import { reduce } from "../src/document/reduce";
import { emitDocCss } from "../src/render/css";
import { CmsPage } from "../src/react/CmsPage";

/*
 * The stylesheet is emitted inline, inside <style>. Two routes into it carried
 * raw strings: the node id, interpolated into `[data-cms="<id>"]`, and the
 * enum and unit fields (align, justify, direction, a Length's unit), which
 * bypassed `safeCssValue`. Ids and styles come from ops an agent writes. Found
 * by the PHP port's source review.
 */

const mk = (id: string, extra: Partial<Node> = {}): Node => ({ id, type: "section", parent: null, order: "a0", props: {}, style: { base: { color: "#111111" } }, ...extra });
const one = (node: Node): PageDoc => reduce(emptyDoc("p"), { t: "insert_node", node });

describe("node ids in selectors", () => {
  it("an id cannot close the inline stylesheet", () => {
    const html = renderToStaticMarkup(<CmsPage doc={one(mk('x"]</style><script>alert(1)</script>'))} />);
    expect(html).not.toContain("<script>");
    expect(html).not.toMatch(/<\/style>[\s\S]*<\/style>/);
  });

  it("quotes, backslashes and newlines are escaped, and the selector still matches the attribute", () => {
    const css = emitDocCss(one(mk('a"b\\c\nd<e')));
    expect(css).toContain('[data-cms="a\\"b\\\\c\\a d\\3c e"]');
  });

  it("an ordinary id is emitted unchanged", () => {
    expect(emitDocCss(one(mk("hero-1")))).toContain('[data-cms="hero-1"]');
  });
});

describe("enum and unit fields", () => {
  const cssOf = (style: Record<string, unknown>, layout?: Node["layout"]) => emitDocCss(one(mk("n", { layout, style: { base: style as never } })));

  it("an unknown align or justify is dropped, not passed through", () => {
    const css = cssOf({ align: "center;} body{display:none", justify: "x</style>" }, "stack");
    expect(css).not.toContain("display:none");
    expect(css).not.toContain("</style>");
    expect(css).not.toContain("align-items");
    expect(css).not.toContain("justify-content");
  });

  it("an unknown direction falls back to the default", () => {
    const css = cssOf({ direction: "row;} *{color:red" }, "stack");
    expect(css).toContain("flex-direction: column;");
    expect(css).not.toContain("color:red");
  });

  it("a Length with an unknown unit or a non-finite value is dropped", () => {
    const css = cssOf({ padding: { value: 4, unit: "px;}*{x:y" }, margin: { value: Number.NaN, unit: "px" }, gap: { value: 8, unit: "px" } });
    expect(css).not.toContain("x:y");
    expect(css).not.toContain("padding:");
    expect(css).not.toContain("NaN");
    expect(css).toContain("gap: 8px;");
  });

  it("a known alignment still maps as before", () => {
    expect(cssOf({ align: "center", justify: "between" }, "stack")).toContain("justify-content: space-between;");
  });
});
