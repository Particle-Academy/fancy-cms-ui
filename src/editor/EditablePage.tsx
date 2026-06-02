import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import type { PageDoc, StyleProps } from "../document/types";
import { childrenOf } from "../document/reduce";
import { keyBetween } from "../document/fractional";
import { CmsPage } from "../react/CmsPage";
import { defaultRegistry, type ElementRegistry } from "../react/registry";
import { useEditor } from "./useEditor";

/** Animatable per-node transform (mirrors fancy-motion's NodeState, kept local to avoid a hard dep). */
export interface NodeTransform {
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
}

export interface EditablePageProps {
  doc: PageDoc;
  registry?: ElementRegistry;
  /** Slot for the fancy-motion timeline dock (rendered at the bottom in EditMode). */
  timelineDock?: ReactNode;
  /** Per-node transforms applied to the page (e.g. the sampled keyframe snapshot). */
  transforms?: Record<string, NodeTransform>;
  /** Fired when the user moves/resizes a node — the host writes it into the current keyframe. */
  onNodeTransform?: (id: string, transform: NodeTransform) => void;
  /** Notifies the host of the current selection (e.g. to sync the timeline). */
  onSelect?: (id: string | null) => void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const Z = 2147483000;

/**
 * Inline EditMode over a live, seeded CMS page. Hold **Ctrl+Shift** to reveal
 * the Edit toggle. Editing is on the page: text is edited in place, a floating
 * toolbar styles it, and the selection can be **dragged to move** / **resized**
 * — committed as transforms the host captures into a timeline keyframe.
 */
export function EditablePage({
  doc,
  registry = defaultRegistry,
  timelineDock,
  transforms,
  onNodeTransform,
  onSelect,
}: EditablePageProps): ReactElement {
  const ed = useEditor(doc);
  const [editing, setEditing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const { selection } = ed.state;
  const selNode = selection ? ed.state.doc.nodes[selection] : null;

  useEffect(() => onSelect?.(selection), [selection, onSelect]);

  // Ctrl+Shift reveal gesture.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => setRevealed(e.ctrlKey && e.shiftKey);
    const onBlur = () => setRevealed(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Apply host-provided transforms to the page elements.
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-cms]").forEach((el) => {
      const id = el.dataset.cms;
      const t = id ? transforms?.[id] : undefined;
      if (t) {
        el.style.transform = `translate3d(${t.x ?? 0}px, ${t.y ?? 0}px, 0) scale(${t.scale ?? 1})`;
        el.style.opacity = t.opacity != null ? String(t.opacity) : "";
      } else {
        el.style.transform = "";
        el.style.opacity = "";
      }
    });
  }, [transforms, ed.state.doc]);

  const measureBox = useCallback(() => {
    if (!editing || !selection || !pageRef.current) return setBox(null);
    const el = pageRef.current.querySelector(`[data-cms="${cssEscape(selection)}"]`);
    if (!el) return setBox(null);
    const r = el.getBoundingClientRect();
    setBox({ x: r.left, y: r.top, w: r.width, h: r.height });
  }, [editing, selection]);

  useLayoutEffect(() => {
    measureBox();
    window.addEventListener("scroll", measureBox, { passive: true });
    window.addEventListener("resize", measureBox);
    return () => {
      window.removeEventListener("scroll", measureBox);
      window.removeEventListener("resize", measureBox);
    };
  }, [measureBox, ed.state.doc, transforms]);

  // Inline contentEditable for text nodes.
  useEffect(() => {
    if (!editing || !selection || !pageRef.current || selNode?.type !== "text") return;
    const el = pageRef.current.querySelector<HTMLElement>(`[data-cms="${cssEscape(selection)}"]`);
    if (!el) return;
    el.setAttribute("contenteditable", "true");
    el.style.outline = "none";
    el.focus();
    const commit = () => ed.apply({ t: "set_props", id: selection, patch: { content: el.innerText } });
    el.addEventListener("blur", commit);
    return () => {
      el.removeEventListener("blur", commit);
      el.removeAttribute("contenteditable");
    };
  }, [editing, selection, selNode?.type, ed]);

  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!editing) return;
    const el = (e.target as HTMLElement).closest("[data-cms]");
    if (el) {
      if (el.getAttribute("contenteditable") === "true") return;
      e.preventDefault();
      e.stopPropagation();
      ed.select(el.getAttribute("data-cms"));
    }
  };

  const addText = useCallback(() => {
    const parent = selNode && selNode.type !== "text" ? selNode.id : (ed.state.doc.sections[0] ?? null);
    const siblings = childrenOf(ed.state.doc, parent);
    const order = keyBetween(siblings.length ? siblings[siblings.length - 1]!.order : null, null);
    const id = `n${ed.state.doc.seq + 1}-${Math.floor(performance.now())}`;
    ed.apply({ t: "insert_node", node: { id, type: "text", parent, order, props: { content: "New text" }, style: { base: { color: "inherit" } } } });
    ed.select(id);
  }, [ed, selNode]);

  const setStyle = (patch: Partial<StyleProps>) =>
    selection && ed.apply({ t: "set_style", id: selection, breakpoint: "base", patch });

  return (
    <div style={{ position: "relative" }}>
      <div ref={pageRef} onClickCapture={onClickCapture}>
        <CmsPage doc={ed.state.doc} registry={registry} />
      </div>

      {editing && box && selection ? (
        <SelectionOverlay
          box={box}
          base={transforms?.[selection] ?? {}}
          movable={Boolean(onNodeTransform)}
          getEl={() => pageRef.current?.querySelector<HTMLElement>(`[data-cms="${cssEscape(selection)}"]`) ?? null}
          onTransform={(t) => onNodeTransform?.(selection, t)}
          onLive={measureBox}
        />
      ) : null}

      {editing && box && selNode ? (
        <FloatingToolbar box={box} isText={selNode.type === "text"} base={selNode.style.base} setStyle={setStyle} />
      ) : null}

      {revealed || editing ? (
        <EditBar
          editing={editing}
          onToggle={() => {
            setEditing((v) => !v);
            ed.select(null);
          }}
          canUndo={ed.canUndo}
          canRedo={ed.canRedo}
          onUndo={ed.undo}
          onRedo={ed.redo}
          onAddText={addText}
        />
      ) : null}

      {editing && timelineDock ? <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: Z }}>{timelineDock}</div> : null}
    </div>
  );
}

