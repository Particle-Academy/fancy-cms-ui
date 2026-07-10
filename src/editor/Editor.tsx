import { useEffect, useRef, type CSSProperties, type ReactElement } from "react";
import type { PageDoc } from "../document/types";
import type { DataContext, ElementRegistry } from "../react/registry";
import { useEditor, type EditorApi } from "./useEditor";
import { useLatestRef } from "./useLatestRef";
import { Canvas } from "./Canvas";
import { LayersPanel } from "./LayersPanel";
import { Inspector } from "./Inspector";

export interface EditorProps {
  /** Initial document; edits are surfaced via {@link EditorProps.onChange}. */
  defaultValue: PageDoc;
  onChange?: (doc: PageDoc) => void;
  /**
   * Custom element registry — mirrors {@link CmsPageProps.registry} so the edit
   * canvas renders your own node types instead of a blank placeholder. Pass the
   * same registry you give `CmsPage` at runtime.
   */
  registry?: ElementRegistry;
  /** Data context that `{ $bind: "…" }` props + repeaters preview against on the canvas. */
  data?: DataContext;
}

/**
 * The fancy-cms editor: layers · canvas · inspector over the op-spine. Phase 1
 * cut — chrome is plain markup for now; it graduates to react-fancy next.
 */
export function Editor({ defaultValue, onChange, registry, data }: EditorProps): ReactElement {
  const ed = useEditor(defaultValue);
  const first = useRef(true);

  // Notify depends ONLY on the doc — the latest onChange lives in a ref, so an
  // inline-closure consumer (whose handler identity changes every render) can't
  // re-trigger the notify and loop it (#1).
  const onChangeRef = useLatestRef(onChange);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onChangeRef.current?.(ed.state.doc);
  }, [ed.state.doc, onChangeRef]);

  const shell: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "220px 1fr 300px",
    height: "100%",
    minHeight: 0,
    background: "var(--fcms-bg)",
    color: "var(--fcms-fg)",
    border: "1px solid var(--fcms-border)",
    borderRadius: 12,
    overflow: "hidden",
  };

  return (
    <div className="fancy-cms-editor" style={shell}>
      <style>{CHROME_CSS}</style>
      <div style={{ borderRight: "1px solid var(--fcms-border)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Toolbar ed={ed} />
        <LayersPanel
          doc={ed.state.doc}
          selection={ed.state.selection}
          onSelect={ed.select}
          onMove={(id, parent, order) => ed.apply({ t: "move_node", id, parent, order })}
        />
      </div>
      <Canvas doc={ed.state.doc} selection={ed.state.selection} onSelect={ed.select} apply={ed.apply} registry={registry} data={data} />
      <div style={{ borderLeft: "1px solid var(--fcms-border)", minHeight: 0 }}>
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
    border: "1px solid var(--fcms-border)",
    background: "var(--fcms-bg)",
    color: "var(--fcms-fg)",
    cursor: "pointer",
  };
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        padding: 8,
        borderBottom: "1px solid var(--fcms-border)",
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

/**
 * Editor chrome tokens. Light by default; dark under `@media (prefers-color-scheme:
 * dark)` OR an ancestor `.dark` / `[data-theme="dark"]` (Tailwind/class strategy),
 * with an explicit `.light` / `[data-theme="light"]` ancestor forcing light back.
 * The panels below read `var(--fcms-*)`, so the whole editor embeds cleanly in a
 * dark app. `color-scheme` flips native inputs + scrollbars too.
 */
const DARK_VARS =
  "color-scheme:dark;--fcms-bg:#0b0f19;--fcms-fg:#e5e7eb;--fcms-muted:#94a3b8;--fcms-border:#27272a;" +
  "--fcms-canvas:#0f141f;--fcms-input-bg:#111827;--fcms-row-fg:#cbd5e1;" +
  "--fcms-sel-bg:color-mix(in oklab, #8b5cf6 24%, transparent);--fcms-sel-fg:#ddd6fe;";
const LIGHT_VARS =
  "color-scheme:light;--fcms-bg:#ffffff;--fcms-fg:#0f172a;--fcms-muted:#64748b;--fcms-border:#e2e8f0;" +
  "--fcms-canvas:#f8fafc;--fcms-input-bg:#ffffff;--fcms-row-fg:#334155;--fcms-sel-bg:#ede9fe;--fcms-sel-fg:#5b21b6;";
const CHROME_CSS =
  `.fancy-cms-editor{--fcms-accent:#8b5cf6;${LIGHT_VARS}}` +
  `@media (prefers-color-scheme:dark){.fancy-cms-editor{${DARK_VARS}}}` +
  `:where(.light,[data-theme="light"]) .fancy-cms-editor{${LIGHT_VARS}}` +
  `:where(.dark,[data-theme="dark"]) .fancy-cms-editor{${DARK_VARS}}`;
