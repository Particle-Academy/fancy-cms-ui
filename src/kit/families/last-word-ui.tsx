/** last-word-ui components as kit islands. */
import { DocViewer } from "@particle-academy/last-word-ui";
import "@particle-academy/last-word-ui/styles.css";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "last-word-ui:DocViewer": generic(DocViewer),
};
