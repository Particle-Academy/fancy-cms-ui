/**
 * The `echart` node's browser module, loaded only by `import("../islands/echart")`
 * from the island registry, so fancy-echarts (an optional peer) and echarts
 * reach a page's bundle as a separate chunk fetched when an echart scrolls near
 * the viewport. It receives an option that has already been resolved and
 * validated (react/echart.tsx), and only fills in the theme.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { EChart, registerAll } from "@particle-academy/fancy-echarts";
import type { IslandComponentProps } from "../react/islands";
import { echartRenderOption, type EchartTheme } from "./echart-option";

let registered = false;
function ensureRegistered(): void {
  if (!registered) {
    registerAll();
    registered = true;
  }
}

const FALLBACK_COLORS = ["#7c3aed", "#0f766e", "#c2410c", "#1d4ed8", "#be185d", "#4d7c0f"];

function readTheme(el: Element | null): EchartTheme {
  const figure = el?.closest("figure") ?? el;
  if (!figure || typeof getComputedStyle !== "function") return { colors: FALLBACK_COLORS, text: "#334155", rule: "rgba(51, 65, 85, 0.2)" };
  const style = getComputedStyle(figure);
  const colors = [1, 2, 3, 4, 5, 6].map((i) => style.getPropertyValue(`--cms-chart-${i}`).trim()).filter(Boolean);
  return { colors: colors.length ? colors : FALLBACK_COLORS, text: style.color || "#334155", rule: "rgba(51, 65, 85, 0.2)" };
}

export default function EchartCanvas({ props }: IslandComponentProps): ReactElement {
  ensureRegistered();
  const ref = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<EchartTheme | null>(null);
  useEffect(() => setTheme(readTheme(ref.current)), []);
  // Mark the figure mounted, as a kit island marks itself (data-cms-island-ready),
  // so a check can tell a drawn chart from its server text.
  useEffect(() => {
    const host = ref.current?.closest("[data-cms-island]");
    host?.setAttribute("data-cms-island-ready", "echart");
    return () => host?.removeAttribute("data-cms-island-ready");
  }, []);
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const option = useMemo(
    () => (theme && props.option && typeof props.option === "object" ? echartRenderOption(props.option as Record<string, unknown>, theme, reduced) : null),
    [theme, JSON.stringify(props.option), reduced], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const height = typeof props.height === "number" ? props.height : 320;
  return (
    <div ref={ref} style={{ width: "100%", height }}>
      {option ? <EChart option={option} renderer="svg" style={{ width: "100%", height: "100%" }} /> : null}
    </div>
  );
}
