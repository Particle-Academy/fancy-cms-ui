import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { iconNames, searchIcons, validIconProps } from "../src/document/icons";
import { emptyDoc } from "../src/document/types";
import { CmsPage } from "../src/react/CmsPage";
import { CmsRegion } from "../src/react/CmsRegion";
import { RenderNode } from "../src/react/RenderNode";
import allIcons from "../icons/all.js";
import { loadIcons } from "../icons/index.js";
import fileText from "@particle-academy/fancy-cms-ui/icons/file-text";

describe("full Fancy Lucide catalogue", () => {
  it("covers every published name and alias, with a synchronous host-supplied glyph set", () => {
    expect(iconNames()).toHaveLength(1803);
    expect(iconNames()).toEqual([...iconNames()].sort());
    expect(allIcons.home).toEqual(allIcons.house);
    const doc = emptyDoc("all-icons");
    for (const [index, name] of iconNames().entries()) {
      const props = { name, decorative: true };
      expect(validIconProps(props), name).toBe(true);
      const id = `icon-${index}`;
      doc.nodes[id] = { id, type: "icon", parent: null, order: String(index), props, style: { base: {} } };
    }
    const html = renderToStaticMarkup(<CmsPage doc={doc} icons={allIcons} includeStyles={false} />);
    expect(html.match(/<svg /g)).toHaveLength(1803);
    expect(html).not.toContain('role="img"');
  });
  it("preloads selected names outside rendering and produces the same markup at every entry", async () => {
    const icons = await loadIcons(["file-text", "home", "house"]);
    expect(Object.keys(icons).sort()).toEqual(["file-text", "home", "house"]);
    expect(icons["file-text"]).toEqual(fileText);
    expect(icons.home).toBe(icons.house);
    await expect(loadIcons(["../file-text"])).rejects.toThrow();
    await expect(loadIcons(["__proto__"])).rejects.toThrow();
    const doc = emptyDoc("p");
    doc.nodes.icon = { id: "icon", type: "icon", parent: null, order: "V", props: { name: "file-text", decorative: true }, style: { base: {} } };
    const page = renderToStaticMarkup(<CmsPage doc={doc} icons={icons} includeStyles={false} />);
    expect(page).toContain("<svg");
    expect(renderToStaticMarkup(<CmsRegion doc={doc} root="icon" icons={icons} includeStyles={false} />)).toBe(page);
    expect(renderToStaticMarkup(<RenderNode doc={doc} id="icon" icons={icons} />)).toBe(page);
    expect(renderToStaticMarkup(<CmsPage doc={doc} includeStyles={false} />)).not.toContain("<svg");
    expect(renderToStaticMarkup(<CmsPage doc={doc} icons={Object.create({ "file-text": fileText })} includeStyles={false} />)).not.toContain("<svg");
  });
  it("offers bounded deterministic search and complete pagination instead of a prompt dump", () => {
    expect(searchIcons("FILE text", 0)).toEqual({ source: "lucide-react@0.511.0", names: ["file-text"], total: 1, nextCursor: null });
    const seen: string[] = [];
    let cursor: number | null = 0;
    do {
      const page = searchIcons("", cursor);
      expect(page.names.length).toBeLessThanOrEqual(20);
      seen.push(...page.names);
      cursor = page.nextCursor;
    } while (cursor !== null);
    expect(seen).toEqual(iconNames());
    expect(searchIcons("not-an-icon-name", 0).names).toEqual([]);
    expect(searchIcons("", 100000).names).toEqual([]);
    for (const [query, cursor] of [["<svg>", 0], ["é", 0], ["file\n", 0], ["a".repeat(129), 0], ["file", -1], ["file", 0.5], ["file", Infinity]] as const) expect(() => searchIcons(query, cursor)).toThrow("Invalid icon search.");
  });
});
