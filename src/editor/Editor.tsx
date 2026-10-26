import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactElement } from "react";
import type { PageDoc } from "../document/types";
import type { IconSet } from "../document/icons";
import type { ImageAssetResolver } from "../render/images";
import type { PageOp } from "../document/ops";
import { reduce } from "../document/reduce";
import type { DataContext, ElementRegistry } from "../react/registry";
import { useEditor, type EditorApi } from "./useEditor";
import { useLatestRef } from "./useLatestRef";
import { Canvas } from "./Canvas";
import { LayersPanel } from "./LayersPanel";
import { Inspector } from "./Inspector";
import { InspectorDrafts } from "./InspectorDrafts";
import { ADD_MENU, buildInsertOp, type AddKind } from "./insert";
import { emptyDoc } from "../document/types";

export interface EditorProps {
  /** Controlled server/shared document. Incoming values never emit onChange/onOp. */
  value?: PageDoc;
  /**
   * Initial document; edits are surfaced via {@link EditorProps.onChange}.
   * Omit to start from an empty page.
   */
  defaultValue?: PageDoc;
  onChange?: (doc: PageDoc) => void;
  /** Native proposals: controlled inspector fields debounce/blur; one proposal awaits acknowledgement. */
  onOp?: (op: PageOp) => void;
  /** Block structural edits and draft submission while pending; controlled inspector typing remains available. */
  disabled?: boolean;
  /**
   * Custom element registry — mirrors {@link CmsPageProps.registry} so the edit
   * canvas renders your own node types instead of a blank placeholder. Pass the
   * same registry you give `CmsPage` at runtime.
   */
  registry?: ElementRegistry;
  /** Data context that `{ $bind: "…" }` props + repeaters preview against on the canvas. */
  data?: DataContext;
  /** Pass the same preloaded glyph map as the published renderer. */
  icons?: IconSet;
  imageResolver?: ImageAssetResolver;
}

/**
 * The fancy-cms editor: layers · canvas · inspector over the op-spine.
 *
 * The chrome is plain markup **deliberately**, and stays that way. It themes
 * through the `--fcms-*` layer defined at the bottom of this file — light by
 * default, dark under `prefers-color-scheme` or a `.dark` ancestor — and
 * react-fancy's primitives are hardcoded Tailwind palette classes that read no
 * custom properties, so swapping them in would ignore `--fcms-accent` and strand
 * a themed host with a half-themed editor.
 *
 * An earlier revision of this comment said the chrome "graduates to react-fancy
 * next". That predates the token layer by three weeks and is no longer the
 * plan; it is recorded here because it is the kind of note that gets acted on
 * long after it stopped being true.
 */
