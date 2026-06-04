import type { ReactElement } from "react";
import type { Bound, Json, PageDoc } from "../document/types";
import { childrenOf } from "../document/reduce";
import { defaultRegistry, resolveValue, type DataContext, type ElementRegistry } from "./registry";

export interface RenderNodeProps {
  doc: PageDoc;
  id: string;
  registry?: ElementRegistry;
  /** Data context bindings resolve against (page data + any repeater scope). */
  data?: DataContext;
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
export function RenderNode({ doc, id, registry = defaultRegistry, data }: RenderNodeProps): ReactElement | null {
  const node = doc.nodes[id];
  if (!node) return null;

  if (node.type === "repeater") {
    const arr = resolveValue(node.props.items as Bound<Json> | undefined, data);
    const items = Array.isArray(arr) ? arr : [];
    const template = childrenOf(doc, id)[0];
    return (
      <div data-cms={node.id} className={node.className}>
        {template
          ? items.map((item, index) => (
              <RenderNode key={index} doc={doc} id={template.id} registry={registry} data={{ ...data, item, index }} />
            ))
          : null}
      </div>
    );
  }

  const kids = childrenOf(doc, id).map((child) => (
    <RenderNode key={child.id} doc={doc} id={child.id} registry={registry} data={data} />
  ));

  const resolve = (v: Bound<Json> | undefined) => resolveValue(v, data);
  const text = (v: Bound<Json> | undefined): string => {
    const r = resolve(v);
    return r === undefined || r === null ? "" : String(r);
  };

  const renderer = registry[node.type];
  const inner = renderer ? renderer({ node, doc, children: kids, data, resolve, text }) : node.island ? null : kids;

  return (
    <div data-cms={node.id} data-cms-island={node.island ? node.type : undefined} className={node.className}>
      {inner}
    </div>
  );
}
