/**
 * The island registry: how a host tells the renderer which component node types
 * it renders, and tells agents (through the catalogue) what props each takes.
 *
 * An island definition is a catalogue descriptor (description, JSON Schema for
 * props, an example, how it hydrates) plus the code that renders it:
 *
 *   - `component` — rendered on the server and hydrated. What a host's
 *     interactive kit adapters are (tabs, accordion, a form).
 *   - `load` — a dynamic import, fetched in the browser only, when the node
 *     scrolls near the viewport. The server renders `fallback` instead. Use it
 *     for anything heavy, so a page that does not place the type pays nothing.
 *
 *   const islands = registerIslands(defaultIslands, {
 *     "kit:Tabs": defineIsland({ description: "Tabbed panels", props: tabsSchema, component: KitTabs }),
 *     "kit:Map": defineIsland({ description: "Map", props: mapSchema, load: () => import("./KitMap") }),
 *   });
 *   <CmsPage doc={doc} data={data} islands={islands} />
 *   // and on the server: IslandCatalogue::builtin()->merge(json_encode(islandCatalogue(islands)))
 *
 * A type in the registry renders as an island (`data-cms-island`) without the
 * document setting `node.island`, and a failing island never takes the page
 * down: a load error keeps the fallback, a render error is contained by a
 * boundary and logged.
 */
import { Component, useEffect, useState, type ComponentType, type ReactElement, type ReactNode, type RefObject } from "react";
import type { Json, Node } from "../document/types";
import type { DataContext, ElementContext, ElementRenderer } from "./registry";
import { BUILTIN_ISLAND_CATALOGUE, ISLAND_TYPE_PATTERN, descriptorJson, type IslandDescriptor, type IslandHydration, type JsonSchema } from "../islands/catalogue";

export interface IslandComponentProps {
  /** The node's props with every top-level `{ $bind }` resolved against the data context. */
  props: Record<string, unknown>;
  node: Node;
  data?: DataContext;
}
export type IslandComponent = ComponentType<IslandComponentProps>;
export interface IslandModule {
  default: IslandComponent;
}
export type IslandLoader = () => Promise<IslandModule>;

export interface IslandDefinition extends IslandDescriptor {
  /** Rendered on the server and hydrated. */
  component?: IslandComponent;
  /** Loaded in the browser when the node is near the viewport; the server renders `fallback`. */
  load?: IslandLoader;
  /** Server and first-paint content of a lazy island. Default: nothing. */
  fallback?: ElementRenderer;
}

export type IslandRegistry = Record<string, IslandDefinition>;

export interface IslandInput {
  description: string;
  props: JsonSchema;
  example?: { [key: string]: Json };
  /** Default: `lazy` when only `load` is given, otherwise `eager`. */
  hydrate?: IslandHydration;
  component?: IslandComponent;
  load?: IslandLoader;
  fallback?: ElementRenderer;
}

/** Node types the renderer owns natively; an island may not take their names. */
export const NATIVE_NODE_TYPES = ["section", "stack", "grid", "frame", "shape", "card", "text", "heading", "richtext", "link", "list", "divider", "callout", "code", "button", "image", "repeater", "icon"] as const;
const NATIVE = new Set<string>(NATIVE_NODE_TYPES);
const has = Object.prototype.hasOwnProperty;

/** Validate a host island and fill in its hydration. */
export function defineIsland(input: IslandInput): IslandDefinition {
  if (!input.component && !input.load) throw new Error("[fancy-cms] an island needs a component or load.");
  const hydrate: IslandHydration = input.hydrate ?? (input.load && !input.component ? "lazy" : "eager");
  descriptorJson("island", { description: input.description, hydrate, props: input.props, example: input.example });
  return { ...input, hydrate };
}

/**
 * A new registry: `base` plus `add`. Throws on a malformed name, on a native
 * node type, and on a name already registered — two islands answering to one
 * type would leave which one renders up to object-spread order.
 */
export function registerIslands(base: IslandRegistry, add: IslandRegistry): IslandRegistry {
  const out: IslandRegistry = {};
  for (const [type, def] of Object.entries(base)) Object.defineProperty(out, type, { value: def, enumerable: true, writable: true, configurable: true });
  for (const [type, def] of Object.entries(add)) {
    if (!ISLAND_TYPE_PATTERN.test(type)) throw new Error(`[fancy-cms] "${type}" is not a valid island type: use a lowercase namespace and a name, like "kit:Chart".`);
    if (NATIVE.has(type)) throw new Error(`[fancy-cms] "${type}" is a native node type and cannot be an island.`);
    if (has.call(out, type)) throw new Error(`[fancy-cms] island "${type}" is already registered.`);
    descriptorJson(type, def);
    Object.defineProperty(out, type, { value: def, enumerable: true, writable: true, configurable: true });
  }
  return out;
}

