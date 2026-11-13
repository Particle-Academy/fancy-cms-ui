// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { CmsPage } from "../src/react/CmsPage";
import { CmsRegion } from "../src/react/CmsRegion";
import {
  defaultIslands,
  defineIsland,
  registerIslands,
  type IslandComponentProps,
  type IslandRegistry,
} from "../src/react/islands";
import { getPath } from "../src/react/registry";
import { islandCatalogue, BUILTIN_ISLAND_CATALOGUE, type JsonSchema } from "../src/islands/catalogue";
import type { Node, PageDoc } from "../src/document/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function doc(nodes: Node[]): PageDoc {
  return { id: "p", seq: 0, meta: { title: "P", slug: "/", scrollMode: "smooth" }, theme: { name: "default" }, breakpoints: ["base"], nodes: Object.fromEntries(nodes.map((n) => [n.id, n])) };
}
const node = (id: string, type: string, props: Node["props"], extra: Partial<Node> = {}): Node => ({ id, type, parent: null, order: id, props, style: { base: {} }, ...extra });

const chartNode = (id = "c") => node(id, "chart", { title: "Sales", categories: ["Q1", "Q2"], series: [{ name: "Units", data: [3, 4] }] });

const schema: JsonSchema = { type: "object", required: ["count"], properties: { count: { $ref: "#/$defs/Number" } } };

function Counter({ props }: IslandComponentProps) {
  return <output data-counter="">{String(props.count)}</output>;
}

describe("island registration", () => {
  it("defines a host island with a JSON schema and a default hydration", () => {
    const def = defineIsland({ description: "A counter", props: schema, component: Counter });
    expect(def.hydrate).toBe("eager");
    expect(defineIsland({ description: "Lazy", props: schema, load: async () => ({ default: Counter }) }).hydrate).toBe("lazy");
  });

  it("refuses a definition with no way to render, or a props schema that is not an object schema", () => {
    expect(() => defineIsland({ description: "x", props: schema })).toThrow(/component or load/);
    expect(() => defineIsland({ description: "x", props: { type: "array" }, component: Counter })).toThrow(/object schema/);
    expect(() => defineIsland({ description: "", props: schema, component: Counter })).toThrow(/description/);
  });

  it("registers host islands beside the built-ins and refuses bad names and collisions", () => {
    const islands = registerIslands(defaultIslands, { "kit:Counter": defineIsland({ description: "A counter", props: schema, component: Counter }) });
    expect(Object.keys(islands)).toEqual(["chart", "echart", "kpi", "table", "leaderboard", "input", "kit:Counter"]);
    expect(() => registerIslands(defaultIslands, { chart: defineIsland({ description: "x", props: schema, component: Counter }) })).toThrow(/already registered/);
    expect(() => registerIslands(defaultIslands, { text: defineIsland({ description: "x", props: schema, component: Counter }) })).toThrow(/native node type/);
    for (const bad of ["Kit:X", "kit:", "has space", "__proto__", "a:b:c", ""]) {
      expect(() => registerIslands(defaultIslands, { [bad]: defineIsland({ description: "x", props: schema, component: Counter }) }), bad).toThrow(/island type/);
    }
  });

  it("serialises the catalogue an agent reads: schemas and examples, never components", () => {
    const islands = registerIslands(defaultIslands, { "kit:Counter": defineIsland({ description: "A counter", props: schema, example: { count: 2 }, component: Counter }) });
    const catalogue = islandCatalogue(islands);
    expect(catalogue.$defs).toEqual(BUILTIN_ISLAND_CATALOGUE.$defs);
    expect(Object.keys(catalogue.types)).toEqual(["chart", "echart", "kpi", "table", "leaderboard", "input", "kit:Counter"]);
    expect(catalogue.types["kit:Counter"]).toEqual({ description: "A counter", hydrate: "eager", props: schema, example: { count: 2 } });
    expect(JSON.parse(JSON.stringify(catalogue))).toEqual(catalogue);
    expect(islandCatalogue(defaultIslands)).toEqual(BUILTIN_ISLAND_CATALOGUE);
  });
});

describe("host islands render", () => {
  const islands: IslandRegistry = {
    "kit:Counter": defineIsland({ description: "A counter", props: schema, component: Counter }),
  };

  it("an eager island renders its component on the server with resolved props, marked as an island", () => {
    const html = renderToStaticMarkup(<CmsPage doc={doc([node("n", "kit:Counter", { count: { $bind: "stats.n" } })])} data={{ stats: { n: 7 } }} islands={islands} includeStyles={false} />);
    expect(html).toBe('<div data-cms="n" data-cms-island="kit:Counter"><output data-counter="">7</output></div>');
  });

  it("an element registry renderer still wins over an island component", () => {
    const html = renderToStaticMarkup(<CmsPage doc={doc([node("n", "kit:Counter", { count: 1 })])} islands={islands} registry={{ "kit:Counter": () => "custom" }} includeStyles={false} />);
    expect(html).toBe('<div data-cms="n" data-cms-island="kit:Counter">custom</div>');
  });

  it("an unregistered island node keeps the empty placeholder a host hydrates itself", () => {
    const html = renderToStaticMarkup(<CmsPage doc={doc([node("n", "host-widget", {}, { island: true })])} includeStyles={false} />);
    expect(html).toBe('<div data-cms="n" data-cms-island="host-widget"></div>');
  });

  it("CmsRegion takes the same islands, and resolves bindings against its data", () => {
    const html = renderToStaticMarkup(<CmsRegion doc={doc([node("n", "kit:Counter", { count: { $bind: "stats.n" } })])} root="n" data={{ stats: { n: 3 } }} islands={islands} includeStyles={false} />);
    expect(html).toContain('<output data-counter="">3</output>');
  });
});

