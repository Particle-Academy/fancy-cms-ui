import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import type { PageDoc } from "../document/types";
import { CmsPage } from "../react/CmsPage";
import { defaultRegistry, type ElementRegistry } from "../react/registry";
import { useEditor } from "./useEditor";
import { Inspector } from "./Inspector";

export interface EditablePageProps {
  /** Seeded document (read-only demo: edits are in-memory, never persisted). */
  doc: PageDoc;
  registry?: ElementRegistry;
  /** Start in EditMode. */
  defaultEditing?: boolean;
  /** Slot for the fancy-motion timeline dock (mounted at the bottom in EditMode). */
  timelineDock?: ReactNode;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Inline EditMode over a live, seeded CMS page — the sandbox's "the site IS the
 * demo" surface. The page renders normally (CmsPage); toggling EditMode reveals
 * selection + an inspector, and (when provided) the fancy-motion timeline dock
 * at the bottom. Read-only: edits live in memory, never saved.
 */
export function EditablePage({
  doc,
  registry = defaultRegistry,
  defaultEditing = false,
  timelineDock,
}: EditablePageProps): ReactElement {
  const ed = useEditor(doc);
  const [editing, setEditing] = useState(defaultEditing);
  const pageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const { selection } = ed.state;

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

  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!editing) return;
    const el = (e.target as HTMLElement).closest("[data-cms]");
    if (el) {
      e.preventDefault();
      e.stopPropagation();
      ed.select(el.getAttribute("data-cms"));
    }
  };

  const outline: CSSProperties | null = box
    ? {
        position: "fixed",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        outline: "2px solid #8b5cf6",
        outlineOffset: -1,
        pointerEvents: "none",
        zIndex: 2147483000,
      }
    : null;

  return (
    <div style={{ position: "relative" }}>
      <div ref={pageRef} onClickCapture={onClickCapture}>
        <CmsPage doc={ed.state.doc} registry={registry} />
      </div>

      {editing && outline ? <div style={outline} /> : null}

      <EditBar
        editing={editing}
        onToggle={() => setEditing((v) => !v)}
        canUndo={ed.canUndo}
        canRedo={ed.canRedo}
        onUndo={ed.undo}
        onRedo={ed.redo}
        hasDock={Boolean(timelineDock)}
      />

      {editing && selection ? (
        <aside style={inspectorPanel}>
          <Inspector doc={ed.state.doc} selection={selection} apply={ed.apply} />
        </aside>
      ) : null}

      {editing && timelineDock ? <div style={dockSlot}>{timelineDock}</div> : null}
    </div>
  );
}

const inspectorPanel: CSSProperties = {
  position: "fixed",
  top: 56,
  right: 12,
  bottom: 12,
  width: 300,
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  boxShadow: "0 10px 30px -10px rgba(0,0,0,0.25)",
  overflow: "auto",
  zIndex: 2147483001,
};

const dockSlot: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 2147483000,
};

function EditBar({
  editing,
  onToggle,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasDock,
}: {
  editing: boolean;
  onToggle: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hasDock: boolean;
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
    zIndex: 2147483002,
    fontFamily: "system-ui, sans-serif",
    fontSize: 12,
  };
  const btn: CSSProperties = {
    font: "inherit",
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: 999,
  };
  return (
    <div style={bar}>
      <button type="button" style={{ ...btn, background: editing ? "#8b5cf6" : "transparent" }} onClick={onToggle}>
        {editing ? "● Editing" : "Edit"}
      </button>
      {editing ? (
        <>
          <button type="button" style={{ ...btn, opacity: canUndo ? 1 : 0.4 }} disabled={!canUndo} onClick={onUndo}>
            ↶
          </button>
          <button type="button" style={{ ...btn, opacity: canRedo ? 1 : 0.4 }} disabled={!canRedo} onClick={onRedo}>
            ↷
          </button>
          {!hasDock ? <span style={{ opacity: 0.5, paddingRight: 6 }}>timeline: fancy-motion →</span> : null}
        </>
      ) : null}
    </div>
  );
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}
