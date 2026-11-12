/**
 * Test stand-in for @particle-academy/fancy-echarts (aliased in vitest.config.ts).
 * Records what the chart island hands the real library.
 */
export const stub = {
  registerAllCalls: 0,
  renders: [] as { option: unknown; renderer?: string; className?: string }[],
  reset() {
    this.registerAllCalls = 0;
    this.renders = [];
  },
};

export function registerAll(): void {
  stub.registerAllCalls++;
}

export function EChart(props: { option: unknown; renderer?: "canvas" | "svg"; className?: string; onRenderError?: (e: Error) => void }) {
  stub.renders.push({ option: props.option, renderer: props.renderer, className: props.className });
  return <div data-stub-echart="" />;
}
