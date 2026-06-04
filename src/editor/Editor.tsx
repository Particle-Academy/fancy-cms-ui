import { useEffect, useRef, type CSSProperties, type ReactElement } from "react";
import type { PageDoc } from "../document/types";
import { useEditor, type EditorApi } from "./useEditor";
import { Canvas } from "./Canvas";
import { LayersPanel } from "./LayersPanel";
import { Inspector } from "./Inspector";

export interface EditorProps {
  /** Initial document; edits are surfaced via {@link EditorProps.onChange}. */
  defaultValue: PageDoc;
  onChange?: (doc: PageDoc) => void;
}

/**
 * The fancy-cms editor: layers · canvas · inspector over the op-spine. Phase 1
 * cut — chrome is plain markup for now; it graduates to react-fancy next.
 */
export function Editor({ defaultValue, onChange }: EditorProps): ReactElement {
  const ed = useEditor(defaultValue);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onChange?.(ed.state.doc);
  }, [ed.state.doc, onChange]);

  const shell: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "220px 1fr 300px",
    height: "100%",
    minHeight: 0,
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
  };

  return (
    <div style={shell}>
      <div style={{ borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Toolbar ed={ed} />
        <LayersPanel
          doc={ed.state.doc}
          selection={ed.state.selection}
          onSelect={ed.select}
          onMove={(id, parent, order) => ed.apply({ t: "move_node", id, parent, order })}
        />
      </div>
      <Canvas doc={ed.state.doc} selection={ed.state.selection} onSelect={ed.select} apply={ed.apply} />
      <div style={{ borderLeft: "1px solid #e2e8f0", minHeight: 0 }}>
        <Inspector doc={ed.state.doc} selection={ed.state.selection} apply={ed.apply} />
      </div>
    </div>
  );
}

function Toolbar({ ed }: { ed: EditorApi }): ReactElement {
  const btn: CSSProperties = {
    font: "inherit",
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
  };
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        padding: 8,
        borderBottom: "1px solid #e2e8f0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <button type="button" style={{ ...btn, opacity: ed.canUndo ? 1 : 0.4 }} disabled={!ed.canUndo} onClick={ed.undo}>
        Undo
      </button>
      <button type="button" style={{ ...btn, opacity: ed.canRedo ? 1 : 0.4 }} disabled={!ed.canRedo} onClick={ed.redo}>
        Redo
      </button>
    </div>
  );
}
