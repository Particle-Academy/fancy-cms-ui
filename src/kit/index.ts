/**
 * @particle-academy/fancy-cms-ui/kit — every Fancy kit component as a CMS island.
 *
 *   import { defaultIslands, registerIslands } from "@particle-academy/fancy-cms-ui/react";
 *   import { kitIslands } from "@particle-academy/fancy-cms-ui/kit";
 *   const islands = registerIslands(defaultIslands, kitIslands);
 *   <CmsPage doc={doc} islands={islands} />
 *   // server: IslandCatalogue::kit() in particle-academy/fancy-cms lists the same types
 *
 * The catalogue (catalogue.json) is generated from the components' real prop
 * types (scripts/generate-kit-catalogue.mjs) and is byte-identical in
 * fancy-cms. Each island is lazy: the server renders its text fallback (and a
 * container island's child nodes), and the browser loads the island's family
 * chunk after hydration, so a page fetches only the families it places.
 *
 * Not in `defaultIslands`: this entry's lazy imports name every kit package,
 * and a bundler resolves a lazy import at build time, so a host without the
 * whole kit installed would fail to build. A host with the kit opts in here.
 */
import { createElement, useEffect, useRef, type ReactElement } from "react";
import type { IslandComponent, IslandComponentProps, IslandDefinition, IslandRegistry } from "../react/islands";
import type { IslandCatalogueJson, IslandDescriptor } from "../islands/catalogue";
import { sanitizeProps } from "./sanitize";
import catalogue from "./catalogue.json";
import familyOf from "./families.json";

export { generic, componentProps, useIslandState, type GenericOptions, type StateSpec } from "./generic";
export { sanitizeProps, safeUrl, URL_KEYS } from "./sanitize";

/** The kit catalogue: every kit island type, its props schema, example and text fallback. */
export const KIT_ISLAND_CATALOGUE = catalogue as unknown as IslandCatalogueJson;

/** A family module: the island components of one chunk, keyed by island type. */
export interface KitFamilyModule {
  islands: Record<string, IslandComponent>;
}

/** One loader per family chunk. Bundlers split each into its own chunk. */
export const KIT_FAMILIES: Record<string, () => Promise<KitFamilyModule>> = {
  "react-fancy-forms": () => import("./families/react-fancy-forms"),
  "react-fancy-display": () => import("./families/react-fancy-display"),
  "react-fancy-chart": () => import("./families/react-fancy-chart"),
  "react-fancy-layout": () => import("./families/react-fancy-layout"),
  "react-fancy-nav": () => import("./families/react-fancy-nav"),
  "react-fancy-overlays": () => import("./families/react-fancy-overlays"),
  "react-fancy-media": () => import("./families/react-fancy-media"),
  "react-fancy-data": () => import("./families/react-fancy-data"),
  "fancy-echarts": () => import("./families/fancy-echarts"),
  "fancy-code": () => import("./families/fancy-code"),
  "fancy-sheets": () => import("./families/fancy-sheets"),
  "fancy-slides": () => import("./families/fancy-slides"),
  "fancy-docs": () => import("./families/fancy-docs"),
  "last-word-ui": () => import("./families/last-word-ui"),
  "fancy-whiteboard": () => import("./families/fancy-whiteboard"),
  "fancy-artboard": () => import("./families/fancy-artboard"),
  "fancy-diff": () => import("./families/fancy-diff"),
  "fancy-motion": () => import("./families/fancy-motion"),
  "fancy-3d": () => import("./families/fancy-3d"),
  "fancy-3d-three": () => import("./families/fancy-3d-three"),
  "fancy-3d-babylon": () => import("./families/fancy-3d-babylon"),
  "fancy-flow": () => import("./families/fancy-flow"),
  "fancy-term": () => import("./families/fancy-term"),
  "fancy-mlm-ui": () => import("./families/fancy-mlm-ui"),
  "fancy-fun-lab-ui": () => import("./families/fancy-fun-lab-ui"),
  "fancy-git-ui": () => import("./families/fancy-git-ui"),
  "fancy-x-files-ui": () => import("./families/fancy-x-files-ui"),
  "fancy-grid": () => import("./families/fancy-grid"),
  "fancy-trading-ui": () => import("./families/fancy-trading-ui"),
  "job-board": () => import("./families/job-board"),
  classroom: () => import("./families/classroom"),
  "teachers-aid-ui": () => import("./families/teachers-aid-ui"),
  "fancy-passkeys-ui": () => import("./families/fancy-passkeys-ui"),
  "fancy-captcha-ui": () => import("./families/fancy-captcha-ui"),
  "fancy-walkthrough": () => import("./families/fancy-walkthrough"),
  "fancy-whats-new": () => import("./families/fancy-whats-new"),
  "fancy-app-update": () => import("./families/fancy-app-update"),
  "fancy-brand-icons": () => import("./families/fancy-brand-icons"),
};

/**
 * Marks the island's `[data-cms-island]` element once its component has
 * rendered (`data-cms-island-ready`), so a test or a crawler can tell a loaded
 * island from its fallback. Renders nothing of its own.
 */
function ReadyMark({ type }: { type: string }): ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = ref.current?.closest("[data-cms-island]");
    host?.setAttribute("data-cms-island-ready", type);
    return () => host?.removeAttribute("data-cms-island-ready");
  }, [type]);
  return createElement("span", { ref, hidden: true, "data-cms-island-mark": "" });
}

/** The component an island type renders: its family's adapter, with sanitised props. */
function kitComponent(type: string, d: IslandDescriptor, Adapter: IslandComponent): IslandComponent {
  function KitIsland(p: IslandComponentProps): ReactElement {
    const props = sanitizeProps(p.props, d.props);
    return createElement(
      "div",
      { "data-kit-island": type },
      createElement(ReadyMark, { type }),
      createElement(Adapter, { props, node: p.node, data: p.data }, p.children),
    );
  }
  KitIsland.displayName = `KitIsland(${type})`;
  return KitIsland;
}

function loaderFor(type: string, d: IslandDescriptor): IslandDefinition["load"] {
  const family = (familyOf as Record<string, string>)[type];
  const load = family ? KIT_FAMILIES[family] : undefined;
  if (!load) throw new Error(`[fancy-cms] kit island "${type}" has no family.`);
  return () =>
    load().then((m) => {
      const Adapter = m.islands[type];
      if (!Adapter) throw new Error(`[fancy-cms] the ${family} chunk has no adapter for "${type}".`);
      return { default: kitComponent(type, d, Adapter) };
    });
}

/** Every kit island, ready for `registerIslands(defaultIslands, kitIslands)`. */
export const kitIslands: IslandRegistry = Object.fromEntries(
  Object.entries(KIT_ISLAND_CATALOGUE.types).map(([type, d]) => [type, { ...d, load: loaderFor(type, d) }]),
);

/** The kit islands of some packages only (`["react-fancy", "fancy-code"]`), by their package names without the scope. */
export function kitIslandsOf(packages: readonly string[]): IslandRegistry {
  const want = new Set(packages.map((p) => `@particle-academy/${p.replace(/^@particle-academy\//, "")}`));
  return Object.fromEntries(Object.entries(kitIslands).filter(([, d]) => d.package !== undefined && want.has(d.package)));
}
