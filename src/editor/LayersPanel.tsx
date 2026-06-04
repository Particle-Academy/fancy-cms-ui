import { Fragment, useState, type DragEvent as ReactDragEvent, type ReactElement } from "react";
import type { NodeId, PageDoc } from "../document/types";
import { childrenOf } from "../document/reduce";
import { keyBetween } from "../document/fractional";

export interface LayersPanelProps {
  doc: PageDoc;
  selection: string | null;
  onSelect: (id: string) => void;
  /** Reparent/reorder a node (drag-to-reorder). Omit to disable dragging. */
  onMove?: (id: NodeId, parent: NodeId | null, order: string) => void;
}

const MIME = "application/x-cms-node";

/** True when `maybeAncestor` is `id` itself or one of its ancestors. */
function isAncestorOrSelf(doc: PageDoc, id: string, maybeAncestor: string): boolean {
  for (let cur: string | null = id; cur; cur = doc.nodes[cur]?.parent ?? null) {
    if (cur === maybeAncestor) return true;
  }
  return false;
}

/** The section/layer tree. Click a row to select; drag a row onto another to reorder. */
export function LayersPanel({ doc, selection, onSelect, onMove }: LayersPanelProps): ReactElement {
  const [overId, setOverId] = useState<string | null>(null);

  return (
    <div style={{ overflow: "auto", padding: 8, fontSize: 13, fontFamily: "system-ui, sans-serif" }}>
      {doc.sections.map((id) => (
        <LayerRow key={id} doc={doc} id={id} depth={0} selection={selection} onSelect={onSelect} onMove={onMove} overId={overId} setOverId={setOverId} />
      ))}
    </div>
  );
}

interface LayerRowProps {
  doc: PageDoc;
  id: string;
  depth: number;
  selection: string | null;
  onSelect: (id: string) => void;
  onMove?: (id: NodeId, parent: NodeId | null, order: string) => void;
  overId: string | null;
  setOverId: (id: string | null) => void;
}

function LayerRow({ doc, id, depth, selection, onSelect, onMove, overId, setOverId }: LayerRowProps): ReactElement | null {
  const node = doc.nodes[id];
  if (!node) return null;
  const selected = selection === id;
  const draggable = Boolean(onMove);

  const drop = (e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOverId(null);
    if (!onMove) return;
    const dragId = e.dataTransfer.getData(MIME);
    // Reject no-op + any move that would drop a node into its own subtree.
    if (!dragId || dragId === id || isAncestorOrSelf(doc, id, dragId)) return;
    // Place the dragged node immediately after this row, among this row's siblings.
    const siblings = childrenOf(doc, node.parent);
    const idx = siblings.findIndex((n) => n.id === id);
    const next = siblings[idx + 1];
    onMove(dragId, node.parent, keyBetween(node.order, next ? next.order : null));
  };

  return (
    <Fragment>
      <button
        type="button"
        draggable={draggable}
        onClick={() => onSelect(id)}
        onDragStart={(e) => {
          e.dataTransfer.setData(MIME, id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          if (!onMove) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (overId !== id) setOverId(id);
        }}
        onDragLeave={() => overId === id && setOverId(null)}
        onDrop={drop}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          border: "none",
          borderRadius: 6,
          cursor: draggable ? "grab" : "pointer",
          padding: "4px 8px",
          paddingLeft: 8 + depth * 14,
          background: selected ? "#ede9fe" : "transparent",
          color: selected ? "#5b21b6" : "#334155",
          font: "inherit",
          boxShadow: overId === id ? "inset 0 -2px 0 0 #8b5cf6" : "none",
        }}
      >
        <span style={{ opacity: 0.6 }}>{node.type}</span> · {id}
      </button>
      {childrenOf(doc, id).map((child) => (
        <LayerRow key={child.id} doc={doc} id={child.id} depth={depth + 1} selection={selection} onSelect={onSelect} onMove={onMove} overId={overId} setOverId={setOverId} />
      ))}
    </Fragment>
  );
}
