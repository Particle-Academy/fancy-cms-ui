import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";
import type { PageDoc } from "../document/types";
import type { PageOp } from "../document/ops";
import { CmsPage } from "../react/CmsPage";

export interface CanvasProps {
  doc: PageDoc;
  selection: string | null;
  onSelect: (id: string | null) => void;
  apply: (op: PageOp) => void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The edit surface: renders the live page and overlays a selection box. Click to
 * select; drag the box to move (px constraints). Phase 1 cut: free-parent
 * move + resize handles, stack/grid reordering, and snapping come next.
 */
export function Canvas({ doc, selection, onSelect, apply }: CanvasProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !selection) {
      setBox(null);
      return;
    }
    const el = root.querySelector(`[data-cms="${cssEscape(selection)}"]`);
    if (!el) {
      setBox(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    setBox({
      x: r.left - rootRect.left + root.scrollLeft,
      y: r.top - rootRect.top + root.scrollTop,
      w: r.width,
      h: r.height,
    });
  }, [selection, doc]);

  const handleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest("[data-cms]");
    onSelect(target ? target.getAttribute("data-cms") : null);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!selection) return;
    const c = doc.nodes[selection]?.constraints?.base;
    const left = c && c.left && typeof c.left === "object" ? c.left.value : 0;
    const top = c && c.top && typeof c.top === "object" ? c.top.value : 0;
    drag.current = { x: e.clientX, y: e.clientY, left, top };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !selection) return;
    apply({
      t: "set_constraints",
      id: selection,
      breakpoint: "base",
      patch: {
        left: { value: Math.round(d.left + (e.clientX - d.x)), unit: "px" },
        top: { value: Math.round(d.top + (e.clientY - d.y)), unit: "px" },
      },
    });
  };

  const handlePointerUp = () => {
    drag.current = null;
  };

  const surface: CSSProperties = {
    position: "relative",
    overflow: "auto",
    height: "100%",
    background: "#f8fafc",
  };
  const overlay: CSSProperties = box
    ? {
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        outline: "2px solid #8b5cf6",
        outlineOffset: -1,
        cursor: "move",
        touchAction: "none",
      }
    : { display: "none" };

  return (
    <div ref={ref} onClick={handleClick} style={surface}>
      <CmsPage doc={doc} />
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={overlay}
      />
    </div>
  );
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}