export function Editor({ value, defaultValue, onChange, onOp, disabled = false, registry, data, icons, imageResolver }: EditorProps): ReactElement {
  // Render an empty page rather than throwing on a missing document. Reading
  // `.sections` off undefined crashed the entire editor, which is a hostile way
  // to tell a host "you haven't passed a doc yet" (#3).
  const initial = useMemo(() => defaultValue ?? emptyDoc("untitled"), [defaultValue]);
  const local = useEditor(initial);
  const controlled = value !== undefined;
  const localDoc = useLatestRef(local.state.doc);
  const lastNotified = useRef(local.state.doc);
  const onOpRef = useLatestRef(onOp);
  const [drafts] = useState(() => new InspectorDrafts(value ?? initial));
  useSyncExternalStore(drafts.subscribe, drafts.snapshot, drafts.snapshot);

  // Notify depends ONLY on the doc — the latest onChange lives in a ref, so an
  // inline-closure consumer (whose handler identity changes every render) can't
  // re-trigger the notify and loop it (#1).
  const onChangeRef = useLatestRef(onChange);
  useEffect(() => {
    if (controlled || lastNotified.current === local.state.doc) return;
    lastNotified.current = local.state.doc;
    onChangeRef.current?.(local.state.doc);
  }, [controlled, local.state.doc, onChangeRef]);

  const apply = (op: PageOp): boolean => {
    if (disabled) return false;
    const source = value ?? localDoc.current;
    const next = reduce(source, op);
    if (next === source) return false;
    if (!controlled) {
      localDoc.current = next;
      local.apply(op);
    }
    onOpRef.current?.(op);
    if (controlled) onChangeRef.current?.(next);
    return true;
  };
  useEffect(() => { if (controlled) drafts.configure(value, disabled, apply); });
  useEffect(() => () => drafts.dispose(), [drafts]);
  const structuralDisabled = disabled || (controlled && drafts.busy);
  const ed: EditorApi = {
    ...local,
    state: { ...local.state, doc: value ?? local.state.doc },
    apply: (op) => { if (!structuralDisabled) apply(op); },
    // Snapshot history belongs to the local document. Replaying it into a
    // server-owned value could overwrite another writer's accepted work.
    undo: () => { if (!controlled && !disabled) local.undo(); },
    redo: () => { if (!controlled && !disabled) local.redo(); },
    replace: (next) => { if (!controlled && !disabled) local.replace(next); },
    canUndo: !controlled && !disabled && local.canUndo,
    canRedo: !controlled && !disabled && local.canRedo,
  };

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
    <div className="fancy-cms-editor" style={shell} aria-busy={structuralDisabled || undefined}>
      <style>{CHROME_CSS}</style>
      <fieldset disabled={structuralDisabled} aria-label="Page structure controls" style={{ display: "contents", border: 0, padding: 0, margin: 0 }}>
        <div style={{ borderRight: "1px solid var(--fcms-border)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Toolbar ed={ed} />
          <LayersPanel
            doc={ed.state.doc}
            selection={ed.state.selection}
            onSelect={ed.select}
            onMove={(id, parent, order) => ed.apply({ t: "move_node", id, parent, order })}
          />
        </div>
      </fieldset>
      <Canvas doc={ed.state.doc} selection={ed.state.selection} onSelect={ed.select} apply={ed.apply} registry={registry} data={data} icons={icons} imageResolver={imageResolver} />
      <div style={{ borderLeft: "1px solid var(--fcms-border)", minHeight: 0, overflow: "auto" }}>
        {controlled && drafts.conflicts.map((conflict) => (
          <div key={conflict.key} role="alert" data-cms-draft-conflict={conflict.key} style={{ padding: 12, fontFamily: "system-ui,sans-serif", fontSize: 13 }}>
            <p>{conflict.label}: {conflict.message}</p>
            <pre data-cms-retained-draft="" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{drafts.value(conflict.key, "")}</pre>
            <button type="button" disabled={disabled} onClick={() => drafts.resolve(conflict.key, false)}>Use server value</button>{" "}
            <button type="button" disabled={disabled || conflict.missing} onClick={() => drafts.resolve(conflict.key, true)}>Keep draft</button>
          </div>
        ))}
        <fieldset disabled={!controlled && disabled} aria-label="Page property controls" style={{ border: 0, padding: 0, margin: 0, minWidth: 0, height: "100%" }}>
          <Inspector doc={ed.state.doc} selection={ed.state.selection} apply={ed.apply} drafts={controlled ? drafts : undefined} />
        </fieldset>
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
      <AddElementMenu ed={ed} btn={btn} />
    </div>
  );
}

/**
 * Insert control for the standalone editor.
 *
 * Without this, `Editor` could not add an element at all: a host starting from
 * `emptyDoc()` got a blank canvas with nothing to select and no way to put
 * anything on it (#3). The palette itself was only ever wired into
 * `EditablePage`, which has no `onChange` to hand the document back — so
 * neither surface alone was embeddable.
 */
function AddElementMenu({ ed, btn }: { ed: EditorApi; btn: CSSProperties }): ReactElement {
  const [open, setOpen] = useState(false);

  // Dismiss on any outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const add = (kind: AddKind) => {
    const { op, id } = buildInsertOp(ed.state.doc, kind, ed.state.selection);
    ed.apply(op);
    ed.select(id);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative", marginLeft: "auto" }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        style={{ ...btn, borderColor: "var(--fcms-accent, #7c3aed)" }}
        aria-haspopup="menu"
        aria-expanded={open}
        data-cms-add-trigger=""
        onClick={() => setOpen((v) => !v)}
      >
        + Add
      </button>
      {open && (
        <div
          role="menu"
          data-cms-add-menu=""
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 20,
            minWidth: 150,
            maxHeight: 280,
            overflowY: "auto",
            padding: 4,
            borderRadius: 8,
            border: "1px solid var(--fcms-border)",
            background: "var(--fcms-bg)",
            boxShadow: "0 12px 32px rgba(0,0,0,.28)",
          }}
        >
          {ADD_MENU.map((item) => (
            <button
              key={item.kind}
              type="button"
              role="menuitem"
              data-cms-add={item.kind}
              style={{
                ...btn,
                display: "block",
                width: "100%",
                textAlign: "left",
                border: 0,
                background: "transparent",
              }}
              onClick={() => add(item.kind)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
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
  "--fcms-sel-bg:color-mix(in oklab, #8b5cf6 24%, transparent);--fcms-sel-fg:#ddd6fe;" +
  "--fcms-drop:#ec4899;--fcms-danger:#fca5a5;";
const LIGHT_VARS =
  "color-scheme:light;--fcms-bg:#ffffff;--fcms-fg:#0f172a;--fcms-muted:#64748b;--fcms-border:#e2e8f0;" +
  "--fcms-canvas:#f8fafc;--fcms-input-bg:#ffffff;--fcms-row-fg:#334155;--fcms-sel-bg:#ede9fe;--fcms-sel-fg:#5b21b6;" +
  "--fcms-drop:#db2777;--fcms-danger:#dc2626;";
const CHROME_CSS =
  `.fancy-cms-editor{--fcms-accent:#8b5cf6;${LIGHT_VARS}}` +
  `@media (prefers-color-scheme:dark){.fancy-cms-editor{${DARK_VARS}}}` +
  `:where(.light,[data-theme="light"]) .fancy-cms-editor{${LIGHT_VARS}}` +
  `:where(.dark,[data-theme="dark"]) .fancy-cms-editor{${DARK_VARS}}`;
