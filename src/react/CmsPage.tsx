import { Fragment, type ReactElement } from "react";
import type { PageDoc } from "../document/types";
import { emitDocCss } from "../render/css";
import { RenderNode } from "./RenderNode";
import { defaultRegistry, type ElementRegistry } from "./registry";

export interface CmsPageProps {
  doc: PageDoc;
  registry?: ElementRegistry;
  /** Inject the compiled stylesheet. Set false when the host emits CSS itself. */
  includeStyles?: boolean;
}

/** Render a full page document: the compiled stylesheet + every section. */
export function CmsPage({
  doc,
  registry = defaultRegistry,
  includeStyles = true,
}: CmsPageProps): ReactElement {
  return (
    <Fragment>
      {includeStyles ? <style data-cms-styles="">{emitDocCss(doc)}</style> : null}
      {doc.sections.map((id) => (
        <RenderNode key={id} doc={doc} id={id} registry={registry} />
      ))}
    </Fragment>
  );
}
