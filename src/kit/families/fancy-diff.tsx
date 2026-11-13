/** fancy-diff as a kit island; accept and reject choices stay in the page. */
import { FancyDiff } from "@particle-academy/fancy-diff";
import "@particle-academy/fancy-diff/styles.css";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "fancy-diff:FancyDiff": generic(FancyDiff, { state: { value: "value", default: "defaultValue", change: "onChange" } }),
};
