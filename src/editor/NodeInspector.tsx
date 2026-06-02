import { type CSSProperties, type ReactElement, type ReactNode } from "react";
import type { Length, Node, StyleProps } from "../document/types";
import type { NodeTransform } from "./EditablePage";

export interface NodeInspectorProps {
  node: Node;
  /** The currently-applied transform for this node (sampled from the active keyframe). */
  transform: NodeTransform;
  /** Live measured size, used as the placeholder when width/height are still "auto". */
  measured: { w: number; h: number };
  /** Patch the node's props (commits through the op-spine → undoable). */
  onProps: (patch: Record<string, unknown>) => void;
  /** Patch the node's base style. */
  onStyle: (patch: Partial<StyleProps>) => void;
  /** Commit a transform (position / size / opacity / scale / rotate) into the active keyframe. */
  onTransform: (t: NodeTransform) => void;
  onRemove: () => void;
  onClose: () => void;
}

const CONTAINER_TYPES = new Set(["section", "frame", "stack", "grid", "shape"]);

/**
 * The on-page element Inspector — a docked properties panel shown while a node
 * is selected in EditMode. Where the floating toolbar handles quick text tweaks,
 * this is the full surface: content, element-specific props (a button's label /
 * link / variant, an image's src / alt, …), exact position + size, and the style
 * box. Every control writes through the op-spine or the active keyframe, so edits
 * are undoable and animatable.
 */
export function NodeInspector({
  node,
  transform,
  measured,
  onProps,
  onStyle,
  onTransform,
  onRemove,
  onClose,
}: NodeInspectorProps): ReactElement {
  const base = node.style.base ?? {};
  const setT = (patch: Partial<NodeTransform>) => onTransform({ ...transform, ...patch });

  // Props rendered with a bespoke control; everything else falls through to the
  // generic key/value editor so any addon's props get controls for free.
  const handled = new Set(["content", "label"]);
  const extraKeys = Object.keys(node.props).filter(
    (k) => !handled.has(k) && ["string", "number", "boolean"].includes(typeof node.props[k]),
  );

  return (
    <div style={panel} onPointerDown={(e) => e.stopPropagation()}>
      <div style={headRow}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <strong style={{ fontSize: 12, textTransform: "capitalize" }}>{node.type}</strong>
          <span style={{ fontSize: 10, opacity: 0.5, fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis" }}>
            {node.id}
          </span>
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" style={{ ...iconBtn, color: "#fca5a5" }} title="Delete element" onClick={onRemove}>🗑</button>
        <button type="button" style={iconBtn} title="Close" onClick={onClose}>✕</button>
      </div>

      <div style={body}>
        {"content" in node.props ? (
          <Group label="Content">
            <textarea
              style={{ ...input, minHeight: 64, resize: "vertical", lineHeight: 1.4 }}
              value={String(node.props.content ?? "")}
              onChange={(e) => onProps({ content: e.target.value })}
            />
          </Group>
        ) : null}

        {"label" in node.props ? (
          <Group label="Label">
            <input style={input} value={String(node.props.label ?? "")} onChange={(e) => onProps({ label: e.target.value })} />
          </Group>
        ) : null}

        {extraKeys.length ? (
          <Group label="Properties">
            {extraKeys.map((k) => (
              <PropField key={k} name={k} value={node.props[k] as string | number | boolean} onChange={(v) => onProps({ [k]: v })} />
            ))}
          </Group>
        ) : null}

        <Group label="Position & size">
          <Row>
            <Num label="X" value={transform.x} placeholder="0" onChange={(v) => setT({ x: v })} />
            <Num label="Y" value={transform.y} placeholder="0" onChange={(v) => setT({ y: v })} />
          </Row>
          <Row>
            <Num label="W" value={transform.w} placeholder={`${Math.round(measured.w)}`} onChange={(v) => setT({ w: v })} />
            <Num label="H" value={transform.h} placeholder={`${Math.round(measured.h)}`} onChange={(v) => setT({ h: v })} />
          </Row>
          <Row>
            <Num label="Scale" value={transform.scale} placeholder="1" step={0.05} onChange={(v) => setT({ scale: v })} />
            <Num label="Rotate" value={transform.rotate} placeholder="0" onChange={(v) => setT({ rotate: v })} />
          </Row>
          <Row>
            <Num label="Opacity" value={transform.opacity} placeholder="1" min={0} max={1} step={0.05} onChange={(v) => setT({ opacity: v })} />
            <button type="button" style={{ ...miniBtn, alignSelf: "end" }} onClick={() => onTransform({})} title="Clear transform">Reset</button>
          </Row>
        </Group>

        {!CONTAINER_TYPES.has(node.type) ? (
          <Group label="Text">
            <Row>
              <Color label="Color" value={base.color ?? "#0f172a"} onChange={(v) => onStyle({ color: v })} />
              <Num label="Size" value={base.fontSize?.value} placeholder="16" onChange={(v) => onStyle({ fontSize: v == null ? undefined : len(v) })} />
            </Row>
            <Row>
              <Sel
                label="Weight"
                value={String(base.fontWeight ?? "")}
                options={[["", "—"], ["400", "Regular"], ["500", "Medium"], ["600", "Semibold"], ["700", "Bold"], ["800", "Heavy"]]}
                onChange={(v) => onStyle({ fontWeight: v ? Number(v) : undefined })}
              />
              <Sel
                label="Align"
                value={base.textAlign ?? ""}
                options={[["", "—"], ["left", "Left"], ["center", "Center"], ["right", "Right"], ["justify", "Justify"]]}
                onChange={(v) => onStyle({ textAlign: (v || undefined) as StyleProps["textAlign"] })}
              />
            </Row>
          </Group>
        ) : null}

        <Group label="Box">
          <Row>
            <Color label="Background" value={hex(base.background)} onChange={(v) => onStyle({ background: v })} />
            <Num label="Radius" value={base.radius?.value} placeholder="0" onChange={(v) => onStyle({ radius: v == null ? undefined : len(v) })} />
          </Row>
          <Row>
            <Num label="Padding" value={base.padding?.value} placeholder="0" onChange={(v) => onStyle({ padding: v == null ? undefined : len(v) })} />
            <Num label="Gap" value={base.gap?.value} placeholder="0" onChange={(v) => onStyle({ gap: v == null ? undefined : len(v) })} />
          </Row>
        </Group>
      </div>
    </div>
  );
}

// ── Small controls ───────────────────────────────────────────────────────────

function Group({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid #1e293b" }}>
      <span style={{ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.5 }}>{label}</span>
      {children}
    </div>
  );
}

function Row({ children }: { children: ReactNode }): ReactElement {
  return <div style={{ display: "flex", gap: 8 }}>{children}</div>;
}

function PropField({ name, value, onChange }: { name: string; value: string | number | boolean; onChange: (v: string | number | boolean) => void }): ReactElement {
  if (typeof value === "boolean") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        <span style={{ textTransform: "capitalize" }}>{name}</span>
      </label>
    );
  }
  if (name === "variant") {
    return <Sel label={name} value={String(value)} options={[["primary", "Primary"], ["ghost", "Ghost"], ["outline", "Outline"]]} onChange={onChange} />;
  }
  const isNum = typeof value === "number";
  return (
    <label style={field}>
      <span style={fieldLabel}>{name}</span>
      <input
        style={input}
        type={isNum ? "number" : "text"}
        value={String(value)}
        onChange={(e) => onChange(isNum ? Number(e.target.value) : e.target.value)}
      />
    </label>
  );
}

