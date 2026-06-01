import type { ReactElement } from "react";
import type { PageDoc } from "../document/types";
import { childrenOf } from "../document/reduce";
import { defaultRegistry, type ElementRegistry } from "./registry";

export interface RenderNodeProps {
  doc: PageDoc;
  id: string;
  registry?: ElementRegistry;
}

/**
 * Render one node (and its subtree) to a `[data-cms]`-tagged element. The CSS
 * emitted by `emitDocCss` targets these `data-cms` handles. Interactive /
 * 3rd-party **islands** with no registered renderer become an empty, sized
 * placeholder the host hydrates client-side — mirroring the PHP renderer.
 */
export function RenderNode({ doc, id, registry = defaultRegistry }: RenderNodeProps): ReactElement | null {
  const node = doc.nodes[id];
  if (!node) return null;

  const kids = childrenOf(doc, id).map((child) => (
    <RenderNode key={child.id} doc={doc} id={child.id} registry={registry} />
  ));

  const renderer = registry[node.type];
  const inner = renderer ? renderer({ node, doc, children: kids }) : node.island ? null : kids;

  return (
    <div data-cms={node.id} data-cms-island={node.island ? node.type : undefined}>
      {inner}
    </div>
  );
}
