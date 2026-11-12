import type { ReactElement } from "react";
import type { PageDoc } from "../document/types";
import type { IconSet } from "../document/icons";
import type { ImageAssetResolver } from "../render/images";
import { emitDocCss } from "../render/css";
import { styleKey } from "../render/style-tag";
import { renderNodes } from "./RenderNode";
import {prepareDocFonts,type FontRenderOptions} from "../render/fonts";
import { defaultRegistry, type DataContext, type ElementRegistry } from "./registry";
import type { IslandRegistry } from "./islands";
import { useCmsHeadStyles } from "./headStyles";
import { InputsProvider, usePageInputs, type PageInputProps } from "./inputs";

export interface CmsRegionProps extends FontRenderOptions, PageInputProps {
  doc: PageDoc;
  /** Root node id of the region to render (a section, or any node). */
  root: string;
  registry?: ElementRegistry;
  /** Data context that `{ $bind }` props resolve against, as on CmsPage. */
  data?: DataContext;
  icons?: IconSet;
  imageResolver?: ImageAssetResolver;
  /** Island registry: the built-ins plus the host's (`registerIslands`). Default: the built-ins. */
  islands?: IslandRegistry;
  /** Keep the stylesheet in `document.head`, as on CmsPage. */
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
  islands,
  data,
  fontResolver,
  fontDisplay,
  includeStyles = true,
  inputs,
  defaultInputs,
  onInputsChange,
  loadData,
}: CmsRegionProps): ReactElement {
  const css=includeStyles ? emitDocCss(doc,{fontResolver,fontDisplay}) : (prepareDocFonts(doc,{fontResolver,fontDisplay}), "");
  useCmsHeadStyles(styleKey(doc), css);
  const page = usePageInputs(doc, data, { inputs, defaultInputs, onInputsChange, loadData });
  return <InputsProvider state={page.state}>{renderNodes({doc,ids:[root],registry,data:page.data,icons,imageResolver,islands})}</InputsProvider>;
}
