import { Fragment, useMemo, type ReactElement } from "react";
import type { PageDoc } from "../document/types";
import type { IconSet } from "../document/icons";
import { rootIds } from "../document/reduce";
import { migrateDoc, type LegacyPageDoc } from "../document/migrate";
import { emitDocCss } from "../render/css";
import type { ImageAssetResolver } from "../render/images";
import { renderNodes } from "./RenderNode";
import { defaultRegistry, type DataContext, type ElementRegistry } from "./registry";

export interface CmsPageProps {
  doc: LegacyPageDoc | PageDoc;
  registry?: ElementRegistry;
  /** Data context that `{ $bind: "…" }` props + repeaters resolve against. */
  data?: DataContext;
  /** Preloaded glyph subset. Import ./icons/<name>, or await ./icons loadIcons. */
  icons?: IconSet;
  /** Host-owned immutable image metadata; documents only name asset handles. */
  imageResolver?: ImageAssetResolver;
  /** Inject the compiled stylesheet. Set false when the host emits CSS itself. */
  includeStyles?: boolean;
}

/** Render a full page document: the compiled stylesheet + every section. */
export function CmsPage({
  doc: input,
  registry = defaultRegistry,
  data,
  icons,
  imageResolver,
  includeStyles = true,
}: CmsPageProps): ReactElement {
  // Renders a pre-`sections[]` document correctly rather than in whatever order
  // its stale order keys happen to imply. The check is an `Array.isArray`, and
  // an already-migrated document comes back by reference, so the memo costs a
  // migrated host nothing.
  const doc = useMemo(() => migrateDoc(input), [input]);

  return (
    <Fragment>
      {includeStyles ? <style data-cms-styles="">{emitDocCss(doc)}</style> : null}
      {renderNodes({ doc, ids: rootIds(doc), registry, data, icons, imageResolver })}
    </Fragment>
  );
}
