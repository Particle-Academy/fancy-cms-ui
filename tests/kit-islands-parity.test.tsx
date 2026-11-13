/**
 * The kit islands' and the echart node's half of the PHP/React parity spec.
 * tests/fixtures/kit-islands.json is byte-identical in particle-academy/fancy-cms,
 * whose suite renders the same cases through PageRenderer with
 * IslandCatalogue::kit() and must produce the same `html`.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { CmsPage } from "../src/react/CmsPage";
import { defaultIslands, registerIslands } from "../src/react/islands";
import { kitIslands } from "../src/kit";
import type { Node, PageDoc } from "../src/document/types";

interface Case {
  name: string;
  nodes: Node[];
  data: Record<string, unknown>;
  html: string;
}
const fixturePath = resolve(__dirname, "fixtures/kit-islands.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { cases: Case[] };
const islands = registerIslands(defaultIslands, kitIslands);

function doc(nodes: Node[]): PageDoc {
  return {
    id: "kit",
    seq: 0,
    meta: { title: "Kit", slug: "/", scrollMode: "smooth" },
    theme: { name: "default" },
    breakpoints: ["base", "md", "lg"],
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
  } as unknown as PageDoc;
}

export function render(c: Case): string {
  return renderToStaticMarkup(<CmsPage doc={doc(c.nodes)} data={c.data} islands={islands} includeStyles={false} />);
}

describe("kit island server renders", () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(render(c)).toBe(c.html);
  });

  it("the PHP copy of the fixture is identical when the sibling is checked out", () => {
    const theirs = resolve(__dirname, "../../fancy-cms/tests/fixtures/kit-islands.json");
    if (!existsSync(theirs)) return;
    expect(readFileSync(fixturePath, "utf8")).toBe(readFileSync(theirs, "utf8"));
  });
});
