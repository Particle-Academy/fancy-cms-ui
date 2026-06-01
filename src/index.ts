/**
 * @particle-academy/fancy-cms-ui — Phase 0 spine.
 *
 * The Stages document model, the PageOp op-spine + pure reduce, and the JS
 * style→CSS emitter. See `fancy-ui/docs/fancy-cms.md`.
 */
export * from "./document/types";
export * from "./document/ops";
export * from "./document/reduce";
export { keyBetween } from "./document/fractional";
export { emitDocCss } from "./render/css";
