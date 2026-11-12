// @vitest-environment jsdom
/**
 * Page inputs drive the data a page renders with: a change re-requests the data
 * context through the host's `loadData`, and every node bound to it redraws.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { CmsPage } from "../src/react/CmsPage";
import { defaultIslands, type IslandRegistry } from "../src/react/islands";
import type { InputValues } from "../src/render/inputs";
import type { DataQuery } from "../src/document/data";
import type { Node, PageDoc } from "../src/document/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const n = (id: string, type: string, props: Node["props"], order: string): Node => ({ id, type, parent: null, order, props, style: { base: {} } });
const report: PageDoc = {
  id: "report",
  seq: 0,
  meta: { title: "Report", slug: "/", scrollMode: "smooth" },
  theme: { name: "default" },
  breakpoints: ["base"],
  nodes: Object.fromEntries(
    [
      n("in1", "input", { name: "period", kind: "period", label: "Period", default: "30d" }, "a0"),
      n("in2", "input", { name: "teams", kind: "multiselect", label: "Teams", options: { $bind: "lists.teams" }, default: [] }, "a1"),
      n("k", "kpi", { label: "Revenue", value: { $bind: "metrics.revenue" }, format: "currency", decimals: 0 }, "a2"),
    ].map((x) => [x.id, x]),
  ),
};
const lists = { teams: [{ value: "north", label: "North" }, { value: "south", label: "South" }] };
const first = { lists, metrics: { revenue: 1000 } };

/** No react-fancy swap: the native controls stay, so these tests drive them directly. */
const nativeOnly: IslandRegistry = { ...defaultIslands, input: { ...defaultIslands.input!, load: undefined } };

const roots: Root[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) act(() => r.unmount());
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

function mount(el: ReactElement): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  act(() => root.render(el));
  return host;
}

const flush = () => act(async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
});

function choose(select: HTMLSelectElement, value: string): void {
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const revenue = (host: HTMLElement) => host.querySelector("[data-cms-kpi-value]")?.textContent;

describe("page inputs", () => {
  it("re-requests the data with the new values and redraws the bound nodes", async () => {
    const loadData = vi.fn(async (values: InputValues, _request?: { queries: DataQuery[] }) => ({ lists, metrics: { revenue: values.period === "90d" ? 9000 : 1 } }));
    const changes: [InputValues, string][] = [];
    const host = mount(<CmsPage doc={report} data={first} islands={nativeOnly} loadData={loadData} onInputsChange={(v, name) => changes.push([v, name])} />);
    expect(revenue(host)).toBe("$1,000");
    expect(loadData).not.toHaveBeenCalled();

    choose(host.querySelector<HTMLSelectElement>("#cms-input-period")!, "90d");
    await flush();
    expect(changes).toEqual([[{ period: "90d", teams: [] }, "period"]]);
    expect(loadData).toHaveBeenCalledTimes(1);
    expect(loadData.mock.calls[0]![0]).toEqual({ period: "90d", teams: [] });
    // ...with the queries those values make: what the host fetches, by key.
    expect(loadData.mock.calls[0]![1]!.queries.map((q) => q.key)).toEqual(["lists", "metrics"]);
    expect(revenue(host)).toBe("$9,000");
    expect(host.querySelector<HTMLSelectElement>("#cms-input-period")!.value).toBe("90d");
  });

  it("a multi-select toggles one option at a time", async () => {
    const loadData = vi.fn(async (_values: InputValues) => first);
    const host = mount(<CmsPage doc={report} data={first} islands={nativeOnly} loadData={loadData} />);
    const south = host.querySelector<HTMLInputElement>('input[name="teams[]"][value="south"]')!;
    act(() => south.click());
    await flush();
    expect(loadData.mock.calls.at(-1)![0]).toEqual({ period: "30d", teams: ["south"] });
    act(() => host.querySelector<HTMLInputElement>('input[name="teams[]"][value="north"]')!.click());
    await flush();
    expect(loadData.mock.calls.at(-1)![0]).toEqual({ period: "30d", teams: ["north", "south"] });
  });

  it("only the latest answer is drawn when an earlier one arrives late", async () => {
    const pending: Record<string, (d: Record<string, unknown>) => void> = {};
    const loadData = (values: InputValues) => new Promise<Record<string, unknown>>((done) => (pending[values.period as string] = done));
    const host = mount(<CmsPage doc={report} data={first} islands={nativeOnly} loadData={loadData} />);
    const select = host.querySelector<HTMLSelectElement>("#cms-input-period")!;
    choose(select, "7d");
    await flush();
    choose(select, "12m");
    await flush();
    await act(async () => pending["12m"]!({ lists, metrics: { revenue: 12 } }));
    await act(async () => pending["7d"]!({ lists, metrics: { revenue: 7 } }));
    await flush();
    expect(revenue(host)).toBe("$12");
  });

  it("a failed request keeps the page's current data", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const host = mount(<CmsPage doc={report} data={first} islands={nativeOnly} loadData={async () => Promise.reject(new Error("offline"))} />);
    choose(host.querySelector<HTMLSelectElement>("#cms-input-period")!, "90d");
    await flush();
    expect(revenue(host)).toBe("$1,000");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("is controlled when the host passes inputs, and starts from defaultInputs otherwise", async () => {
    const loadData = vi.fn(async () => first);
    const host = mount(<CmsPage doc={report} data={first} islands={nativeOnly} inputs={{ period: "7d" }} loadData={loadData} />);
    expect(host.querySelector<HTMLSelectElement>("#cms-input-period")!.value).toBe("7d");
    choose(host.querySelector<HTMLSelectElement>("#cms-input-period")!, "90d");
    await flush();
    expect(host.querySelector<HTMLSelectElement>("#cms-input-period")!.value).toBe("7d");
    const other = mount(<CmsPage doc={report} data={first} islands={nativeOnly} defaultInputs={{ period: "12m" }} />);
    expect(other.querySelector<HTMLSelectElement>('select[name="period"]')!.value).toBe("12m");
  });

  it("hydrates the server markup without a mismatch, then loads react-fancy's controls on the same ids", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const loadData = vi.fn(async (values: InputValues) => ({ lists, metrics: { revenue: values.period === "7d" ? 7 : 1 } }));
    const host = document.createElement("div");
    host.innerHTML = renderToString(<CmsPage doc={report} data={first} />);
    document.body.appendChild(host);
    let root!: Root;
    act(() => {
      root = hydrateRoot(host, <CmsPage doc={report} data={first} loadData={loadData} />);
    });
    roots.push(root);
    // The island module is a dynamic import; give it time to arrive.
    for (let i = 0; i < 50 && !host.querySelector("[data-react-fancy-checkbox-group]"); i++) {
      await act(async () => new Promise((r) => setTimeout(r, 20)));
    }
    expect(host.querySelector("[data-react-fancy-checkbox-group]")).not.toBeNull();
    const select = host.querySelector<HTMLSelectElement>("#cms-input-period")!;
    expect(select).not.toBeNull();
    expect(host.querySelector('label[for="cms-input-period"]')?.textContent).toBe("Period");
    choose(select, "7d");
    await flush();
    expect(revenue(host)).toBe("$7");
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
