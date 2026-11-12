// @vitest-environment jsdom
/**
 * The lazily loaded chart canvas. `@particle-academy/fancy-echarts` is aliased to
 * tests/stubs/fancy-echarts.tsx in vitest.config.ts: this package does not
 * install it (it is an optional peer, and installing it would pull echarts into
 * the dev tree), so these tests pin the option we hand it and the registration
 * call, not echarts' own drawing.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { chartOption, type ChartPalette } from "../src/islands/chart-option";
import { chartModel } from "../src/render/infographics";
import ChartCanvas from "../src/islands/chart";
import { stub } from "./stubs/fancy-echarts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const palette: ChartPalette = { colors: ["#111111", "#222222"], text: "rgb(10, 20, 30)", rule: "rgba(10, 20, 30, 0.2)" };
const props = (kind: string, extra: Record<string, unknown> = {}) => ({ kind, categories: ["A", "B", "C"], series: [{ name: "One", data: [3, null, 1] }, { name: "Two", data: [1, 2, 3] }], ...extra });

type Opt = Record<string, any>;

describe("chartOption", () => {
  it("column: categories on x, a bar series per series, theme colours", () => {
    const o = chartOption(chartModel(props("column")), palette, false) as Opt;
    expect(o.xAxis.type).toBe("category");
    expect(o.xAxis.data).toEqual(["A", "B", "C"]);
    expect(o.yAxis.type).toBe("value");
    expect(o.series.map((s: Opt) => [s.type, s.name, s.data])).toEqual([["bar", "One", [3, null, 1]], ["bar", "Two", [1, 2, 3]]]);
    expect(o.color).toEqual(["#111111", "#222222"]);
    expect(o.textStyle.color).toBe("rgb(10, 20, 30)");
    expect(o.legend).toBeDefined();
  });

  it("bar is horizontal and line draws lines", () => {
    const bar = chartOption(chartModel(props("bar")), palette, false) as Opt;
    expect(bar.yAxis.type).toBe("category");
    expect(bar.xAxis.type).toBe("value");
    expect((chartOption(chartModel(props("line")), palette, false) as Opt).series[0].type).toBe("line");
  });

  it("pie and funnel take the first series as name/value pairs, without nulls", () => {
    const pie = chartOption(chartModel(props("pie")), palette, false) as Opt;
    expect(pie.xAxis).toBeUndefined();
    expect(pie.series).toHaveLength(1);
    expect(pie.series[0].type).toBe("pie");
    expect(pie.series[0].data).toEqual([{ name: "A", value: 3 }, { name: "C", value: 1 }]);
    const funnel = chartOption(chartModel(props("funnel")), palette, false) as Opt;
    expect(funnel.series[0].type).toBe("funnel");
    expect(funnel.series[0].sort).toBe("descending");
  });

  it("formats tooltips and the value axis like the table, and honours reduced motion", () => {
    const o = chartOption(chartModel(props("column", { format: "currency" })), palette, true) as Opt;
    expect(o.tooltip.valueFormatter(1234.5)).toBe("$1,234.50");
    expect(o.yAxis.axisLabel.formatter(1000)).toBe("$1,000.00");
    expect(o.animation).toBe(false);
    expect(o.aria).toEqual({ enabled: false });
  });
});

describe("ChartCanvas", () => {
  let container: HTMLElement;
  let root: Root;
  beforeEach(() => { container = document.createElement("figure"); container.setAttribute("data-cms-chart", "column"); container.style.setProperty("--cms-chart-1", "#abcdef"); container.style.color = "rgb(1, 2, 3)"; document.body.appendChild(container); root = createRoot(container); stub.reset(); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  it("registers echarts' modules once, reads theme tokens off the figure, and renders as SVG", async () => {
    const node = { id: "c", type: "chart", parent: null, order: "a", props: {}, style: { base: {} } };
    await act(async () => root.render(<div><ChartCanvas props={props("column")} node={node} /></div>));
    await act(async () => root.render(<div><ChartCanvas props={props("line")} node={node} /></div>));
    expect(stub.registerAllCalls).toBe(1);
    const last = stub.renders.at(-1)!;
    expect(last.renderer).toBe("svg");
    expect((last.option as Opt).color[0]).toBe("#abcdef");
    expect((last.option as Opt).textStyle.color).toBe("rgb(1, 2, 3)");
    expect((last.option as Opt).series[0].type).toBe("line");
  });
});
