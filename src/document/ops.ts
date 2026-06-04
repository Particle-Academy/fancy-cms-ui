/**
 * `PageOp` — the closed set of mutations. Every edit (human drag, agent tool
 * call, collab message) is one of these, reduced by the pure `reduce` in
 * `reduce.ts`. See `fancy-ui/docs/fancy-cms.md` §4.
 */
import type {
  Action,
  Anim,
  Breakpoint,
  Constraints,
  LayoutMode,
  Node,
  NodeId,
  PageMeta,
  StyleProps,
  ThemeTokens,
} from "./types";

export type Actor = { kind: "human" | "agent"; id: string };

export type PageOp =
  | { t: "insert_node"; node: Node }
  | { t: "remove_node"; id: NodeId }
  | { t: "move_node"; id: NodeId; parent: NodeId | null; order: string }
  | { t: "set_props"; id: NodeId; patch: Record<string, unknown> }
  | { t: "set_layout"; id: NodeId; layout: LayoutMode | undefined }
  | { t: "set_style"; id: NodeId; breakpoint: Breakpoint; patch: Partial<StyleProps> }
  | { t: "set_constraints"; id: NodeId; breakpoint: Breakpoint; patch: Partial<Constraints> }
  | { t: "set_animation"; id: NodeId; anim: Anim }
  | { t: "remove_animation"; id: NodeId; animId: string }
  | { t: "set_action"; id: NodeId; index: number; action: Action | null }
  | { t: "set_meta"; patch: Partial<PageMeta> }
  | { t: "set_theme"; patch: Partial<ThemeTokens> }
  | { t: "reorder_sections"; order: NodeId[] };

export type PageOpType = PageOp["t"];

/** Wire envelope — carries provenance + ordering. `pending` = an agent proposal. */
export interface OpEnvelope {
  op: PageOp;
  actor: Actor;
  ts: number;
  seq: number;
  pending?: boolean;
}
