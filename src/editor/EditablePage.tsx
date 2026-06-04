import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { ContextMenu } from "@particle-academy/react-fancy";
import type { Json, LayoutMode, NodeId, PageDoc, StyleProps } from "../document/types";
import type { PageOp } from "../document/ops";
import { childrenOf } from "../document/reduce";
import { keyBetween } from "../document/fractional";
import { CmsPage } from "../react/CmsPage";
import { defaultRegistry, type DataContext, type ElementRegistry } from "../react/registry";
import { NodeInspector } from "./NodeInspector";
import { duplicateOps, pasteOps, reorderOps, snapshotSubtree, wrapInBoxOps, type NodeMap, type ReorderDir } from "./editorOps";
import { useEditor } from "./useEditor";

/** Animatable per-node transform (mirrors fancy-motion's NodeState, kept local to avoid a hard dep). */
export interface NodeTransform {
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
  rotate?: number;
  /** Explicit size in px (a true resize, distinct from `scale`). Absent = auto. */
  w?: number;
  h?: number;
}

export interface EditablePageProps {
  doc: PageDoc;
  registry?: ElementRegistry;
  /** Data context for `{ $bind }` props + repeaters (server props, etc.). */
  data?: DataContext;
  /** Slot for the fancy-motion timeline dock (rendered at the bottom in EditMode). */
  timelineDock?: ReactNode;
  /** Per-node transforms applied to the page (e.g. the sampled keyframe snapshot). */
  transforms?: Record<string, NodeTransform>;
  /** Fired when the user moves/resizes a node — the host writes it into the current keyframe. */
  onNodeTransform?: (id: string, transform: NodeTransform) => void;
  /** Notifies the host of the current selection (e.g. to sync the timeline). */
  onSelect?: (id: string | null) => void;
  /** Scroll length in viewports — the page becomes a tall scroll canvas (extend via the timeline). */
  frames?: number;
  /** Scroll progress 0..1 (scroll = the timeline playhead). The host maps it to transforms. */
  onProgress?: (progress: number) => void;
  /**
   * Pin the page into a scroll canvas (the `frames`×viewport spacer + sticky pin
   * that turns scroll into the playhead). Default `true`. Set **false** for a
   * full multi-section page that should scroll naturally — animation is then
   * driven by the dock scrub + Play preview instead of raw scroll.
   */
  pinned?: boolean;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const Z = 2147483000;
/** Snap distance (px) for drag alignment to other elements' edges/centers. */
const SNAP = 6;

/**
 * Inline EditMode over a live, seeded CMS page. Hold **Ctrl+Shift** to reveal
 * the Edit toggle. Editing is on the page: text is edited in place, a floating
 * toolbar styles it, and the selection can be **dragged to move** / **resized**
 * — committed as transforms the host captures into a timeline keyframe.
 */
export function EditablePage({
  doc,
  registry = defaultRegistry,
  data,
  timelineDock,
  transforms,
  onNodeTransform,
  onSelect,
  frames = 1,
  onProgress,
  pinned = true,
}: EditablePageProps): ReactElement {
  const ed = useEditor(doc);
  const [editing, setEditing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
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
      applyTransform(el, t);
    });
  }, [transforms, ed.state.doc]);

  // Scroll = the timeline playhead. Report progress (0..1) across the scroll
  // canvas so the host can drive the morph from real scrolling (not the dock).
  // Measure synchronously in the scroll handler — NOT via requestAnimationFrame.
  // rAF is throttled or fully suspended in hidden/background tabs, which silently
  // freezes the playhead at 0; a direct getBoundingClientRect on one element per
  // scroll event is cheap and always fires.
  useEffect(() => {
    const spacer = spacerRef.current;
    if (!spacer || !onProgress) return;
    const compute = () => {
      const len = spacer.offsetHeight - window.innerHeight;
      const top = spacer.getBoundingClientRect().top;
      onProgress(len > 0 ? Math.min(1, Math.max(0, -top / len)) : 0);
    };
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [onProgress, frames]);

  const measureBox = useCallback(() => {
    if (!editing || !selection || !pageRef.current) return setBox(null);
    const el = pageRef.current.querySelector(`[data-cms="${cssEscape(selection)}"]`);
    if (!el) return setBox(null);
    const r = el.getBoundingClientRect();
    setBox({ x: r.left, y: r.top, w: r.width, h: r.height });
  }, [editing, selection]);

  // Re-measure on selection / doc / scroll / resize — deliberately NOT on every
  // `transforms` frame. A scrub or Play sweep changes transforms ~30×/s; calling
  // getBoundingClientRect each time forces a synchronous reflow of the whole page
  // and saturates the main thread. Live drags re-measure through `onLive` instead.
  useLayoutEffect(() => {
    measureBox();
    window.addEventListener("scroll", measureBox, { passive: true });
    window.addEventListener("resize", measureBox);
    return () => {
      window.removeEventListener("scroll", measureBox);
      window.removeEventListener("resize", measureBox);
    };
  }, [measureBox, ed.state.doc]);

  // Inline, on-page contentEditable for text content — text/heading (plain) and
  // richtext (HTML). All content is edited directly on the page, never in a
  // sidebar field. richtext edits the inner HTML container so formatting survives.
  useEffect(() => {
    const t = selNode?.type;
    const editable = t === "text" || t === "heading" || t === "richtext";
    if (!editing || !selection || !pageRef.current || !editable) return;
    const wrapper = pageRef.current.querySelector<HTMLElement>(`[data-cms="${cssEscape(selection)}"]`);
    if (!wrapper) return;
    const isRich = t === "richtext";
    const el = (isRich ? (wrapper.firstElementChild as HTMLElement | null) : wrapper) ?? wrapper;
    el.setAttribute("contenteditable", "true");
    el.style.outline = "none";
    el.focus();
    const commit = () => ed.apply({ t: "set_props", id: selection, patch: isRich ? { html: el.innerHTML } : { content: el.innerText } });
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

  const addNode = useCallback(
    (kind: AddKind) => {
      // Drop into the selected container; else the selected node's parent; else
      // the last section (or top level when the page is still empty).
      const doc = ed.state.doc;
      const parent = selNode
        ? CONTAINER_TYPES.has(selNode.type)
          ? selNode.id
          : selNode.parent
        : (doc.sections[doc.sections.length - 1] ?? null);
      const siblings = childrenOf(doc, parent);
      const order = keyBetween(siblings.length ? siblings[siblings.length - 1]!.order : null, null);
      const id = `n${doc.seq + 1}-${Math.floor(performance.now())}`;
      const def = ADD_DEFAULTS[kind];
      ed.apply({ t: "insert_node", node: { id, type: def.type, parent, order, layout: def.layout, props: { ...def.props }, style: { base: { ...def.style } } } });
      ed.select(id);
    },
    [ed, selNode],
  );

  // Insert an Element at an explicit target (the node under a drop point) rather
  // than the current selection — used by the drag-and-drop palette.
  const addNodeAt = useCallback(
    (kind: AddKind, targetId: string | null) => {
      const doc = ed.state.doc;
      const target = targetId ? doc.nodes[targetId] : null;
      const parent = target
        ? CONTAINER_TYPES.has(target.type)
          ? target.id
          : target.parent
        : (doc.sections[doc.sections.length - 1] ?? null);
      const siblings = childrenOf(doc, parent);
      const order = keyBetween(siblings.length ? siblings[siblings.length - 1]!.order : null, null);
      const id = `n${doc.seq + 1}-${Math.floor(performance.now())}`;
      const def = ADD_DEFAULTS[kind];
      ed.apply({ t: "insert_node", node: { id, type: def.type, parent, order, layout: def.layout, props: { ...def.props }, style: { base: { ...def.style } } } });
      ed.select(id);
    },
    [ed],
  );

  // Right-edge Element palette: reveals when the pointer nears the right screen
  // edge, hides while an Element is being dragged onto the page.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [draggingEl, setDraggingEl] = useState(false);
  useEffect(() => {
    if (!editing) {
      setPaletteOpen(false);
      return;
    }
    const onMove = (e: MouseEvent) => {
      if (draggingEl) return;
      if (e.clientX >= window.innerWidth - 26) setPaletteOpen(true);
      else if (e.clientX < window.innerWidth - 236) setPaletteOpen(false);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [editing, draggingEl]);

  // Drop target + indicator. While dragging, we compute the precise insertion
  // point (before/after a leaf, or inside a container) under the cursor so the
  // user can drop *anywhere* and see exactly where it lands.
  type DropHint = { id: string | null; edge: "before" | "after" | "inside"; rect: { x: number; y: number; w: number; h: number } | null };
  const [dropHint, setDropHint] = useState<DropHint | null>(null);

  const computeDropTarget = (clientX: number, clientY: number): DropHint => {
    const el = document.elementFromPoint(clientX, clientY)?.closest("[data-cms]") as HTMLElement | null;
    if (!el) return { id: null, edge: "inside", rect: null };
    const id = el.getAttribute("data-cms")!;
    const node = ed.state.doc.nodes[id];
    const r = el.getBoundingClientRect();
    const rect = { x: r.left, y: r.top, w: r.width, h: r.height };
    // Over a container's own area (not a child) → drop inside it.
    if (node && CONTAINER_TYPES.has(node.type)) return { id, edge: "inside", rect };
    return { id, edge: clientY < r.top + r.height / 2 ? "before" : "after", rect };
  };

  const onPageDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropHint(computeDropTarget(e.clientX, e.clientY));
  };

  // Insert relative to a drop hint — before/after a sibling, or appended inside
  // a container (or the last section when dropped on empty page space).
  const insertRelative = (kind: AddKind, hint: DropHint) => {
    const doc = ed.state.doc;
    let parent: string | null;
    let order: string;
    if (!hint.id || hint.edge === "inside") {
      parent = hint.id ?? (doc.sections[doc.sections.length - 1] ?? null);
      const sib = childrenOf(doc, parent);
      order = keyBetween(sib.length ? sib[sib.length - 1]!.order : null, null);
    } else {
      const target = doc.nodes[hint.id]!;
      parent = target.parent;
      const sib = childrenOf(doc, parent);
      const idx = sib.findIndex((n) => n.id === hint.id);
      order =
        hint.edge === "before"
          ? keyBetween(idx > 0 ? sib[idx - 1]!.order : null, target.order)
          : keyBetween(target.order, idx < sib.length - 1 ? sib[idx + 1]!.order : null);
    }
    const id = `n${doc.seq + 1}-${Math.floor(performance.now())}`;
    const def = ADD_DEFAULTS[kind];
    ed.apply({ t: "insert_node", node: { id, type: def.type, parent, order, layout: def.layout, props: { ...def.props }, style: { base: { ...def.style } } } });
    ed.select(id);
  };

  const onPageDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    const kind = e.dataTransfer.getData("application/x-cms-element") as AddKind;
    if (!kind) return;
    e.preventDefault();
    insertRelative(kind, computeDropTarget(e.clientX, e.clientY));
    setDropHint(null);
    setDraggingEl(false);
  };

  const setStyle = (patch: Partial<StyleProps>) =>
    selection && ed.apply({ t: "set_style", id: selection, breakpoint: "base", patch });
  const setProps = (patch: Record<string, unknown>) =>
    selection && ed.apply({ t: "set_props", id: selection, patch });
  const setLayout = (layout: LayoutMode | undefined) =>
    selection && ed.apply({ t: "set_layout", id: selection, layout });
  const removeSelected = () => {
    if (!selection) return;
    ed.apply({ t: "remove_node", id: selection });
    ed.select(null);
  };

  // ── Context-menu / shortcut commands (all expressed as op sequences) ───────
  const clip = useRef<{ rootId: NodeId; nodes: NodeMap } | null>(null);
  const runOps = (result: { ops: PageOp[]; newRootId: NodeId | null }) => {
    result.ops.forEach((op) => ed.apply(op));
    if (result.newRootId) ed.select(result.newRootId);
  };
  const duplicate = (id: string | null) => id && runOps(duplicateOps(ed.state.doc, id));
  const reorder = (id: string | null, dir: ReorderDir) => id && reorderOps(ed.state.doc, id, dir).forEach((op) => ed.apply(op));
  const wrapInBox = (id: string | null) => id && runOps(wrapInBoxOps(ed.state.doc, id));
  const copy = (id: string | null) => {
    if (id) clip.current = snapshotSubtree(ed.state.doc, id);
  };
  const paste = (target: string | null) => {
    if (clip.current) runOps(pasteOps(ed.state.doc, clip.current, target, CONTAINER_TYPES));
  };
  const startEditText = (id: string | null) => {
    if (!id) return;
    ed.select(id);
    requestAnimationFrame(() => pageRef.current?.querySelector<HTMLElement>(`[data-cms="${cssEscape(id)}"]`)?.focus());
  };

  // Latest transforms + commit fn for keyboard nudge — read via ref so the
  // keydown handler never sees a stale snapshot (transforms change ~30×/s).
  const nudgeRef = useRef({ transforms, onNodeTransform });
  nudgeRef.current = { transforms, onNodeTransform };

  // Keyboard shortcuts in EditMode (ignored while typing in a field/contentEditable).
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (e.key === "Escape") return void ed.select(null);
      if (typing) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        removeSelected();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d" && selection) {
        e.preventDefault();
        duplicate(selection);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && selection) {
        copy(selection);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        paste(selection);
      } else if (selection && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) {
        // Nudge: arrows move ±1px, Shift+arrows ±10px — committed as a transform.
        const { transforms: tf, onNodeTransform: commit } = nudgeRef.current;
        if (!commit) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const cur = tf?.[selection] ?? {};
        commit(selection, { ...cur, x: (cur.x ?? 0) + dx, y: (cur.y ?? 0) + dy });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, selection]); // eslint-disable-line react-hooks/exhaustive-deps

  const onContextMenuSelect = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!editing) return;
    const el = (e.target as HTMLElement).closest("[data-cms]");
    if (el) ed.select(el.getAttribute("data-cms"));
    else ed.select(null);
  };

  const page = (
    <div
      ref={pageRef}
      onClickCapture={onClickCapture}
      onContextMenu={onContextMenuSelect}
      onDragOver={editing ? onPageDragOver : undefined}
      onDragLeave={editing ? () => setDropHint(null) : undefined}
      onDrop={editing ? onPageDrop : undefined}
    >
      <CmsPage doc={ed.state.doc} registry={registry} data={data} />
    </div>
  );
  const pageShell = pinned ? (
    <div ref={spacerRef} style={{ height: `${Math.max(1, frames) * 100}vh` }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>{page}</div>
    </div>
  ) : frames > 1 ? (
    // Normal flow, but "expanded" — extra scroll length below the content so a
    // page can be made longer than its content (the ＋ Frame control).
    <div style={{ minHeight: `${frames * 100}vh` }}>{page}</div>
  ) : (
    page
  );

  return (
    <div style={{ position: "relative" }}>
      {editing ? (
        <ContextMenu>
          <ContextMenu.Trigger>{pageShell}</ContextMenu.Trigger>
          <ContextMenu.Content className="!z-[2147483646]">
            <EditMenuItems
              node={selNode ?? null}
              hasClipboard={Boolean(clip.current)}
              isContainer={selNode ? CONTAINER_TYPES.has(selNode.type) : false}
              onEditText={() => startEditText(selection)}
              onAdd={addNode}
              onDuplicate={() => duplicate(selection)}
              onCopy={() => copy(selection)}
              onPaste={() => paste(selection)}
              onWrap={() => wrapInBox(selection)}
              onReorder={(d) => reorder(selection, d)}
              onDelete={removeSelected}
            />
          </ContextMenu.Content>
        </ContextMenu>
      ) : (
        pageShell
      )}

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
        <FloatingToolbar box={box} isText={selNode.type === "text" || selNode.type === "heading"} base={selNode.style.base} setStyle={setStyle} />
      ) : null}

      {editing && selNode && box ? (
        <NodeInspector
          node={selNode}
          transform={(selection ? transforms?.[selection] : undefined) ?? {}}
          measured={{ w: box.w, h: box.h }}
          onProps={setProps}
          onStyle={setStyle}
          onLayout={setLayout}
          onTransform={(t) => selection && onNodeTransform?.(selection, t)}
          onRemove={removeSelected}
          onClose={() => ed.select(null)}
        />
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
          onAdd={addNode}
        />
      ) : null}

      {editing && dropHint?.rect ? <DropIndicator hint={dropHint} /> : null}

      {editing ? <ElementPalette open={paletteOpen} onDragChange={setDraggingEl} /> : null}

      {editing && timelineDock ? <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: Z }}>{timelineDock}</div> : null}
    </div>
  );
}

