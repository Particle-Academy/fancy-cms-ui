/**
 * Page inputs' half of the PHP/React parity spec.
 *
 * `tests/fixtures/inputs.json` is byte-identical in particle-academy/fancy-cms,
 * whose suite renders the same cases through PageRenderer, parses the same
 * query strings through PageInputs and must produce the same results.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { CmsPage } from "../src/react/CmsPage";
import { BASE_CSS, emitDocCss } from "../src/render/css";
import { INPUT_CSS, inputsFromQuery, inputsToQuery, pageInputs } from "../src/render/inputs";
import { styleTagHtml } from "../src/render/style-tag";
import { dataRequests } from "../src/document/data";
import { BUILTIN_ISLAND_CATALOGUE } from "../src/islands/catalogue";
import type { Node, PageDoc } from "../src/document/types";

interface Case {
  name: string;
  nodes: Node[];
  data: Record<string, unknown>;
  inputs: Record<string, unknown>;
  html: string;
}
interface Fixture {
  css: string;
  cases: Case[];
  query: {
    nodes: Node[];
    data: Record<string, unknown>;
    declared: unknown[];
    cases: { name: string; search: string; values: Record<string, unknown>; encoded: string }[];
    requests: unknown[];
  };
  styleTag: { key: string; css: string; html: string };
}

const fixturePath = resolve(__dirname, "fixtures/inputs.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;

function doc(nodes: Node[]): PageDoc {
  return {
    id: "in",
    seq: 0,
    meta: { title: "Inputs", slug: "/", scrollMode: "smooth" },
    theme: { name: "default" },
    breakpoints: ["base", "md", "lg"],
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
  };
}

describe("input nodes render the shared parity spec", () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const html = renderToStaticMarkup(<CmsPage doc={doc(c.nodes)} data={c.data} inputs={c.inputs} includeStyles={false} />);
    expect(html).toBe(c.html);
  });

  it("covers every kind", () => {
    for (const kind of ["period", "daterange", "person", "select", "multiselect"]) {
      expect(fixture.cases.some((c) => c.html.includes(`data-cms-input="${kind}"`)), kind).toBe(true);
    }
  });
});

describe("input values in the data request", () => {
  const page = doc(fixture.query.nodes);
  it("declares each named input once, ordered by node id", () => {
    expect(pageInputs(page)).toEqual(fixture.query.declared);
  });

  it.each(fixture.query.cases.map((c) => [c.name, c] as const))("query: %s", (_name, c) => {
    expect(inputsFromQuery(page, c.search, fixture.query.data)).toEqual(c.values);
    expect(inputsFromQuery(page, new URLSearchParams(c.search), fixture.query.data)).toEqual(c.values);
    expect(inputsToQuery(page, c.values, fixture.query.data)).toBe(c.encoded);
  });

  it("lists a bound option list as a data request with the shape it expects", () => {
    expect(dataRequests(page).filter((r) => r.node === "r")).toEqual(fixture.query.requests);
  });

  it("is in the catalogue an agent reads, with hydrate lazy", () => {
    expect(BUILTIN_ISLAND_CATALOGUE.types.input?.hydrate).toBe("lazy");
    expect(BUILTIN_ISLAND_CATALOGUE.types.input?.props.required).toEqual(["name", "kind"]);
  });
});

describe("input stylesheet", () => {
  it("is the shared block, byte for byte", () => {
    expect(INPUT_CSS).toBe(fixture.css);
    expect(INPUT_CSS).not.toMatch(/[\\`]/);
  });

  it("is emitted after the base only for documents that place an input", () => {
    expect(emitDocCss(doc(fixture.cases[0]!.nodes))).toBe(`${BASE_CSS}\n\n${INPUT_CSS}\n`);
    expect(emitDocCss(doc([{ id: "t", type: "text", parent: null, order: "a", props: { content: "x" }, style: { base: {} } }]))).not.toContain("fancy-cms inputs");
  });
});

describe("the head style element", () => {
  it("is the shared bytes", () => {
    expect(styleTagHtml(fixture.styleTag.key, fixture.styleTag.css)).toBe(fixture.styleTag.html);
  });
});

describe("cross-repo mirror", () => {
  it("matches the PHP copy when the sibling is checked out", () => {
    const theirs = resolve(__dirname, "../../fancy-cms/tests/fixtures/inputs.json");
    if (!existsSync(theirs)) return;
    expect(readFileSync(fixturePath, "utf8")).toBe(readFileSync(theirs, "utf8"));
  });
});
