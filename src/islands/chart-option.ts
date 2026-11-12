/**
 * The ECharts option for a chart node. Pure, so it is tested without echarts.
 *
 * The canvas is decoration over the data table (it is `aria-hidden`; the table
 * is the accessible version), so ECharts' own aria layer is off rather than
 * announcing a second, different description of the same numbers.
 */
import type { ChartModel } from "../render/infographics";
import { formatNumber } from "../render/number-format";

export interface ChartPalette {
  /** Series colours, from `--cms-chart-1` … `--cms-chart-6` on the figure. */
  colors: string[];
  /** The figure's computed text colour. */
  text: string;
  /** Gridline colour: the text colour at low alpha. */
  rule: string;
}

export function chartOption(model: ChartModel, palette: ChartPalette, reducedMotion: boolean): Record<string, unknown> {
  const fmt = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? formatNumber(v, model.spec) : "");
  const base = {
    color: palette.colors,
    textStyle: { color: palette.text },
    animation: !reducedMotion,
    aria: { enabled: false },
    tooltip: { trigger: model.kind === "pie" || model.kind === "funnel" ? "item" : "axis", valueFormatter: fmt },
    legend: model.series.length > 1 || model.kind === "pie" || model.kind === "funnel" ? { textStyle: { color: palette.text }, bottom: 0 } : undefined,
  };

  if (model.kind === "pie" || model.kind === "funnel") {
    const first = model.series[0];
    const data = model.categories.flatMap((name, i) => {
      const value = first?.values[i];
      return typeof value === "number" ? [{ name, value }] : [];
    });
    return {
      ...base,
      series: [
        model.kind === "pie"
          ? { type: "pie", name: first?.name, radius: ["40%", "70%"], data, label: { color: palette.text } }
          : { type: "funnel", name: first?.name, sort: "descending", data, label: { color: palette.text } },
      ],
    };
  }

  const category = { type: "category", data: model.categories, axisLabel: { color: palette.text }, axisLine: { lineStyle: { color: palette.rule } } };
  const value = { type: "value", axisLabel: { color: palette.text, formatter: fmt }, splitLine: { lineStyle: { color: palette.rule } } };
  const horizontal = model.kind === "bar";
  return {
    ...base,
    grid: { containLabel: true, left: 8, right: 8, top: 16, bottom: base.legend ? 40 : 8 },
    xAxis: horizontal ? value : category,
    yAxis: horizontal ? category : value,
    series: model.series.map((s) => ({ type: model.kind === "line" ? "line" : "bar", name: s.name, data: s.values })),
  };
}