describe("lazy islands in the browser", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });

  async function mount(el: ReactElement) {
    await act(async () => root.render(el));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }

  function chartIslands(load: () => Promise<{ default: (p: IslandComponentProps) => ReactElement }>): IslandRegistry {
    return { chart: { ...defaultIslands.chart!, load } };
  }

  it("a host lazy island shows its fallback first, then the loaded component", async () => {
    const lazy: IslandRegistry = { "kit:Later": defineIsland({ description: "later", props: schema, load: async () => ({ default: Counter }), fallback: () => "loading" }) };
    const page = <CmsPage doc={doc([node("n", "kit:Later", { count: 5 })])} islands={lazy} includeStyles={false} />;
    expect(renderToStaticMarkup(page)).toBe('<div data-cms="n" data-cms-island="kit:Later">loading</div>');
    await mount(page);
    expect(container.querySelector("[data-counter]")!.textContent).toBe("5");
  });

  it("a chart loads its canvas once per page, keeps the table for assistive technology", async () => {
    const load = vi.fn(async () => ({ default: ({ props }: IslandComponentProps) => <span data-fake-chart="">{String((props.series as unknown[]).length)}</span> }));
    await mount(<CmsPage doc={doc([chartNode("a"), chartNode("b")])} islands={chartIslands(load)} includeStyles={false} />);
    expect(load).toHaveBeenCalledTimes(1);
    const canvases = container.querySelectorAll("[data-cms-chart-canvas]");
    expect(canvases).toHaveLength(2);
    expect(canvases[0]!.getAttribute("aria-hidden")).toBe("true");
    expect(canvases[0]!.textContent).toBe("1");
    expect(container.querySelector('[data-cms="a"] table')!.hasAttribute("data-cms-sr")).toBe(true);
  });

  it("a chart with no data never loads the chart library", async () => {
    const load = vi.fn(async () => ({ default: () => <span /> }));
    await mount(<CmsPage doc={doc([node("c", "chart", { categories: { $bind: "nope" }, series: { $bind: "nope" } })])} islands={chartIslands(load)} includeStyles={false} />);
    expect(load).not.toHaveBeenCalled();
    expect(container.querySelector("[data-cms-empty]")).not.toBeNull();
  });

  it("a page without a chart never loads the chart library", async () => {
    const load = vi.fn(async () => ({ default: () => <span /> }));
    await mount(<CmsPage doc={doc([node("k", "kpi", { value: 3 })])} islands={chartIslands(load)} includeStyles={false} />);
    expect(load).not.toHaveBeenCalled();
  });

  it("a failed load leaves the static table visible and the page standing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const load = vi.fn(async () => { throw new Error("no fancy-echarts"); });
    await mount(<CmsPage doc={doc([chartNode()])} islands={chartIslands(load)} includeStyles={false} />);
    expect(container.querySelector("[data-cms-chart-canvas]")).toBeNull();
    expect(container.querySelector("table")!.hasAttribute("data-cms-sr")).toBe(false);
  });

  it("a canvas that throws while rendering falls back to the table instead of unmounting the page", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const load = vi.fn(async () => ({ default: (): ReactElement => { throw new Error("chart type not registered"); } }));
    await mount(<CmsPage doc={doc([chartNode(), node("t", "text", { content: "still here" })])} islands={chartIslands(load)} includeStyles={false} />);
    expect(container.querySelector("[data-cms-chart-canvas]")).toBeNull();
    expect(container.querySelector("table")!.hasAttribute("data-cms-sr")).toBe(false);
    expect(container.textContent).toContain("still here");
  });

  it("hydrates server markup without a mismatch", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const load = vi.fn(async () => ({ default: () => <span data-fake-chart="" /> }));
    const page = <CmsPage doc={doc([chartNode()])} islands={chartIslands(load)} includeStyles={false} />;
    const server = document.createElement("div");
    document.body.appendChild(server);
    server.innerHTML = renderToString(page);
    let hydrated: Root | undefined;
    await act(async () => { hydrated = hydrateRoot(server, page); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(errors).not.toHaveBeenCalled();
    expect(server.querySelector("[data-fake-chart]")).not.toBeNull();
    await act(async () => hydrated!.unmount());
    server.remove();
  });
});

describe("binding paths read only what the data context holds", () => {
  it("never walks the prototype chain", () => {
    expect(getPath({ a: { b: 1 } }, "a.b")).toBe(1);
    expect(getPath({ a: {} }, "a.constructor")).toBeUndefined();
    expect(getPath({}, "__proto__")).toBeUndefined();
    expect(getPath({ list: [10, 20] }, "list.1")).toBe(20);
    expect(getPath({ list: [10, 20] }, "list.length")).toBeUndefined();
  });
});