/** The live drop indicator: a line before/after a sibling, or an outline inside a container. */
function DropIndicator({
  hint,
}: {
  hint: { edge: "before" | "after" | "inside"; rect: { x: number; y: number; w: number; h: number } | null };
}): ReactElement | null {
  const r = hint.rect;
  if (!r) return null;
  const color = "#ec4899";
  if (hint.edge === "inside") {
    return <div style={{ position: "fixed", left: r.x, top: r.y, width: r.w, height: r.h, outline: `2px dashed ${color}`, outlineOffset: -2, borderRadius: 6, pointerEvents: "none", zIndex: Z + 4 }} />;
  }
  const y = hint.edge === "before" ? r.y : r.y + r.h;
  return <div style={{ position: "fixed", left: r.x, top: y - 1.5, width: r.w, height: 3, background: color, borderRadius: 2, boxShadow: "0 0 0 1px #fff", pointerEvents: "none", zIndex: Z + 4 }} />;
}

/**
 * The Element palette — a panel docked to the right edge that slides in when the
 * pointer nears the edge (controlled by `open`) and hides while an Element is
 * being dragged. Each tile is draggable; dropping it on the page inserts that
 * Element (handled by EditablePage's `onPageDrop`).
 */
function ElementPalette({ open, onDragChange }: { open: boolean; onDragChange: (dragging: boolean) => void }): ReactElement {
  return (
    <div
      style={{
        position: "fixed",
        top: 64,
        bottom: 96,
        right: 0,
        width: 216,
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.18s ease",
        background: "#0b1220",
        color: "#e2e8f0",
        borderLeft: "1px solid #1e293b",
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12,
        boxShadow: "-18px 0 48px -20px rgba(0,0,0,0.6)",
        zIndex: Z + 2,
        fontFamily: "system-ui, sans-serif",
        padding: 12,
        overflowY: "auto",
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.5, marginBottom: 10 }}>Elements</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {ADD_MENU.map((m) => (
          <div
            key={m.kind}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-cms-element", m.kind);
              e.dataTransfer.effectAllowed = "copy";
              onDragChange(true);
            }}
            onDragEnd={() => onDragChange(false)}
            title={`Drag "${m.label}" onto the page`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              height: 56,
              borderRadius: 8,
              background: "#0f172a",
              border: "1px solid #1e293b",
              cursor: "grab",
              fontSize: 12,
              userSelect: "none",
            }}
          >
            <span style={{ fontSize: 16, opacity: 0.7 }}>＋</span>
            {m.label}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 10.5, opacity: 0.45, marginTop: 12, lineHeight: 1.4 }}>
        Drag an Element onto the page. It drops into the container you release over.
      </p>
    </div>
  );
}

