import { createElement, type ReactElement } from "react";
import { hasNodeMap, withNodeDefaults, type Bound, type Json, type PageDoc } from "../document/types";
import { childrenOf } from "../document/reduce";
import { own } from "../document/own";
import { decorationError } from "../document/decorative";
import type { IconSet } from "../document/icons";
import type { ImageAssetResolver } from "../render/images";
import { anchorFor, defaultRegistry, elementFor, resolveValue, type DataContext, type ElementRegistry } from "./registry";

export interface RenderNodeProps {
  doc: PageDoc;
  id: string;
  registry?: ElementRegistry;
  /** Data context bindings resolve against (page data + any repeater scope). */
  data?: DataContext;
  /** Preload the same selected glyphs for SSR and hydration. */
  icons?: IconSet;
  /** Closed host asset lookup, identical for SSR, hydration and editor preview. */
  imageResolver?: ImageAssetResolver;
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
  return <ValidatedNode {...props} decorativeSafe={decorationError(props.doc.nodes) === null} />;
}

/** @internal One fresh validation per page render, shared across every root. */
export function renderNodes({ ids, ...props }: Omit<RenderNodeProps, "id"> & { ids: readonly string[] }): ReactElement[] {
  const decorativeSafe = decorationError(props.doc.nodes) === null;
  return ids.map((id) => <ValidatedNode key={id} {...props} id={id} decorativeSafe={decorativeSafe} />);
}

function ValidatedNode({ doc, id, registry = defaultRegistry, data, icons, imageResolver, decorativeSafe }: RenderNodeProps & { decorativeSafe: boolean }): ReactElement | null {
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
              <ValidatedNode key={index} doc={doc} id={template.id} registry={registry} data={{ ...data, item, index }} icons={icons} imageResolver={imageResolver} decorativeSafe={decorativeSafe} />
            ))
          : null}
      </div>
    );
  }

  const kids = childrenOf(doc, id).map((child) => (
    <ValidatedNode key={child.id} doc={doc} id={child.id} registry={registry} data={data} icons={icons} imageResolver={imageResolver} decorativeSafe={decorativeSafe} />
  ));

  const resolve = (v: Bound<Json> | undefined) => resolveValue(v, data);
  const text = (v: Bound<Json> | undefined): string => {
    const r = resolve(v);
    return r === undefined || r === null ? "" : String(r);
  };

  const renderer = registry[node.type];
  const inner = renderer ? renderer({ node, doc, children: kids, data, icons, imageResolver, resolve, text }) : node.island ? null : kids;

  // The [data-cms] element is the semantic element itself (h1-h6, p, a, ul,
  // section, nav ...), so the node's emitted CSS styles the real element.
  const { tag, attrs } = elementFor(node, text);
  const anchor = anchorFor(node, text);
  return createElement(
    tag,
    {
      "data-cms": node.id,
      "data-cms-island": node.island ? node.type : undefined,
      className: node.className,
      ...(anchor ? { id: anchor } : {}),
      ...attrs,
      ...(decorativeSafe && ["frame", "shape"].includes(node.type) && node.props.decorative === true ? { "aria-hidden": "true" } : {}),
    },
    inner,
  );
}