function SelectionOverlay({
  box,
  base,
  movable,
  getEl,
  onTransform,
  onLive,
}: {
  box: Box;
  base: NodeTransform;
  movable: boolean;
  getEl: () => HTMLElement | null;
  onTransform: (t: NodeTransform) => void;
  onLive: () => void;
}): ReactElement {
  const drag = useRef<{ kind: "move" | "resize"; x: number; y: number; w: number; live: NodeTransform } | null>(null);

  const apply = (t: NodeTransform) => {
    const el = getEl();
    if (el) {
      el.style.transform = `translate3d(${t.x ?? 0}px, ${t.y ?? 0}px, 0) scale(${t.scale ?? 1})`;
      el.style.opacity = t.opacity != null ? String(t.opacity) : "";
    }
  };

  const start = (kind: "move" | "resize") => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind, x: e.clientX, y: e.clientY, w: box.w, live: { ...base } };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "move") {
      d.live = { ...base, x: (base.x ?? 0) + (e.clientX - d.x), y: (base.y ?? 0) + (e.clientY - d.y) };
    } else {
      const factor = Math.max(0.1, (d.w + (e.clientX - d.x)) / d.w);
      d.live = { ...base, scale: Number(((base.scale ?? 1) * factor).toFixed(3)) };
    }
    apply(d.live);
    onLive();
  };
  const end = () => {
    const d = drag.current;
    if (d) onTransform(d.live);
    drag.current = null;
  };

  const outline: CSSProperties = {
    position: "fixed",
    left: box.x - 1,
    top: box.y - 1,
    width: box.w + 2,
    height: box.h + 2,
    outline: "2px solid #8b5cf6",
    borderRadius: 4,
    pointerEvents: "none",
    zIndex: Z,
  };
  const handle: CSSProperties = {
    position: "fixed",
    width: 16,
    height: 16,
    background: "#8b5cf6",
    border: "2px solid #fff",
    borderRadius: 5,
    zIndex: Z + 1,
    touchAction: "none",
  };

  return (
    <>
      <div style={outline} />
      {movable ? (
        <>
          {/* move grip — top-left */}
          <div
            title="Drag to move"
            onPointerDown={start("move")}
            onPointerMove={move}
            onPointerUp={end}
            style={{ ...handle, left: box.x - 9, top: box.y - 9, cursor: "move", borderRadius: 9 }}
          />
          {/* resize — bottom-right */}
          <div
            title="Drag to resize"
            onPointerDown={start("resize")}
            onPointerMove={move}
            onPointerUp={end}
            style={{ ...handle, left: box.x + box.w - 7, top: box.y + box.h - 7, cursor: "nwse-resize" }}
          />
        </>
      ) : null}
    </>
  );
}