function Num({ label, value, placeholder, onChange, step, min, max }: { label: string; value?: number; placeholder?: string; onChange: (v: number | undefined) => void; step?: number; min?: number; max?: number }): ReactElement {
  return (
    <label style={field}>
      <span style={fieldLabel}>{label}</span>
      <input
        style={input}
        type="number"
        step={step}
        min={min}
        max={max}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    </label>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): ReactElement {
  return (
    <label style={field}>
      <span style={fieldLabel}>{label}</span>
      <input style={{ ...input, padding: 2, height: 30 }} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Sel({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (v: string) => void }): ReactElement {
  return (
    <label style={field}>
      <span style={fieldLabel}>{label}</span>
      <select style={input} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

const len = (value: number): Length => ({ value, unit: "px" });
const hex = (v: string | undefined): string => (v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#ffffff");

// ── Styles ───────────────────────────────────────────────────────────────────

const Z = 2147483000;
const panel: CSSProperties = {
  position: "fixed",
  top: 60,
  right: 12,
  bottom: 96,
  width: 264,
  display: "flex",
  flexDirection: "column",
  background: "#0b1220",
  color: "#e2e8f0",
  border: "1px solid #1e293b",
  borderRadius: 12,
  boxShadow: "0 18px 48px -16px rgba(0,0,0,0.6)",
  zIndex: Z + 2,
  fontFamily: "system-ui, sans-serif",
  overflow: "hidden",
};
const headRow: CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid #1e293b" };
const body: CSSProperties = { padding: 12, overflowY: "auto" };
const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 };
const fieldLabel: CSSProperties = { fontSize: 10, opacity: 0.6 };
const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0f172a",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: 6,
  padding: "5px 7px",
  font: "inherit",
  fontSize: 12,
};
const iconBtn: CSSProperties = { background: "transparent", border: "none", color: "#e2e8f0", cursor: "pointer", fontSize: 13, padding: 4, borderRadius: 6 };
const miniBtn: CSSProperties = { font: "inherit", fontSize: 11, color: "#e2e8f0", background: "#334155", border: "1px solid #475569", borderRadius: 6, padding: "5px 10px", cursor: "pointer" };
