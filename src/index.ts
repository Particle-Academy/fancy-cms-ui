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
export { iconNames, searchIcons, type IconProps, type IconPrimitive, type IconSet, type IconSearch } from "./document/icons";
export { decorationError } from "./document/decorative";
export { bindingSources, isLiveBinding } from "./document/bindings";
export type { BindingSource, LiveBinding } from "./document/bindings";
export * from "./document/ops";
export * from "./document/reduce";
export * from "./document/migrate";
// Ordering now comes from the shared substrate. Re-exported so existing
// imports of `keyBetween` from this package keep working.
export { fractionalKey as keyBetween, fractionalKey } from "@particle-academy/fancy-doc-commons";
export { emitDocCss } from "./render/css";
// The infographic kit, the island catalogue, and the data-request seam.
export { INFOGRAPHIC_TYPES, isInfographicType, EMPTY_TEXT, type InfographicType } from "./render/infographics";
export { formatNumber, formatSpec, signedNumber, toNumber, type NumberFormatKind, type NumberFormatSpec } from "./render/number-format";
export { BUILTIN_ISLAND_CATALOGUE, ISLAND_TYPE_PATTERN, islandCatalogue, type IslandCatalogueJson, type IslandDescriptor, type IslandHydration, type JsonSchema } from "./islands/catalogue";
export { dataQueries, dataRequests, expectedShape, type DataQuery, type DataQueryOptions, type DataRequest } from "./document/data";
// Page inputs (phase 2): declarations, normalised values, and their query-string form.
export {
  INPUT_KINDS,
  INPUT_NAME_PATTERN,
  INPUT_EMPTY_TEXT,
  PERIOD_PRESETS,
  INPUT_CSS,
  inputKind,
  inputModel,
  inputOptions,
  inputValues,
  inputsFromQuery,
  inputsToQuery,
  isIsoDate,
  normalizeInput,
  pageInputs,
  type DateRange,
  type InputDeclaration,
  type InputKind,
  type InputModel,
  type InputOption,
  type InputValue,
  type InputValues,
} from "./render/inputs";
// The stylesheet's place is the host's <head> (lab finding K20).
export { cmsStyleTag, styleTagHtml, styleKey } from "./render/style-tag";

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