const CONTAINER_TYPES = new Set(["section", "frame", "stack", "grid", "shape", "card", "device", "repeater"]);

type AddKind =
  | "text"
  | "heading"
  | "button"
  | "link"
  | "image"
  | "box"
  | "stack"
  | "grid"
  | "card"
  | "callout"
  | "divider"
  | "code"
  | "richtext"
  | "repeater";
const ADD_DEFAULTS: Record<AddKind, { type: string; props: Record<string, Json>; style: StyleProps; layout?: LayoutMode }> = {
  text: { type: "text", props: { content: "New text" }, style: { color: "inherit" } },
  heading: { type: "heading", props: { content: "New heading" }, style: { fontSize: { value: 28, unit: "px" }, fontWeight: 700 } },
  button: { type: "button", props: { label: "Button", href: "#", variant: "primary" }, style: {} },
  link: { type: "link", props: { content: "link text", href: "#" }, style: { color: "#7c3aed" } },
  image: { type: "image", props: { src: "", alt: "" }, style: {} },
  box: { type: "frame", props: {}, style: { padding: { value: 16, unit: "px" } } },
  stack: { type: "stack", props: {}, style: { gap: { value: 12, unit: "px" } }, layout: "stack" },
  grid: { type: "grid", props: {}, style: { gap: { value: 12, unit: "px" } }, layout: "grid" },
  card: { type: "card", props: {}, style: { padding: { value: 16, unit: "px" }, radius: { value: 12, unit: "px" }, border: "1px solid #e2e8f0" } },
  callout: { type: "callout", props: { content: "Heads up — this is a callout.", variant: "info" }, style: {} },
  divider: { type: "divider", props: {}, style: {} },
  code: { type: "code", props: { content: "npm install @particle-academy/react-fancy", lang: "bash" }, style: {} },
  richtext: { type: "richtext", props: { html: "<p>Rich <strong>text</strong> with <em>inline</em> formatting.</p>" }, style: {} },
  repeater: { type: "repeater", props: { items: "" }, style: { gap: { value: 12, unit: "px" } }, layout: "stack" },
};

