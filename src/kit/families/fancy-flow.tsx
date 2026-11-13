/** fancy-flow components as kit islands. */
import { FlowViewer, FlowRunFeed } from "@particle-academy/fancy-flow";
import "@particle-academy/fancy-flow/styles.css";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "fancy-flow:FlowViewer": generic(FlowViewer),
  "fancy-flow:FlowRunFeed": generic(FlowRunFeed),
};
