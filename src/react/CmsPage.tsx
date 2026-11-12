import { useMemo, type ReactElement } from "react";
import type { PageDoc } from "../document/types";
import type { IconSet } from "../document/icons";
import { rootIds } from "../document/reduce";
import { migrateDoc, type LegacyPageDoc } from "../document/migrate";
import { emitDocCss } from "../render/css";
import type { ImageAssetResolver } from "../render/images";
import {prepareDocFonts,type FontRenderOptions} from "../render/fonts";
import { styleKey } from "../render/style-tag";
import { renderNodes } from "./RenderNode";
import { defaultRegistry, type DataContext, type ElementRegistry } from "./registry";
import type { IslandRegistry } from "./islands";
import { useCmsHeadStyles } from "./headStyles";
import { InputsProvider, usePageInputs, type PageInputProps } from "./inputs";

export interface CmsPageProps extends FontRenderOptions, PageInputProps {
  doc: LegacyPageDoc | PageDoc;
  registry?: ElementRegistry;
  /** Data context that `{ $bind: "…" }` props + repeaters resolve against. */
  data?: DataContext;
  /** Preloaded glyph subset. Import ./icons/<name>, or await ./icons loadIcons. */
  icons?: IconSet;
  /** Host-owned immutable image metadata; documents only name asset handles. */
  imageResolver?: ImageAssetResolver;
  /** Island registry: the built-ins plus the host's (`registerIslands`). Default: the built-ins. */
  islands?: IslandRegistry;
  /**
   * Keep the compiled stylesheet in `document.head` (default). Nothing is
   * rendered in the page's own markup: a server-rendered first byte gets its
   * CSS from the host's head (`cmsStyleTag` / `cmsHeadStyle`, or the PHP
   * renderer's `css`). Set false when the host supplies the CSS everywhere.
   */
  includeStyles?: boolean;
}

/**
 * Render a full page document. Its stylesheet goes to `<head>` (never inside
 * the host's container, where a `<style>` is invalid HTML), and its page
 * inputs, if it has any, drive the data it renders with (`loadData`).
 */
export function CmsPage({
  doc: input,
  registry = defaultRegistry,
  data,
  icons,
  imageResolver,
  islands,
  fontResolver,
  fontDisplay,
  includeStyles = true,
  inputs,
  defaultInputs,
  onInputsChange,
  loadData,
}: CmsPageProps): ReactElement {
  // Renders a pre-`sections[]` document correctly rather than in whatever order
  // its stale order keys happen to imply. The check is an `Array.isArray`, and
  // an already-migrated document comes back by reference, so the memo costs a
  // migrated host nothing.
  const doc = useMemo(() => migrateDoc(input), [input]);
  // Even a host supplying its own stylesheet must resolve structured fonts.
  const css=includeStyles ? emitDocCss(doc,{fontResolver,fontDisplay}) : (prepareDocFonts(doc,{fontResolver,fontDisplay}), "");
  useCmsHeadStyles(styleKey(doc), css);
  const page = usePageInputs(doc, data, { inputs, defaultInputs, onInputsChange, loadData });

  return <InputsProvider state={page.state}>{renderNodes({ doc, ids: rootIds(doc), registry, data: page.data, icons, imageResolver, islands })}</InputsProvider>;
}
