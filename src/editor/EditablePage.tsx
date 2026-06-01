import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import type { PageDoc, StyleProps } from "../document/types";
import { childrenOf } from "../document/reduce";
import { keyBetween } from "../document/fractional";
import { CmsPage } from "../react/CmsPage";
import { defaultRegistry, type ElementRegistry } from "../react/registry";
import { useEditor } from "./useEditor";

export interface EditablePageProps {
  /** Seeded document (read-only demo: edits are in-memory, never persisted). */
  doc: PageDoc;
  registry?: ElementRegistry;
  /** Slot for the fancy-motion timeline dock (rendered at the bottom in EditMode). */
  timelineDock?: ReactNode;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const Z = 2147483000;

/**
 * Inline EditMode over a live, seeded CMS page. The Edit affordance is hidden
 * until you hold **Ctrl+Shift** (reveal gesture). Editing is **on the page**:
 * text is edited in place (contentEditable) and a compact **floating toolbar**
 * (dark, dark-mode-safe) sits above the selection for styling — no side flyout.
 * Read-only: edits live in memory, never saved.
 */
export function EditablePage({
  doc,
  registry = defaultRegistry,
  timelineDock,
}: EditablePageProps): ReactElement {
  const ed = useEditor(doc);
  const [editing, setEditing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const { selection } = ed.state;
  const selNode = selection ? ed.state.doc.nodes[selection] : null;

  // Ctrl+Shift reveal gesture for the Edit affordance.
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

  // Track the selection box (fixed-positioned, follows scroll/resize).
  useLayoutEffect(() => {
    if (!editing || !selection || !pageRef.current) {
      setBox(null);
      return;
    }
    const update = () => {
      const el = pageRef.current?.querySelector(`[data-cms="${cssEscape(selection)}"]`);
      if (!el) return setBox(null);
      const r = el.getBoundingClientRect();
      setBox({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [editing, selection, ed.state.doc]);

  // Inline contentEditable: when a text node is selected, make its element
  // editable in place; commit to the doc on blur (so React doesn't fight the caret).
  useEffect(() => {
    if (!editing || !selection || !pageRef.current) return;
    if (selNode?.type !== "text") return;
    const el = pageRef.current.querySelector<HTMLElement>(`[data-cms="${cssEscape(selection)}"]`);
    if (!el) return;
    el.setAttribute("contenteditable", "true");
    el.style.outline = "none";
    el.focus();
    const commit = () => {
      ed.apply({ t: "set_props", id: selection, patch: { content: el.innerText } });
    };
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
      // let an already-editing text element keep the caret on its own clicks
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
    ed.apply({
      t: "insert_node",
      node: { id, type: "text", parent, order, props: { content: "New text" }, style: { base: { color: "inherit" } } },
    });
    ed.select(id);
  }, [ed, selNode]);

  const setStyle = (patch: Partial<StyleProps>) =>
    selection && ed.apply({ t: "set_style", id: selection, breakpoint: "base", patch });

  return (
    <div style={{ position: "relative" }}>
      <div ref={pageRef} onClickCapture={onClickCapture}>
        <CmsPage doc={ed.state.doc} registry={registry} />
      </div>

      {/* selection outline */}
      {editing && box ? (
        <div
          style={{
            position: "fixed",
            left: box.x - 1,
            top: box.y - 1,
            width: box.w + 2,
            height: box.h + 2,
            outline: "2px solid #8b5cf6",
            borderRadius: 4,
            pointerEvents: "none",
            zIndex: Z,
          }}
        />
      ) : null}

      {/* floating toolbar above the selection (dark — dark-mode safe) */}
      {editing && box && selNode ? (
        <FloatingToolbar box={box} isText={selNode.type === "text"} base={selNode.style.base} setStyle={setStyle} />
      ) : null}

      {/* reveal-gated edit affordance / toolbar */}
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

      {editing && timelineDock ? (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: Z }}>{timelineDock}</div>
      ) : null}
    </div>
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
  const top = Math.max(8, box.y - 46);
  const wrap: CSSProperties = {
    position: "fixed",
    left: box.x,
    top,
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
    <div style={wrap} onMouseDown={(e) => e.preventDefault() /* keep selection */}>
      {isText ? (
        <label title="Text color" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ opacity: 0.7 }}>A</span>
          <input type="color" style={swatch} value={base.color ?? "#0f172a"} onChange={(e) => setStyle({ color: e.target.value })} />
        </label>
      ) : null}
      {isText ? (
        <input
          type="number"
          title="Font size (px)"
          style={num}
          placeholder="size"
          value={base.fontSize?.value ?? ""}
          onChange={(e) => setStyle({ fontSize: { value: Number(e.target.value) || 0, unit: "px" } })}
        />
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
  const bar: CSSProperties = {
    position: "fixed",
    top: 12,
    right: 12,
    display: "flex",
    gap: 6,
    alignItems: "center",
    padding: 6,
    background: "#0f172a",
    color: "#fff",
    borderRadius: 999,
    boxShadow: "0 8px 24px -8px rgba(0,0,0,0.4)",
    zIndex: Z + 3,
    fontFamily: "system-ui, sans-serif",
    fontSize: 12,
  };
  const btn: CSSProperties = { font: "inherit", border: "none", background: "transparent", color: "inherit", cursor: "pointer", padding: "4px 8px", borderRadius: 999 };
  return (
    <div style={bar}>
      <button type="button" style={{ ...btn, background: editing ? "#8b5cf6" : "transparent" }} onClick={onToggle}>
        {editing ? "● Editing" : "Edit"}
      </button>
      {editing ? (
        <>
          <button type="button" style={btn} onClick={onAddText} title="Add a text element">
            ＋ Text
          </button>
          <button type="button" style={{ ...btn, opacity: canUndo ? 1 : 0.4 }} disabled={!canUndo} onClick={onUndo}>
            ↶
          </button>
          <button type="button" style={{ ...btn, opacity: canRedo ? 1 : 0.4 }} disabled={!canRedo} onClick={onRedo}>
            ↷
          </button>
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
