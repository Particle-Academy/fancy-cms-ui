/**
 * The chart island's browser module, loaded only by `import("../islands/chart")`
 * from the island registry — never statically — so `@particle-academy/fancy-echarts`
 * and echarts reach a page's bundle as a separate chunk that is fetched only
 * when a chart with data scrolls near the viewport.
 *
 * fancy-echarts is an optional peer of this package. A host that places charts
 * installs it; one that does not never loads this file.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { EChart, registerAll } from "@particle-academy/fancy-echarts";
import type { IslandComponentProps } from "../react/islands";
import { chartModel } from "../render/infographics";
import { chartOption, type ChartPalette } from "./chart-option";

// Registration is per bundle entry (fancy-echarts' README). Done on first
// render, so loading this module is what credits fancy-echarts, not importing
// the CMS renderer.
let registered = false;
function ensureRegistered(): void {
  if (!registered) {
    registerAll();
    registered = true;
  }
}

const FALLBACK_COLORS = ["#7c3aed", "#0f766e", "#c2410c", "#1d4ed8", "#be185d", "#4d7c0f"];

function withAlpha(color: string, alpha: number): string {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  return m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})` : color;
}

/** Theme tokens as the page resolved them, read off the chart's figure. */
function readPalette(el: Element | null): ChartPalette {
  const figure = el?.closest("figure") ?? el;
  if (!figure || typeof getComputedStyle !== "function") return { colors: FALLBACK_COLORS, text: "#334155", rule: "rgba(51, 65, 85, 0.2)" };
  const style = getComputedStyle(figure);
  const colors = [1, 2, 3, 4, 5, 6].map((i) => style.getPropertyValue(`--cms-chart-${i}`).trim()).filter(Boolean);
  const text = style.color || "#334155";
  return { colors: colors.length ? colors : FALLBACK_COLORS, text, rule: withAlpha(text, 0.2) };
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ChartCanvas({ props }: IslandComponentProps): ReactElement {
  ensureRegistered();
  const ref = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<ChartPalette | null>(null);

  useEffect(() => {
    const read = () => setPalette(readPalette(ref.current));
    read();
    // Follow a light/dark switch: the kit flips a class or data-theme on <html>.
    if (typeof MutationObserver !== "function" || typeof document === "undefined") return;
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    return () => observer.disconnect();
  }, []);

  const model = chartModel(props);
  const option = useMemo(() => (palette ? chartOption(model, palette, prefersReducedMotion()) : null), [palette, JSON.stringify(props)]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      {option ? <EChart option={option} renderer="svg" style={{ width: "100%", height: "100%" }} /> : null}
    </div>
  );
}
