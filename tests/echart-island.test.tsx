// @vitest-environment jsdom
/** The echart node's lazily loaded canvas (fancy-echarts is the recording stub, vitest.config.ts). */
import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import EchartCanvas from "../src/islands/echart";
import { stub } from "./stubs/fancy-echarts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("EchartCanvas", () => {
  it("draws the option in rich-text tooltip mode and marks its island mounted", async () => {
    stub.reset();
    const island = document.createElement("figure");
    island.setAttribute("data-cms-island", "echart");
    document.body.appendChild(island);
    const root = createRoot(island);
    await act(async () => {
      root.render(<EchartCanvas props={{ option: { tooltip: {}, series: [{ type: "bar", data: [1, 2] }] }, height: 200 }} node={{ id: "e", type: "echart", parent: null, order: "a0", props: {}, style: { base: {} } } as never} />);
    });
    expect(island.getAttribute("data-cms-island-ready")).toBe("echart");
    const option = stub.renders.at(-1)!.option as { tooltip: { renderMode: string } };
    expect(option.tooltip.renderMode).toBe("richText");
    await act(async () => root.unmount());
    expect(island.hasAttribute("data-cms-island-ready")).toBe(false);
    island.remove();
  });
});
