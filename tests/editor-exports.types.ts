/**
 * Compile-time proof that the `/editor` entry exports every type a consumer
 * needs to name. Not a runtime test — the assertions ARE the imports, and this
 * file failing to compile is the failure.
 *
 * `NodeTransform` went four releases unexported while appearing in two of
 * `EditablePage`'s props, so a consumer writing an `onNodeTransform` handler
 * had no way to type its argument. The showcase imported it anyway and carried
 * a permanent type error in the app that exists to demonstrate this package.
 *
 * The gap is invisible from inside: the package builds fine and only a CONSUMER
 * discovers it. Importing through the same barrel a consumer uses is the only
 * check that sees what they see.
 */

import type {
  CanvasProps,
  EditablePageProps,
  EditorApi,
  EditorAction,
  EditorProps,
  EditorState,
  InspectorProps,
  LayersPanelProps,
  NodeInspectorProps,
  NodeTransform,
} from "../src/editor/index";

// Every prop type a consumer must be able to name, used so an unused-import
// rule cannot quietly delete the thing being proven.
type Exports = {
  canvas: CanvasProps;
  editablePage: EditablePageProps;
  editorApi: EditorApi;
  editorAction: EditorAction;
  editor: EditorProps;
  editorState: EditorState;
  inspector: InspectorProps;
  layers: LayersPanelProps;
  nodeInspector: NodeInspectorProps;
  transform: NodeTransform;
};

// The handler a consumer actually writes. This is the shape that was
// unwritable: the second parameter had no nameable type.
const onNodeTransform: NonNullable<EditablePageProps["onNodeTransform"]> = (
  _id: string,
  _transform: NodeTransform,
): void => {};

export type { Exports };
export { onNodeTransform };
