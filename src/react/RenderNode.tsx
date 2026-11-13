import { createElement, type ReactElement } from "react";
import { hasNodeMap, withNodeDefaults, type Bound, type Json, type PageDoc } from "../document/types";
import { childrenOf } from "../document/reduce";
import { own } from "../document/own";
import { decorationError } from "../document/decorative";
import type { IconSet } from "../document/icons";
import type { ImageAssetResolver } from "../render/images";
import {prepareDocFonts,type FontRenderOptions} from "../render/fonts";
import { wrapFor } from "../render/wrap";
import { anchorFor, defaultRegistry, elementFor, resolveValue, type DataContext, type ElementRegistry } from "./registry";
import { isIslandNode, pageIslands, renderIsland, type IslandRegistry } from "./islands";

export interface RenderNodeProps extends FontRenderOptions {
  doc: PageDoc;
  id: string;
  registry?: ElementRegistry;
  /** Data context bindings resolve against (page data + any repeater scope). */
  data?: DataContext;
  /** Preload the same selected glyphs for SSR and hydration. */
  icons?: IconSet;
  /** Closed host asset lookup, identical for SSR, hydration and editor preview. */
  imageResolver?: ImageAssetResolver;
  /** Island registry: the built-ins plus the host's (`registerIslands`). Default: the built-ins. */
  islands?: IslandRegistry;
}

/**
 * Render one node (and its subtree) to a `[data-cms]`-tagged element. The CSS
 * emitted by `emitDocCss` targets these `data-cms` handles. Interactive /
 * 3rd-party **islands** with no registered renderer become an empty, sized
 * placeholder the host hydrates client-side — mirroring the PHP renderer.
 *
 * `repeater` nodes are special-cased: their first child is a template rendered
 * once per item of the bound `items` array, each in a scope that exposes `item`
 * and `index` to nested `{ $bind: "item.…" }` bindings.
 */
export function RenderNode(props: RenderNodeProps): ReactElement | null {
  if (!hasNodeMap(props.doc) || !own(props.doc.nodes, props.id)) return null;
  prepareDocFonts(props.doc,props);
  return <ValidatedNode {...props} islands={pageIslands(props.islands)} decorativeSafe={decorationError(props.doc.nodes) === null} />;
}

/** @internal One fresh validation per page render, shared across every root. */
export function renderNodes({ ids, ...props }: Omit<RenderNodeProps, "id"> & { ids: readonly string[] }): ReactElement[] {
  if (!hasNodeMap(props.doc)) return [];
  const decorativeSafe = decorationError(props.doc.nodes) === null;
  const islands = pageIslands(props.islands);
  return ids.map((id) => <ValidatedNode key={id} {...props} islands={islands} id={id} decorativeSafe={decorativeSafe} />);
}

function ValidatedNode({ doc, id, registry = defaultRegistry, data, icons, imageResolver, islands, decorativeSafe }: RenderNodeProps & { decorativeSafe: boolean }): ReactElement | null {
  const stored = own(doc.nodes, id);
  if (!stored) return null;
  const node = withNodeDefaults(stored);

  if (node.type === "repeater") {
    const arr = resolveValue(node.props.items as Bound<Json> | undefined, data);
    const items = Array.isArray(arr) ? arr : [];
    const template = childrenOf(doc, id)[0];
    return (
      <div data-cms={node.id} className={node.className}>
        {template
          ? items.map((item, index) => (
              <ValidatedNode key={index} doc={doc} id={template.id} registry={registry} data={{ ...data, item, index }} icons={icons} imageResolver={imageResolver} islands={islands} decorativeSafe={decorativeSafe} />
            ))
          : null}
      </div>
    );
  }

  const kids = childrenOf(doc, id).map((child) => (
    <ValidatedNode key={child.id} doc={doc} id={child.id} registry={registry} data={data} icons={icons} imageResolver={imageResolver} islands={islands} decorativeSafe={decorativeSafe} />
  ));

  const resolve = (v: Bound<Json> | undefined) => resolveValue(v, data);
  const text = (v: Bound<Json> | undefined): string => {
    const r = resolve(v);
    return r === undefined || r === null ? "" : String(r);
  };

  // An element renderer wins; then a registered island's component or loader;
  // then an island with neither is the empty placeholder a host hydrates.
  const renderer = own(registry, node.type);
  const island = islands ? own(islands, node.type) : undefined;
  const isIsland = isIslandNode(node, islands);
  const ctx = { node, doc, children: kids, data, icons, imageResolver, islands, resolve, text };
  const inner = renderer ? renderer(ctx) : island && (island.component || island.load) ? renderIsland(island, ctx) : isIsland ? null : kids;

  // The [data-cms] element is the semantic element itself (h1-h6, p, a, ul,
  // section, nav ...), so the node's emitted CSS styles the real element.
  const { tag, attrs } = elementFor(node, text);
  const anchor = anchorFor(node, text);
  // A long token may break anywhere; ordinary words keep their min-content (render/wrap.ts).
  const listItems = node.type === "list" ? resolve(node.props.items) : undefined;
  const wrap = wrapFor(
    node.type,
    node.type === "list" ? "" : text(node.props.content),
    Array.isArray(listItems) ? listItems.map((item) => (item === null || item === undefined ? "" : String(item))) : [],
  );
  return createElement(
    tag,
    {
      "data-cms": node.id,
      "data-cms-island": isIsland ? node.type : undefined,
      className: node.className,
      ...(anchor ? { id: anchor } : {}),
      ...attrs,
      ...(wrap ? { "data-cms-wrap": wrap } : {}),
      ...(decorativeSafe && ["frame", "shape"].includes(node.type) && node.props.decorative === true ? { "aria-hidden": "true" } : {}),
    },
    inner,
  );
}
