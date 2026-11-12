/**
 * The bindings Charlotte writes: fancy-cms's `{ $bind, $source? }` plus
 * `$params`, `$scope` and `<stream>#<alias>`, with `{ "$input" }` references
 * fed by page inputs. `tests/fixtures/data-queries.json` is byte-identical in
 * particle-academy/fancy-cms, whose DataRequests::queries() must return the
 * same queries.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dataQueries, dataRequests } from "../src/document/data";
import { getPath } from "../src/react/registry";
import type { Node, PageDoc } from "../src/document/types";

const fixturePath = resolve(__dirname, "fixtures/data-queries.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  nodes: Node[];
  data: Record<string, unknown>;
  request: unknown;
  cases: { name: string; inputs: Record<string, unknown>; queries: unknown[] }[];
};
const doc: PageDoc = {
  id: "q",
  seq: 0,
  meta: { title: "Q", slug: "/", scrollMode: "smooth" },
  theme: { name: "default" },
  breakpoints: ["base"],
  nodes: Object.fromEntries(fixture.nodes.map((n) => [n.id, n])),
};

describe("data queries", () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(dataQueries(doc, { inputs: c.inputs, data: fixture.data })).toEqual(c.queries);
  });

  it("a data request carries the binding's params and scope as written", () => {
    expect(dataRequests(doc).find((r) => r.node === "k1")).toEqual(fixture.request);
  });

  it("an aliased path resolves unchanged against the result the host put under its key", () => {
    expect(getPath({ "metrics#byStage": { columns: { stage: ["Won"] } } }, "metrics#byStage.columns.stage")).toEqual(["Won"]);
  });

  it("matches the PHP copy when the sibling is checked out", () => {
    const theirs = resolve(__dirname, "../../fancy-cms/tests/fixtures/data-queries.json");
    if (!existsSync(theirs)) return;
    expect(readFileSync(fixturePath, "utf8")).toBe(readFileSync(theirs, "utf8"));
  });
});
