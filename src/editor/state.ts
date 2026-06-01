/**
 * Editor state engine — pure and framework-agnostic so it's unit-testable.
 * `useEditor` wraps this with `useReducer`. Undo/redo uses document snapshots
 * (simple + robust); the op-level `invert` in the spine is for collab/op-stream
 * undo.
 */
import type { PageDoc } from "../document/types";
import type { PageOp } from "../document/ops";
import { reduce } from "../document/reduce";

export interface EditorState {
  doc: PageDoc;
  past: PageDoc[];
  future: PageDoc[];
  selection: string | null;
}

export type EditorAction =
  | { type: "apply"; op: PageOp }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "select"; id: string | null }
  | { type: "replace"; doc: PageDoc };

const HISTORY_LIMIT = 100;

export function initEditor(doc: PageDoc): EditorState {
  return { doc, past: [], future: [], selection: null };
}

export function editorReduce(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "apply": {
      const next = reduce(state.doc, action.op);
      if (next === state.doc) return state; // invalid op → no-op, no history entry
      return {
        ...state,
        doc: next,
        past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
        future: [],
      };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1]!;
      return {
        ...state,
        doc: prev,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future],
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0]!;
      return {
        ...state,
        doc: next,
        past: [...state.past, state.doc],
        future: state.future.slice(1),
      };
    }
    case "select":
      return state.selection === action.id ? state : { ...state, selection: action.id };
    case "replace":
      return state.doc === action.doc ? state : { ...state, doc: action.doc, future: [] };
    default:
      return state;
  }
}
