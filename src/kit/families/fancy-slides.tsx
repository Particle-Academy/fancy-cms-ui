/** fancy-slides' viewers as kit islands. */
import { DeckFileView, PresenterView, SlideViewer } from "@particle-academy/fancy-slides";
import "@particle-academy/fancy-slides/styles.css";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "fancy-slides:SlideViewer": generic(SlideViewer),
  "fancy-slides:PresenterView": generic(PresenterView),
  "fancy-slides:DeckFileView": generic(DeckFileView),
};
