import { useId, type ChangeEvent, type CSSProperties, type ReactElement } from "react";
import type { PageDoc, StyleProps } from "../document/types";
import type { PageOp } from "../document/ops";
import type { InspectorDrafts, DraftField } from "./InspectorDrafts";
import { IconFields } from "./IconFields";

export interface InspectorProps {
  doc: PageDoc;
  selection: string | null;
  apply: (op: PageOp) => void;
  drafts?: InspectorDrafts;
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
export function Inspector({ doc, selection, apply, drafts }: InspectorProps): ReactElement {
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

  const nodeId = node.id;
  const bind = (name: string, read: (item: PageDoc["nodes"][string]) => string, op: (raw: string) => PageOp, numeric = false) => {
    const key = JSON.stringify([nodeId, name]);
    const field: DraftField = {
      key, label: `${nodeId} / ${name}`, op,
      read: (next) => { const item = next.nodes[nodeId]; return item ? read(item) : undefined; },
      canonical: numeric ? (raw) => String(Number(raw) || 0) : (raw) => raw,
    };
    const accepted = read(node);
    return {
      value: drafts ? drafts.value(key, accepted) : accepted,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (drafts) drafts.change(field, event.target.value); else apply(op(event.target.value));
      },
      onFocus: () => drafts?.focus(key),
      onBlur: () => drafts?.blur(key),
      onCompositionStart: () => drafts?.composition(key, true),
      onCompositionEnd: () => drafts?.composition(key, false),
    };
  };
  const prop = (key: string) => bind(key, (item) => typeof item.props[key] === "string" ? item.props[key] as string : "", (raw) => ({ t: "set_node_props", id: nodeId, patch: { [key]: raw } }));
  const style = (key: "background" | "color") => bind(key, (item) => item.style.base[key] ?? "", (raw) => ({ t: "set_style", id: nodeId, breakpoint: "base", patch: { [key]: raw } }));
  const length = (key: "fontSize" | "padding") => bind(key, (item) => item.style.base[key]?.value?.toString() ?? "", (raw) => ({ t: "set_style", id: nodeId, breakpoint: "base", patch: { [key]: { value: Number(raw) || 0, unit: "px" } } as Partial<StyleProps> }), true);

  return (
    <div style={{ overflow: "auto", padding: 16, fontFamily: "system-ui, sans-serif", height: "100%", boxSizing: "border-box" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fcms-fg)" }}>{node.type}</div>
      <div style={{ fontSize: 11, color: "var(--fcms-muted)", marginBottom: 8 }}>{node.id}</div>

      {node.type === "icon" ? <IconFields props={node.props} onChange={(patch) => apply({ t: "set_node_props", id: nodeId, patch })} /> : null}

      {node.type === "text" ? (
        <>
          <label style={label} htmlFor={fieldId("content")}>Content</label>
          <textarea
            id={fieldId("content")}
            data-cms-field="content"
            style={{ ...input, minHeight: 64, resize: "vertical" }}
            {...prop("content")}
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
            {...prop("src")}
          />
        </>
      ) : null}

      <label style={label} htmlFor={fieldId("background")}>Background</label>
      <input
        id={fieldId("background")}
        data-cms-field="background"
        style={input}
        placeholder="#ffffff | gradient | url(…)"
        {...style("background")}
      />

      <label style={label} htmlFor={fieldId("color")}>Text color</label>
      <input
        id={fieldId("color")}
        data-cms-field="color"
        style={input}
        placeholder="#0f172a"
        {...style("color")}
      />

      <label style={label} htmlFor={fieldId("fontSize")}>Font size (px)</label>
      <input
        id={fieldId("fontSize")}
        data-cms-field="fontSize"
        type="number"
        style={input}
        {...length("fontSize")}
      />

      <label style={label} htmlFor={fieldId("padding")}>Padding (px)</label>
      <input
        id={fieldId("padding")}
        data-cms-field="padding"
        type="number"
        style={input}
        {...length("padding")}
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
        {...bind("opacity", (item) => item.style.base.opacity?.toString() ?? "", (raw) => ({ t: "set_style", id: nodeId, breakpoint: "base", patch: { opacity: Number(raw) } }), true)}
      />
    </div>
  );
}
