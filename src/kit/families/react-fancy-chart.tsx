/**
 * react-fancy's SVG charts as one island: `kind` picks the member (bar,
 * horizontal-bar, stacked-bar, line, area, pie, donut, sparkline). The figure's
 * caption names it; the server render is the text fallback (title and data).
 */
import type { ReactElement } from "react";
import { Chart } from "@particle-academy/react-fancy";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
type Point = { label: string; value: number; color?: string };
type Series = { label: string; data: number[]; color?: string };

function points(v: unknown): Point[] {
  return list<Point>(v).filter((p) => p && typeof p.label === "string" && typeof p.value === "number");
}
function series(v: unknown): Series[] {
  return list<Series>(v).filter((s) => s && typeof s.label === "string" && Array.isArray(s.data));
}

function KitChart({ props }: IslandComponentProps): ReactElement {
  const title = typeof props.title === "string" ? props.title : "";
  const height = typeof props.height === "number" ? props.height : undefined;
  const labels = list<string>(props.labels).map(String);
  const body = (() => {
    switch (props.kind) {
      case "horizontal-bar":
        return <Chart.HorizontalBar data={points(props.data)} height={height} showValues />;
      // `responsive`: these draw at a fixed 500px unless told to fit their box.
      case "stacked-bar":
        return <Chart.StackedBar labels={labels} series={series(props.series)} height={height} responsive />;
      case "line":
        return <Chart.Line labels={labels} series={series(props.series)} height={height} responsive />;
      case "area":
        return <Chart.Area labels={labels} series={series(props.series)} height={height} responsive />;
      case "pie":
        return <Chart.Pie data={points(props.data)} showLabels />;
      case "donut":
        return <Chart.Donut data={points(props.data)} showLegend />;
      case "sparkline":
        return <Chart.Sparkline data={list<number>(props.values).filter((n) => typeof n === "number")} height={height} />;
      default:
        return <Chart.Bar data={points(props.data)} height={height} showValues />;
    }
  })();
  return (
    <figure role="group" aria-label={title || "Chart"}>
      {title ? <figcaption>{title}</figcaption> : null}
      {body}
    </figure>
  );
}

export const islands: Record<string, IslandComponent> = {
  "react-fancy:Chart": KitChart,
};