/** A resize grip: which edges it drags, its position, and its cursor. */
interface Grip {
  key: string;
  north?: boolean;
  south?: boolean;
  east?: boolean;
  west?: boolean;
  cursor: string;
}
const GRIPS: Grip[] = [
  { key: "nw", north: true, west: true, cursor: "nwse-resize" },
  { key: "n", north: true, cursor: "ns-resize" },
  { key: "ne", north: true, east: true, cursor: "nesw-resize" },
  { key: "e", east: true, cursor: "ew-resize" },
  { key: "se", south: true, east: true, cursor: "nwse-resize" },
  { key: "s", south: true, cursor: "ns-resize" },
  { key: "sw", south: true, west: true, cursor: "nesw-resize" },
  { key: "w", west: true, cursor: "ew-resize" },
];

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
  const drag = useRef<{ x: number; y: number; w: number; h: number; live: NodeTransform } | null>(null);
  // Snap targets (other elements' edges/centers, viewport coords) gathered at
  // drag start, + the live alignment guides to draw.
  const targets = useRef<{ vx: number[]; hy: number[] }>({ vx: [], hy: [] });
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  const apply = (t: NodeTransform) => {
    const el = getEl();
    if (el) applyTransform(el, t);
  };

  // Snap a set of candidate lines to the nearest target within SNAP px.
  // Returns the adjustment to apply and the matched guide coordinate.
  const snap = (cands: number[], lines: number[]): { delta: number; at: number | null } => {
    let best = { delta: 0, at: null as number | null, dist: SNAP + 1 };
    for (const line of lines) {
      for (const c of cands) {
        const diff = line - c;
        if (Math.abs(diff) < best.dist) best = { delta: diff, at: line, dist: Math.abs(diff) };
      }
    }
    return best.dist <= SNAP ? { delta: best.delta, at: best.at } : { delta: 0, at: null };
  };

  // Move drags translate; resize grips set an explicit width/height (a true
  // resize, not scale) and translate the opposite way when dragging a top/left
  // edge so the anchored edge stays put.
  const startMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, w: box.w, h: box.h, live: { ...base } };
    // Gather snap targets: every other element's left/center/right + top/middle/
    // bottom (skip the selection itself and its ancestors/descendants).
    const sel = getEl();
    const vx = new Set<number>();
    const hy = new Set<number>();
    document.querySelectorAll<HTMLElement>("[data-cms]").forEach((el) => {
      if (sel && (el === sel || sel.contains(el) || el.contains(sel))) return;
      const r = el.getBoundingClientRect();
      vx.add(r.left).add(r.left + r.width / 2).add(r.right);
      hy.add(r.top).add(r.top + r.height / 2).add(r.bottom);
    });
    targets.current = { vx: [...vx], hy: [...hy] };
  };
  const moveMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    let dx = e.clientX - d.x;
    let dy = e.clientY - d.y;
    // Snap the moving box's edges/center to nearby targets (hold Alt to bypass).
    if (!e.altKey) {
      const l = box.x + dx;
      const t = box.y + dy;
      const sx = snap([l, l + box.w / 2, l + box.w], targets.current.vx);
      const sy = snap([t, t + box.h / 2, t + box.h], targets.current.hy);
      dx += sx.delta;
      dy += sy.delta;
      setGuides({ x: sx.at, y: sy.at });
    } else if (guides.x !== null || guides.y !== null) {
      setGuides({ x: null, y: null });
    }
    d.live = { ...base, x: (base.x ?? 0) + dx, y: (base.y ?? 0) + dy };
    apply(d.live);
    onLive();
  };

  const startResize = (g: Grip) => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, w: base.w ?? box.w, h: base.h ?? box.h, live: { ...base } };
    (e.currentTarget as HTMLElement).dataset.grip = g.key;
  };
  const resizeMove = (g: Grip) => (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const live: NodeTransform = { ...base };
    if (g.east) live.w = Math.max(16, Math.round(d.w + dx));
    if (g.west) {
      live.w = Math.max(16, Math.round(d.w - dx));
      live.x = (base.x ?? 0) + (d.w - live.w);
    }
    if (g.south) live.h = Math.max(16, Math.round(d.h + dy));
    if (g.north) {
      live.h = Math.max(16, Math.round(d.h - dy));
      live.y = (base.y ?? 0) + (d.h - live.h);
    }
    d.live = live;
    apply(live);
    onLive();
  };
  const end = () => {
    const d = drag.current;
    if (d) onTransform(d.live);
    drag.current = null;
    setGuides({ x: null, y: null });
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
    width: 12,
    height: 12,
    background: "#fff",
    border: "2px solid #8b5cf6",
    borderRadius: 3,
    zIndex: Z + 1,
    touchAction: "none",
    boxSizing: "border-box",
  };
  const gripPos = (g: Grip): CSSProperties => {
    const cx = g.west ? box.x : g.east ? box.x + box.w : box.x + box.w / 2;
    const cy = g.north ? box.y : g.south ? box.y + box.h : box.y + box.h / 2;
    return { left: cx - 6, top: cy - 6, cursor: g.cursor };
  };

  return (
    <>
      {guides.x !== null ? <div style={{ position: "fixed", left: guides.x, top: 0, bottom: 0, width: 1, background: "#ec4899", zIndex: Z + 3, pointerEvents: "none" }} /> : null}
      {guides.y !== null ? <div style={{ position: "fixed", top: guides.y, left: 0, right: 0, height: 1, background: "#ec4899", zIndex: Z + 3, pointerEvents: "none" }} /> : null}
      <div style={outline} />
      {movable ? (
        <>
          {/* move grip — circular, top-left, offset clear of the corner handle */}
          <div
            title="Drag to move"
            onPointerDown={startMove}
            onPointerMove={moveMove}
            onPointerUp={end}
            style={{ ...handle, width: 18, height: 18, borderRadius: 9, background: "#8b5cf6", border: "2px solid #fff", left: box.x - 22, top: box.y - 22, cursor: "move" }}
          />
          {GRIPS.map((g) => (
            <div
              key={g.key}
              title="Drag to resize"
              onPointerDown={startResize(g)}
              onPointerMove={resizeMove(g)}
              onPointerUp={end}
              style={{ ...handle, ...gripPos(g) }}
            />
          ))}
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

const ADD_MENU: Array<{ kind: AddKind; label: string }> = [
  { kind: "heading", label: "Heading" },
  { kind: "text", label: "Text" },
  { kind: "button", label: "Button" },
  { kind: "link", label: "Link" },
  { kind: "image", label: "Image" },
  { kind: "card", label: "Card" },
  { kind: "callout", label: "Callout" },
  { kind: "stack", label: "Stack" },
  { kind: "grid", label: "Grid" },
  { kind: "box", label: "Box" },
  { kind: "divider", label: "Divider" },
  { kind: "code", label: "Code" },
  { kind: "richtext", label: "Rich text" },
  { kind: "repeater", label: "Repeater" },
];

function EditBar({
  editing,
  onToggle,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAdd,
}: {
  editing: boolean;
  onToggle: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAdd: (kind: AddKind) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const bar: CSSProperties = { position: "fixed", top: 12, right: 12, display: "flex", gap: 6, alignItems: "center", padding: 6, background: "#0f172a", color: "#fff", borderRadius: 999, boxShadow: "0 8px 24px -8px rgba(0,0,0,0.4)", zIndex: Z + 3, fontFamily: "system-ui, sans-serif", fontSize: 12 };
  const btn: CSSProperties = { font: "inherit", border: "none", background: "transparent", color: "inherit", cursor: "pointer", padding: "4px 8px", borderRadius: 999 };
  return (
    <div style={bar}>
      <button type="button" style={{ ...btn, background: editing ? "#8b5cf6" : "transparent" }} onClick={onToggle}>
        {editing ? "● Editing" : "Edit"}
      </button>
      {editing ? (
        <>
          <div style={{ position: "relative" }}>
            <button type="button" style={{ ...btn, background: open ? "#1e293b" : "transparent" }} onClick={() => setOpen((v) => !v)} title="Add an Element (or drag from the right-edge palette)">＋ Element ▾</button>
            {open ? (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 4, display: "flex", flexDirection: "column", minWidth: 132, boxShadow: "0 12px 32px -10px rgba(0,0,0,0.6)" }}>
                {ADD_MENU.map((m) => (
                  <button
                    key={m.kind}
                    type="button"
                    style={{ ...btn, textAlign: "left", borderRadius: 6, padding: "6px 10px" }}
                    onClick={() => {
                      onAdd(m.kind);
                      setOpen(false);
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button type="button" style={{ ...btn, opacity: canUndo ? 1 : 0.4 }} disabled={!canUndo} onClick={onUndo}>↶</button>
          <button type="button" style={{ ...btn, opacity: canRedo ? 1 : 0.4 }} disabled={!canRedo} onClick={onRedo}>↷</button>
        </>
      ) : null}
    </div>
  );
}

/** The right-click menu in EditMode — contextual to the node under the cursor. */
function EditMenuItems({
  node,
  hasClipboard,
  isContainer,
  onEditText,
  onAdd,
  onDuplicate,
  onCopy,
  onPaste,
  onWrap,
  onReorder,
  onDelete,
}: {
  node: { type: string; parent: NodeId | null } | null;
  hasClipboard: boolean;
  isContainer: boolean;
  onEditText: () => void;
  onAdd: (kind: AddKind) => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onWrap: () => void;
  onReorder: (dir: ReorderDir) => void;
  onDelete: () => void;
}): ReactElement {
  const editable = node && (node.type === "text" || node.type === "heading");
  const nested = Boolean(node && node.parent !== null);
  return (
    <>
      {editable ? <ContextMenu.Item onClick={onEditText}>Edit text</ContextMenu.Item> : null}
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger>{isContainer ? "Add Element inside" : "Add Element"}</ContextMenu.SubTrigger>
        <ContextMenu.SubContent className="!z-[2147483647]">
          {ADD_MENU.map((m) => (
            <ContextMenu.Item key={m.kind} onClick={() => onAdd(m.kind)}>{m.label}</ContextMenu.Item>
          ))}
        </ContextMenu.SubContent>
      </ContextMenu.Sub>
      {node ? (
        <>
          <ContextMenu.Separator />
          <ContextMenu.Item onClick={onDuplicate}>Duplicate</ContextMenu.Item>
          <ContextMenu.Item onClick={onCopy}>Copy</ContextMenu.Item>
          <ContextMenu.Item disabled={!hasClipboard} onClick={onPaste}>Paste</ContextMenu.Item>
          {nested ? <ContextMenu.Item onClick={onWrap}>Wrap in Box</ContextMenu.Item> : null}
          <ContextMenu.Separator />
          <ContextMenu.Item onClick={() => onReorder("up")}>Move up</ContextMenu.Item>
          <ContextMenu.Item onClick={() => onReorder("down")}>Move down</ContextMenu.Item>
          {nested ? (
            <>
              <ContextMenu.Item onClick={() => onReorder("front")}>Bring to front</ContextMenu.Item>
              <ContextMenu.Item onClick={() => onReorder("back")}>Send to back</ContextMenu.Item>
            </>
          ) : null}
          <ContextMenu.Separator />
          <ContextMenu.Item danger onClick={onDelete}>Delete</ContextMenu.Item>
        </>
      ) : (
        <ContextMenu.Item disabled={!hasClipboard} onClick={onPaste}>Paste</ContextMenu.Item>
      )}
    </>
  );
}

/** Write a transform onto an element (or clear every transformed property). */
function applyTransform(el: HTMLElement, t: NodeTransform | undefined): void {
  if (t && (t.x != null || t.y != null || t.scale != null || t.rotate != null || t.opacity != null || t.w != null || t.h != null)) {
    el.style.transform = `translate3d(${t.x ?? 0}px, ${t.y ?? 0}px, 0) scale(${t.scale ?? 1}) rotate(${t.rotate ?? 0}deg)`;
    el.style.opacity = t.opacity != null ? String(t.opacity) : "";
    el.style.width = t.w != null ? `${t.w}px` : "";
    el.style.height = t.h != null ? `${t.h}px` : "";
  } else {
    el.style.transform = "";
    el.style.opacity = "";
    el.style.width = "";
    el.style.height = "";
  }
}

function normalizeColor(v: string | undefined): string {
  return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#ffffff";
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}
