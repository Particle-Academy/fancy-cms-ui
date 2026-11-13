/**
 * The slice of @particle-academy/fancy-echarts (an optional peer, >=6.3.0 <7)
 * the chart island uses. Declared here because this package does not install
 * the peer: installing it would bring echarts into the dev tree. Checked against
 * fancy-echarts 6.3.0's `EChartBaseProps` and `registerAll` (src/types.ts and
 * src/utils/register.ts in that repo).
 */
declare module "@particle-academy/fancy-echarts" {
  import type { ComponentType, CSSProperties } from "react";

  export const EChart: ComponentType<{
    option: Record<string, unknown>;
    renderer?: "canvas" | "svg";
    className?: string;
    style?: CSSProperties;
    onRenderError?: (error: Error) => void;
  }>;

  /** The graphic-elements surface (kit island fancy-echarts:EChartGraphic). */
  export const EChartGraphic: ComponentType<{
    elements: Record<string, unknown>[];
    renderer?: "canvas" | "svg";
    className?: string;
    style?: CSSProperties;
  }>;

  export function registerAll(): void;
}
