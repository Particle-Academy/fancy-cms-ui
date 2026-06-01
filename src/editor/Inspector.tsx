import type { CSSProperties, ReactElement } from "react";
import type { PageDoc, StyleProps } from "../document/types";
import type { PageOp } from "../document/ops";

export interface InspectorProps {
  doc: PageDoc;
  selection: string | null;
  apply: (op: PageOp) => void;
}

const label: CSSProperties = {
  display: "block",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#94a3b8",
  margin: "10px 0 4px",
};
const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid #e2e8f0",
  font: "inherit",
  fontSize: 13,
};

/** Contextual property editor for the selected node. Every change is one op. */
export function Inspector({ doc, selection, apply }: InspectorProps): ReactElement {
  const node = selection ? doc.nodes[selection] : null;
  if (!node) {
    return (
      <div style={{ padding: 16, color: "#94a3b8", fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
        Select an element to edit.
      </div>
    );
  }

  const s = node.style.base;
  const setStyle = (patch: Partial<StyleProps>) =>
    apply({ t: "set_style", id: node.id, breakpoint: "base", patch });
  const setProp = (key: string, value: unknown) =>
    apply({ t: "set_props", id: node.id, patch: { [key]: value } });

  return (
    <div style={{ overflow: "auto", padding: 16, fontFamily: "system-ui, sans-serif", height: "100%", boxSizing: "border-box" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{node.type}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>{node.id}</div>

      {node.type === "text" ? (
        <>
          <label style={label}>Content</label>
          <textarea
            style={{ ...input, minHeight: 64, resize: "vertical" }}
            value={typeof node.props.content === "string" ? node.props.content : ""}
            onChange={(e) => setProp("content", e.target.value)}
          />
        </>
      ) : null}

      {node.type === "image" ? (
        <>
          <label style={label}>Source</label>
          <input
            style={input}
            value={typeof node.props.src === "string" ? node.props.src : ""}
            onChange={(e) => setProp("src", e.target.value)}
          />
        </>
      ) : null}

      <label style={label}>Background</label>
      <input
        style={input}
        placeholder="#ffffff | gradient | url(…)"
        value={s.background ?? ""}
        onChange={(e) => setStyle({ background: e.target.value })}
      />

      <label style={label}>Text color</label>
      <input
        style={input}
        placeholder="#0f172a"
        value={s.color ?? ""}
        onChange={(e) => setStyle({ color: e.target.value })}
      />

      <label style={label}>Font size (px)</label>
      <input
        type="number"
        style={input}
        value={s.fontSize?.value ?? ""}
        onChange={(e) => setStyle({ fontSize: { value: Number(e.target.value) || 0, unit: "px" } })}
      />

      <label style={label}>Padding (px)</label>
      <input
        type="number"
        style={input}
        value={s.padding?.value ?? ""}
        onChange={(e) => setStyle({ padding: { value: Number(e.target.value) || 0, unit: "px" } })}
      />

      <label style={label}>Opacity</label>
      <input
        type="number"
        step="0.1"
        min="0"
        max="1"
        style={input}
        value={s.opacity ?? ""}
        onChange={(e) => setStyle({ opacity: Number(e.target.value) })}
      />
    </div>
  );
}
