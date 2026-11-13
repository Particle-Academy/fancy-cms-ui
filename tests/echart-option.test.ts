/**
 * The echart node's option validator. tests/fixtures/echart-options.json is
 * byte-identical in particle-academy/fancy-cms, whose EchartOption must return
 * the same paths, so the two validators cannot disagree about what is safe.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { echartModel, echartRenderOption, resolveDeep, validateEchartOption } from "../src/islands/echart-option";

const fixturePath = resolve(__dirname, "fixtures/echart-options.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { cases: { name: string; option: unknown; errors: string[] }[] };

describe("validateEchartOption", () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(validateEchartOption(c.option)).toEqual(c.errors);
  });

  it("refuses a binding once the option is resolved", () => {
    expect(validateEchartOption({ series: [{ type: "bar", data: { $bind: "a" } }] }, { bindings: false })).toEqual(["$.series[0].data"]);
  });

  it("validates again after resolution, so bound host data cannot smuggle markup in", () => {
    const option = { series: [{ type: "bar", name: { $bind: "label" }, data: [1] }] };
    expect(validateEchartOption(option)).toEqual([]);
    const resolved = resolveDeep(option, (p) => (p === "label" ? "<b>x</b>" : undefined));
    expect(validateEchartOption(resolved, { bindings: false })).toEqual(["$.series[0].name"]);
  });

  it("the PHP copy of the fixture is identical when the sibling is checked out", () => {
    const theirs = resolve(__dirname, "../../fancy-cms/tests/fixtures/echart-options.json");
    if (!existsSync(theirs)) return;
    expect(readFileSync(fixturePath, "utf8")).toBe(readFileSync(theirs, "utf8"));
  });
});

describe("echartRenderOption", () => {
  const theme = { colors: ["#111111"], text: "#222222", rule: "#333333" };
  it("forces rich-text tooltips, confines them, and turns off the aria layer", () => {
    const out = echartRenderOption({ tooltip: { trigger: "item" }, series: [] }, theme, false);
    expect(out.tooltip).toEqual({ trigger: "item", renderMode: "richText", confine: true });
    expect(out.aria).toEqual({ enabled: false });
    expect(out.color).toEqual(["#111111"]);
  });
  it("keeps the author's colours and drops animation under reduced motion", () => {
    const out = echartRenderOption({ color: ["#abcdef"], series: [] }, theme, true);
    expect(out.color).toEqual(["#abcdef"]);
    expect(out.animation).toBe(false);
  });
});

describe("echartModel", () => {
  it("clamps the height and reads title and summary as text", () => {
    expect(echartModel({ title: "T", summary: "S", height: 5000 })).toMatchObject({ title: "T", summary: "S", height: 800 });
    expect(echartModel({}).height).toBe(320);
  });
});
