import { useCallback, useMemo, useReducer } from "react";
import type { PageDoc } from "../document/types";
import type { PageOp } from "../document/ops";
import { editorReduce, initEditor, type EditorState } from "./state";

export interface EditorApi {
  state: EditorState;
  /** Dispatch a mutation through the op-spine (records an undo snapshot). */
  apply: (op: PageOp) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  /** Replace the document wholesale (e.g. a controlled `value` change). */
  replace: (doc: PageDoc) => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useEditor(initialDoc: PageDoc): EditorApi {
  const [state, dispatch] = useReducer(editorReduce, initialDoc, initEditor);
  const apply = useCallback((op: PageOp) => dispatch({ type: "apply", op }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const select = useCallback((id: string | null) => dispatch({ type: "select", id }), []);
  const replace = useCallback((doc: PageDoc) => dispatch({ type: "replace", doc }), []);

  return useMemo(
    () => ({
      state,
      apply,
      undo,
      redo,
      select,
      replace,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
    }),
    [state, apply, undo, redo, select, replace],
  );
}
