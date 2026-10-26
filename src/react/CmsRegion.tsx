import { Fragment, type ReactElement } from "react";
import type { PageDoc } from "../document/types";
import type { IconSet } from "../document/icons";
import type { ImageAssetResolver } from "../render/images";
import { emitDocCss } from "../render/css";
import { renderNodes } from "./RenderNode";
import {prepareDocFonts,type FontRenderOptions} from "../render/fonts";
import { defaultRegistry, type ElementRegistry } from "./registry";

export interface CmsRegionProps extends FontRenderOptions {
  doc: PageDoc;
  /** Root node id of the region to render (a section, or any node). */
  root: string;
  registry?: ElementRegistry;
  icons?: IconSet;
  imageResolver?: ImageAssetResolver;
  includeStyles?: boolean;
}

/**
 * Render a single subtree — drop into a hand-coded page so the CMS owns just
 * that region (the "guest, not host" mounting mode). Phase 0/1 emits the whole
 * document's CSS; scoping it to the subtree is a later optimization.
 */
export function CmsRegion({
  doc,
  root,
  registry = defaultRegistry,
  icons,
  imageResolver,
  fontResolver,
  fontDisplay,
  includeStyles = true,
}: CmsRegionProps): ReactElement {
  const css=includeStyles ? emitDocCss(doc,{fontResolver,fontDisplay}) : (prepareDocFonts(doc,{fontResolver,fontDisplay}), "");
  return (
    <Fragment>
      {includeStyles ? <style data-cms-styles="">{css}</style> : null}
      {renderNodes({doc,ids:[root],registry,icons,imageResolver})}
    </Fragment>
  );
}
