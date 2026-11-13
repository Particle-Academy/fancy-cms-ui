/**
 * The `echart` node's figure content. Server and first paint: the caption and
 * the summary, the same bytes as FancyCms\Render\PageRenderer. In the browser,
 * once the node nears the viewport and its option passes the validator, the
 * canvas (src/islands/echart.tsx, fancy-echarts) appears between them,
 * `aria-hidden`: the summary is the text alternative.
 */
import { useRef, useState, type ReactElement, type ReactNode } from "react";
import type { ElementContext } from "./registry";
import { IslandBoundary, resolvedProps, useIsland } from "./islands";
import { echartModel, resolveDeep, validateEchartOption } from "../islands/echart-option";
import { getPath } from "./registry";

function EchartFigure({ ctx }: { ctx: ElementContext }): ReactElement {
  const props = resolvedProps(ctx);
  const m = echartModel(props);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  // Bindings at any depth of the option resolve against the page data, and the
  // resolved option is validated again: host data is data, never markup.
  const option = resolveDeep(m.option, (path) => getPath(ctx.data, path));
  const valid = validateEchartOption(m.option).length === 0 && validateEchartOption(option, { bindings: false }).length === 0;
  const Canvas = useIsland(ctx.islands?.echart?.load, valid, summaryRef);
  const [failed, setFailed] = useState(false);
  return (
    <>
      {m.title ? <figcaption>{m.title}</figcaption> : null}
      {Canvas !== null && !failed ? (
        <IslandBoundary onError={() => setFailed(true)}>
          <div data-cms-echart-canvas="" aria-hidden="true">
            <Canvas props={{ ...props, option, height: m.height }} node={ctx.node} data={ctx.data} />
          </div>
        </IslandBoundary>
      ) : null}
      {m.summary ? (
        <p ref={summaryRef} data-cms-echart-summary="">
          {m.summary}
        </p>
      ) : null}
    </>
  );
}

export function renderEchart(ctx: ElementContext): ReactNode {
  return <EchartFigure ctx={ctx} />;
}
