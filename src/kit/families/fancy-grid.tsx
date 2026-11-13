/** fancy-grid components as kit islands. */
import { FancyDataGrid } from "@particle-academy/fancy-grid";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "fancy-grid:FancyDataGrid": generic(FancyDataGrid),
};
