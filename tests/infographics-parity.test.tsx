/**
 * The infographic node kit's half of the PHP/React parity spec.
 *
 * `tests/fixtures/infographics.json` is byte-identical in particle-academy/fancy-cms,
 * whose suite renders the same cases through PageRenderer and must produce the
 * same `html`. So a case passing here AND there is the two renderers agreeing,
 * without either suite needing the other checked out. When the sibling IS
 * checked out, the bytes are compared directly, so the two copies cannot drift.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { CmsPage } from "../src/react/CmsPage";
import { emitDocCss, BASE_CSS } from "../src/render/css";
import { INFOGRAPHIC_CSS } from "../src/render/infographics";
import { dataRequests } from "../src/document/data";
import { BUILTIN_ISLAND_CATALOGUE } from "../src/islands/catalogue";
import type { Node, PageDoc } from "../src/document/types";

interface Case {
  name: string;
  nodes: Node[];
  data: Record<string, unknown>;
  html: string;
}
interface Fixture {
  css: string;
  cases: Case[];
  requests: { nodes: Node[]; expected: unknown[] };
}

const fixturePath = resolve(__dirname, "fixtures/infographics.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;

function doc(nodes: Node[]): PageDoc {
  return {
    id: "ig",
    seq: 0,
    meta: { title: "Infographics", slug: "/", scrollMode: "smooth" },
    theme: { name: "default" },
    breakpoints: ["base", "md", "lg"],
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
  };
}

describe("infographic nodes render the shared parity spec", () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const html = renderToStaticMarkup(<CmsPage doc={doc(c.nodes)} data={c.data} includeStyles={false} />);
    expect(html).toBe(c.html);
  });

  it("covers every infographic type with bound, empty and malformed data", () => {
    for (const type of ["chart", "kpi", "table", "leaderboard"]) {
      const cases = fixture.cases.filter((c) => c.nodes[0]!.type === type);
      expect(cases.some((c) => /missing/.test(c.name)), `${type} missing`).toBe(true);
      expect(cases.some((c) => /malformed|empty|no numeric/.test(c.name)), `${type} malformed`).toBe(true);
      expect(cases.some((c) => !c.html.includes("data-cms-empty")), `${type} bound`).toBe(true);
    }
  });
});

describe("infographic stylesheet", () => {
  it("is the shared block, byte for byte", () => {
    expect(INFOGRAPHIC_CSS).toBe(fixture.css);
  });

  it("is emitted after the base only for documents that use an infographic node", () => {
    const withKpi = emitDocCss(doc(fixture.cases[0]!.nodes));
    expect(withKpi).toBe(`${BASE_CSS}\n\n${INFOGRAPHIC_CSS}\n`);
    const plain = emitDocCss(doc([{ id: "p", type: "text", parent: null, order: "a", props: { content: "x" }, style: { base: {} } }]));
    expect(plain).not.toContain("fancy-cms infographics");
  });

  it("keeps the chart's screen-reader table 1px wide: its rule follows the chart table's 100% width", () => {
    // Both rules are :where() (no specificity), so the later one wins. With the
    // width:100% rule last, the visually hidden table spanned the viewport from
    // its absolute position and scrolled every phone page sideways (kit site,
    // report-dashboard-kit-v1, 375 px: scrollWidth 394).
    const tableWidth = INFOGRAPHIC_CSS.indexOf(":where([data-cms-table] table, figure[data-cms-chart] table)");
    const srWidth = INFOGRAPHIC_CSS.indexOf(":where(figure[data-cms-chart] table[data-cms-sr])");
    expect(tableWidth).toBeGreaterThan(-1);
    expect(srWidth).toBeGreaterThan(tableWidth);
    expect(INFOGRAPHIC_CSS.slice(srWidth, INFOGRAPHIC_CSS.indexOf("}", srWidth))).toContain("width: 1px;");
  });

  it("uses theme tokens and covers dark mode and print", () => {
    expect(INFOGRAPHIC_CSS).toContain("var(--cms-color-primary");
    expect(INFOGRAPHIC_CSS).toContain(':where(.dark, [data-theme="dark"])');
    expect(INFOGRAPHIC_CSS).toContain("@media print");
    expect(INFOGRAPHIC_CSS).not.toMatch(/[\\`]/);
  });
});

describe("data requests (the seam phase 2 page inputs will fill)", () => {
  it("lists every bound path with the literal shape the node expects", () => {
    expect(dataRequests(doc(fixture.requests.nodes))).toEqual(fixture.requests.expected);
  });
});

describe("cross-repo mirrors", () => {
  const sibling = resolve(__dirname, "../../fancy-cms");
  const pairs: [string, string][] = [
    [fixturePath, resolve(sibling, "tests/fixtures/infographics.json")],
    [resolve(__dirname, "../src/islands/catalogue.json"), resolve(sibling, "resources/islands/catalogue.json")],
  ];
  it.each(pairs)("%s matches the PHP copy when the sibling is checked out", (mine, theirs) => {
    if (!existsSync(theirs)) return;
    expect(readFileSync(mine, "utf8")).toBe(readFileSync(theirs, "utf8"));
  });

  it("the built-in catalogue is the shipped JSON", () => {
    const shipped = JSON.parse(readFileSync(resolve(__dirname, "../src/islands/catalogue.json"), "utf8"));
    expect(BUILTIN_ISLAND_CATALOGUE).toEqual(shipped);
  });
});
