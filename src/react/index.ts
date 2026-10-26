/**
 * @particle-academy/fancy-cms-ui/react — the React renderer.
 *
 * The same renderer drives the editor (edit mode) and the published islands
 * (view mode). Pairs with the framework-agnostic spine exported from the root.
 */
export { RenderNode, type RenderNodeProps } from "./RenderNode";
export { CmsPage, type CmsPageProps } from "./CmsPage";
export { CmsRegion, type CmsRegionProps } from "./CmsRegion";
export type { ImageAssetResolver, ImageAsset, ImageVariant } from "../render/images";
export {FontResolutionException} from "../render/fonts";
export type {FontRef,FontReference,ResolvedFontReference,FontAsset,FontFaceAsset,FontAssetResolver,FontRenderOptions,FontResolutionReason,FontSource,FontStyle} from "../render/fonts";
export {
  defaultRegistry,
  getPath,
  resolveValue,
  type DataContext,
  type ElementContext,
  type ElementRegistry,
  type ElementRenderer,
} from "./registry";
