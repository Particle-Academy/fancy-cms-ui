import { Fragment, type ReactElement } from "react";
import type { PageDoc } from "../document/types";
import type { IconSet } from "../document/icons";
import type { ImageAssetResolver } from "../render/images";
import { emitDocCss } from "../render/css";
import { RenderNode } from "./RenderNode";
import { defaultRegistry, type ElementRegistry } from "./registry";

export interface CmsRegionProps {
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
  includeStyles = true,
}: CmsRegionProps): ReactElement {
  return (
    <Fragment>
      {includeStyles ? <style data-cms-styles="">{emitDocCss(doc)}</style> : null}
      <RenderNode doc={doc} id={root} registry={registry} icons={icons} imageResolver={imageResolver} />
    </Fragment>
  );
}