const builtin = BUILTIN_ISLAND_CATALOGUE.types;

/**
 * The built-in entries: the infographic kit. `chart` loads its canvas
 * (fancy-echarts, an optional peer) on demand; the other three are static.
 */
export const defaultIslands: IslandRegistry = {
  chart: { ...builtin.chart!, load: () => import("../islands/chart") },
  kpi: { ...builtin.kpi! },
  table: { ...builtin.table! },
  leaderboard: { ...builtin.leaderboard! },
};

/** The registry a page renders with: the built-ins, overridden or extended by the host's. */
export function pageIslands(islands: IslandRegistry | undefined): IslandRegistry {
  return islands ? { ...defaultIslands, ...islands } : defaultIslands;
}

/** Whether a node renders as an island: it says so, or its type hydrates. */
export function isIslandNode(node: Node, islands: IslandRegistry | undefined): boolean {
  if (node.island) return true;
  const def = islands && has.call(islands, node.type) ? islands[node.type] : undefined;
  return def !== undefined && def.hydrate !== "none";
}

/** A node's props, each top-level binding resolved. */
export function resolvedProps(ctx: Pick<ElementContext, "node" | "resolve">): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(ctx.node.props)) out[key] = ctx.resolve(ctx.node.props[key]);
  return out;
}

// ── loading ─────────────────────────────────────────────────────────────────

const modules = new Map<IslandLoader, Promise<IslandComponent>>();
const reported = new WeakSet<IslandLoader>();

function loadOnce(load: IslandLoader): Promise<IslandComponent> {
  let pending = modules.get(load);
  if (!pending) {
    pending = load().then((m) => m.default);
    modules.set(load, pending);
    pending.catch(() => modules.delete(load));
  }
  return pending;
}

/**
 * The component a lazy island loads, or null until it has (and always null on
 * the server and on the first client render, so hydration matches). With a
 * `ref`, loading waits until that element is within 200px of the viewport.
 */
export function useIsland(load: IslandLoader | undefined, enabled: boolean, ref?: RefObject<Element | null>): IslandComponent | null {
  const [loaded, setLoaded] = useState<{ component: IslandComponent } | null>(null);
  useEffect(() => {
    if (!enabled || !load) return;
    let live = true;
    let observer: IntersectionObserver | undefined;
    const start = () => {
      loadOnce(load).then(
        (component) => {
          if (live) setLoaded({ component });
        },
        (error: unknown) => {
          if (reported.has(load)) return;
          reported.add(load);
          console.error("[fancy-cms] an island module failed to load; the server-rendered fallback stays.", error);
        },
      );
    };
    const el = ref?.current;
    if (el && typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            observer?.disconnect();
            start();
          }
        },
        { rootMargin: "200px" },
      );
      observer.observe(el);
    } else {
      start();
    }
    return () => {
      live = false;
      observer?.disconnect();
    };
  }, [load, enabled, ref]);
  return loaded ? loaded.component : null;
}

/** Contains an island's render error so the rest of the page keeps rendering. */
export class IslandBoundary extends Component<{ children: ReactNode; onError?: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: unknown): void {
    console.error("[fancy-cms] an island failed to render and was removed; the rest of the page is unaffected.", error);
    this.props.onError?.();
  }
  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

function LazyIsland({ def, ctx }: { def: IslandDefinition; ctx: ElementContext }): ReactElement {
  const Loaded = useIsland(def.load, true);
  const [failed, setFailed] = useState(false);
  if (Loaded && !failed) {
    return (
      <IslandBoundary onError={() => setFailed(true)}>
        <Loaded props={resolvedProps(ctx)} node={ctx.node} data={ctx.data} />
      </IslandBoundary>
    );
  }
  return <>{def.fallback ? def.fallback(ctx) : null}</>;
}

/** The inner content of a registered island node. */
export function renderIsland(def: IslandDefinition, ctx: ElementContext): ReactNode {
  if (def.component) {
    const Eager = def.component;
    return (
      <IslandBoundary>
        <Eager props={resolvedProps(ctx)} node={ctx.node} data={ctx.data} />
      </IslandBoundary>
    );
  }
  if (def.load) return <LazyIsland def={def} ctx={ctx} />;
  return def.fallback ? def.fallback(ctx) : null;
}
