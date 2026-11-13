/**
 * fancy-echarts' EChartGraphic as a kit island: shapes and text drawn by
 * ECharts, under the same validator as the echart node (no markup, no CSS, no
 * links, no images). An element list that fails it draws nothing; the figure's
 * title and summary remain.
 */
import { useEffect, useState, type ReactElement } from "react";
import { EChartGraphic, registerAll } from "@particle-academy/fancy-echarts";
import type { IslandComponent, IslandComponentProps } from "../../react/islands";
import { validateGraphicElements } from "../../islands/echart-option";

let registered = false;

function KitEChartGraphic({ props }: IslandComponentProps): ReactElement {
  const [ready, setReady] = useState(registered);
  useEffect(() => {
    if (!registered) {
      registerAll();
      registered = true;
    }
    setReady(true);
  }, []);
  const title = typeof props.title === "string" ? props.title : "";
  const summary = typeof props.summary === "string" ? props.summary : "";
  const height = typeof props.height === "number" ? Math.min(800, Math.max(80, props.height)) : 240;
  const ok = validateGraphicElements(props.elements).length === 0;
  return (
    <figure>
      {title ? <figcaption>{title}</figcaption> : null}
      {ok && ready ? (
        <div aria-hidden="true" style={{ width: "100%", height }}>
          <EChartGraphic elements={props.elements as never} renderer="svg" style={{ width: "100%", height: "100%" }} />
        </div>
      ) : (
        <div aria-hidden="true" style={{ width: "100%", height }} />
      )}
      {summary ? <p>{summary}</p> : null}
    </figure>
  );
}

export const islands: Record<string, IslandComponent> = {
  "fancy-echarts:EChartGraphic": KitEChartGraphic,
};
