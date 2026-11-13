/** fancy-docs components as kit islands. */
import { DocViewer, DocFileView } from "@particle-academy/fancy-docs";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "fancy-docs:DocViewer": generic(DocViewer),
  "fancy-docs:DocFileView": generic(DocFileView),
};