function FloatingToolbar({
  box,
  isText,
  base,
  setStyle,
}: {
  box: Box;
  isText: boolean;
  base: Partial<StyleProps>;
  setStyle: (patch: Partial<StyleProps>) => void;
}): ReactElement {
  const wrap: CSSProperties = {
    position: "fixed",
    left: box.x,
    top: Math.max(8, box.y - 46),
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    background: "#0f172a",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 999,
    boxShadow: "0 8px 24px -8px rgba(0,0,0,0.5)",
    zIndex: Z + 2,
    fontFamily: "system-ui, sans-serif",
    fontSize: 12,
  };
  const swatch: CSSProperties = { width: 22, height: 22, border: "none", background: "transparent", padding: 0, cursor: "pointer" };
  const num: CSSProperties = { width: 52, background: "#1e293b", color: "#fff", border: "1px solid #334155", borderRadius: 6, padding: "3px 6px", font: "inherit" };
  return (
    <div style={wrap} onMouseDown={(e) => e.preventDefault()}>
      {isText ? (
        <label title="Text color" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ opacity: 0.7 }}>A</span>
          <input type="color" style={swatch} value={base.color ?? "#0f172a"} onChange={(e) => setStyle({ color: e.target.value })} />
        </label>
      ) : null}
      {isText ? (
        <input type="number" title="Font size (px)" style={num} placeholder="size" value={base.fontSize?.value ?? ""} onChange={(e) => setStyle({ fontSize: { value: Number(e.target.value) || 0, unit: "px" } })} />
      ) : null}
      <label title="Background" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span style={{ opacity: 0.7 }}>BG</span>
        <input type="color" style={swatch} value={normalizeColor(base.background)} onChange={(e) => setStyle({ background: e.target.value })} />
      </label>
    </div>
  );
}

function EditBar({
  editing,
  onToggle,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddText,
}: {
  editing: boolean;
  onToggle: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddText: () => void;
}): ReactElement {
  const bar: CSSProperties = { position: "fixed", top: 12, right: 12, display: "flex", gap: 6, alignItems: "center", padding: 6, background: "#0f172a", color: "#fff", borderRadius: 999, boxShadow: "0 8px 24px -8px rgba(0,0,0,0.4)", zIndex: Z + 3, fontFamily: "system-ui, sans-serif", fontSize: 12 };
  const btn: CSSProperties = { font: "inherit", border: "none", background: "transparent", color: "inherit", cursor: "pointer", padding: "4px 8px", borderRadius: 999 };
  return (
    <div style={bar}>
      <button type="button" style={{ ...btn, background: editing ? "#8b5cf6" : "transparent" }} onClick={onToggle}>
        {editing ? "● Editing" : "Edit"}
      </button>
      {editing ? (
        <>
          <button type="button" style={btn} onClick={onAddText} title="Add a text element">＋ Text</button>
          <button type="button" style={{ ...btn, opacity: canUndo ? 1 : 0.4 }} disabled={!canUndo} onClick={onUndo}>↶</button>
          <button type="button" style={{ ...btn, opacity: canRedo ? 1 : 0.4 }} disabled={!canRedo} onClick={onRedo}>↷</button>
        </>
      ) : null}
    </div>
  );
}

function normalizeColor(v: string | undefined): string {
  return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#ffffff";
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}
