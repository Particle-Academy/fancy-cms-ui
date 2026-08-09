/**
 * @particle-academy/fancy-cms-ui — the main entry.
 *
 * Everything a host needs, in one import:
 *  - the framework-agnostic spine — the Stages document model, the PageOp
 *    op-spine + pure reduce, fractional ordering keys, and the JS style→CSS
 *    emitter (see `fancy-ui/docs/fancy-cms.md`);
 *  - the React renderer — `CmsPage` / `CmsRegion` / `RenderNode` + the element
 *    registry (also available lean at `./react`);
 *  - the WYSIWYG editor — `Editor` (layers · canvas · inspector) + its pieces
 *    and the pure editor state engine (also at `./editor`).
 *
 * Importing this entry requires `react` to be resolvable. The inline
 * `EditablePage` (which additionally needs `@particle-academy/react-fancy`)
 * lives only on the `./editor` subpath so this entry stays free of that peer.
 */

// ── The spine (framework-agnostic) ──────────────────────────────────────────
export * from "./document/types";
export * from "./document/ops";
export * from "./document/reduce";
export * from "./document/migrate";
// Ordering now comes from the shared substrate. Re-exported so existing
// imports of `keyBetween` from this package keep working.
export { fractionalKey as keyBetween, fractionalKey } from "@particle-academy/fancy-doc-commons";
export { emitDocCss } from "./render/css";

// ── The React renderer (shared by the editor and published islands) ─────────
export * from "./react";

// ── The editor (everything except the react-fancy-dependent EditablePage) ───
export { Editor, type EditorProps } from "./editor/Editor";
export { Canvas, type CanvasProps } from "./editor/Canvas";
export { LayersPanel, type LayersPanelProps } from "./editor/LayersPanel";
export { Inspector, type InspectorProps } from "./editor/Inspector";
export { useEditor, type EditorApi } from "./editor/useEditor";
export { editorReduce, initEditor, type EditorAction, type EditorState } from "./editor/state";
// Element insertion — exported so a host can build its own palette instead of
// the built-in Add menu, while sharing the editor's defaults and placement.
export { ADD_MENU, ADD_DEFAULTS, CONTAINER_TYPES, buildInsertOp, resolveInsertParent, type AddKind } from "./editor/insert";
