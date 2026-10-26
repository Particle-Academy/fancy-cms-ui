import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDoc, type Node, type PageDoc } from "../src/document/types";
import { CmsPage } from "../src/react/CmsPage";
import { defaultRegistry } from "../src/react/registry";
import { BASE_CSS } from "../src/render/css";
import icons from "../icons/all.js";

describe("CSP native renderer contract", () => {
  it("renders every native node type without generated inline styles", () => {
    const types = ["section", "stack", "grid", "frame", "shape", "card", "text", "heading", "richtext", "link", "list", "divider", "callout", "code", "button", "image", "repeater", "icon"];
    expect([...Object.keys(defaultRegistry), "repeater"].sort()).toEqual([...types].sort());
    const doc: PageDoc = emptyDoc("csp-native-types");
    for (const type of types) {
      const props: Node["props"] = type === "icon" ? { name: "receipt-text", decorative: true }
        : type === "richtext" ? { html: "<strong>Authored text without inline CSS</strong>" }
          : type === "image" ? { alt: "Empty image placeholder" }
            : ["list", "repeater"].includes(type) ? { items: ["One", "Two"] } : { content: `Sample ${type}` };
      doc.nodes[type] = { id: type, type, parent: null, order: type, props, style: { base: { fontSize: { value: 24, unit: "px" }, color: "#125678" } } };
    }
    const html = renderToStaticMarkup(<CmsPage doc={doc} icons={icons} />);
    for (const type of types) expect(html).toContain(`data-cms="${type}"`);
    expect(html).toContain('data-react-fancy-icon=""');
    expect(html).not.toMatch(/\sstyle\s*=/i);
    expect(html).toContain("font-size: 24px;");
  });

  it("moves the complete fixed icon wrapper style into the shared base stylesheet", () => {
    expect(BASE_CSS).toContain(":where([data-react-fancy-icon]) {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  flex-shrink: 0;\n  width: 1em;\n  height: 1em;\n  vertical-align: middle;\n}");
  });
});
