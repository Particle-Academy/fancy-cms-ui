import { useId, type CSSProperties, type ReactElement } from "react";
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
  color: "var(--fcms-muted)",
  margin: "10px 0 4px",
};
const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--fcms-border)",
  background: "var(--fcms-input-bg)",
  color: "var(--fcms-fg)",
  font: "inherit",
  fontSize: 13,
};

/**
 * Contextual property editor for the selected node. Every change is one op.
 *
 * Each `<label>` here is a SIBLING of its control rather than wrapping it, so
 * none of them were associated: clicking a label focused nothing and a screen
 * reader announced the panel as unlabelled boxes. (`NodeInspector` wraps its
 * controls, which associates them implicitly — these did not.)
 *
 * `htmlFor`/`id` fixes that, and `data-cms-field` gives each control the stable
 * handle the Human+ contract asks for so an agent addresses a field by name
 * instead of guessing at the DOM.
 */
export function Inspector({ doc, selection, apply }: InspectorProps): ReactElement {
  // Before the early return — every hook must run on every render. fancy-flow
  // shipped a blank-editor crash by getting this wrong in the same shape of
  // component.
  const uid = useId();
  const fieldId = (key: string) => `${uid}-${key}`;

  const node = selection ? doc.nodes[selection] : null;
  if (!node) {
    return (
      <div style={{ padding: 16, color: "var(--fcms-muted)", fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
        Select an element to edit.
      </div>
    );
  }

  const s = node.style.base;
  const setStyle = (patch: Partial<StyleProps>) =>
    apply({ t: "set_style", id: node.id, breakpoint: "base", patch });
  const setProp = (key: string, value: unknown) =>
    apply({ t: "set_node_props", id: node.id, patch: { [key]: value } });

  return (
    <div style={{ overflow: "auto", padding: 16, fontFamily: "system-ui, sans-serif", height: "100%", boxSizing: "border-box" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fcms-fg)" }}>{node.type}</div>
      <div style={{ fontSize: 11, color: "var(--fcms-muted)", marginBottom: 8 }}>{node.id}</div>

      {node.type === "text" ? (
        <>
          <label style={label} htmlFor={fieldId("content")}>Content</label>
          <textarea
            id={fieldId("content")}
            data-cms-field="content"
            style={{ ...input, minHeight: 64, resize: "vertical" }}
            value={typeof node.props.content === "string" ? node.props.content : ""}
            onChange={(e) => setProp("content", e.target.value)}
          />
        </>
      ) : null}

      {node.type === "image" ? (
        <>
          <label style={label} htmlFor={fieldId("src")}>Source</label>
          <input
            id={fieldId("src")}
            data-cms-field="src"
            style={input}
            value={typeof node.props.src === "string" ? node.props.src : ""}
            onChange={(e) => setProp("src", e.target.value)}
          />
        </>
      ) : null}

      <label style={label} htmlFor={fieldId("background")}>Background</label>
      <input
        id={fieldId("background")}
        data-cms-field="background"
        style={input}
        placeholder="#ffffff | gradient | url(…)"
        value={s.background ?? ""}
        onChange={(e) => setStyle({ background: e.target.value })}
      />

      <label style={label} htmlFor={fieldId("color")}>Text color</label>
      <input
        id={fieldId("color")}
        data-cms-field="color"
        style={input}
        placeholder="#0f172a"
        value={s.color ?? ""}
        onChange={(e) => setStyle({ color: e.target.value })}
      />

      <label style={label} htmlFor={fieldId("fontSize")}>Font size (px)</label>
      <input
        id={fieldId("fontSize")}
        data-cms-field="fontSize"
        type="number"
        style={input}
        value={s.fontSize?.value ?? ""}
        onChange={(e) => setStyle({ fontSize: { value: Number(e.target.value) || 0, unit: "px" } })}
      />

      <label style={label} htmlFor={fieldId("padding")}>Padding (px)</label>
      <input
        id={fieldId("padding")}
        data-cms-field="padding"
        type="number"
        style={input}
        value={s.padding?.value ?? ""}
        onChange={(e) => setStyle({ padding: { value: Number(e.target.value) || 0, unit: "px" } })}
      />

      <label style={label} htmlFor={fieldId("opacity")}>Opacity</label>
      <input
        id={fieldId("opacity")}
        data-cms-field="opacity"
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
