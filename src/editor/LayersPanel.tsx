import { Fragment, type ReactElement } from "react";
import type { PageDoc } from "../document/types";
import { childrenOf } from "../document/reduce";

export interface LayersPanelProps {
  doc: PageDoc;
  selection: string | null;
  onSelect: (id: string) => void;
}

/** The section/layer tree. Click a row to select. */
export function LayersPanel({ doc, selection, onSelect }: LayersPanelProps): ReactElement {
  return (
    <div style={{ overflow: "auto", padding: 8, fontSize: 13, fontFamily: "system-ui, sans-serif" }}>
      {doc.sections.map((id) => (
        <LayerRow key={id} doc={doc} id={id} depth={0} selection={selection} onSelect={onSelect} />
      ))}
    </div>
  );
}

interface LayerRowProps extends LayersPanelProps {
  id: string;
  depth: number;
}

function LayerRow({ doc, id, depth, selection, onSelect }: LayerRowProps): ReactElement | null {
  const node = doc.nodes[id];
  if (!node) return null;
  const selected = selection === id;
  return (
    <Fragment>
      <button
        type="button"
        onClick={() => onSelect(id)}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          padding: "4px 8px",
          paddingLeft: 8 + depth * 14,
          background: selected ? "#ede9fe" : "transparent",
          color: selected ? "#5b21b6" : "#334155",
          font: "inherit",
        }}
      >
        <span style={{ opacity: 0.6 }}>{node.type}</span> · {id}
      </button>
      {childrenOf(doc, id).map((child) => (
        <LayerRow
          key={child.id}
          doc={doc}
          id={child.id}
          depth={depth + 1}
          selection={selection}
          onSelect={onSelect}
        />
      ))}
    </Fragment>
  );
}
