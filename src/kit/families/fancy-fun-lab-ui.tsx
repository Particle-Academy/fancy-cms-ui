/** fancy-fun-lab-ui components as kit islands. */
import { FunLabAchievementGrid, FunLabLeaderboard, FunLabLevelUp, FunLabProfileSummary, FunLabXpFeed } from "@particle-academy/fancy-fun-lab-ui";
import "@particle-academy/fancy-fun-lab-ui/styles.css";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "fancy-fun-lab-ui:FunLabAchievementGrid": generic(FunLabAchievementGrid),
  "fancy-fun-lab-ui:FunLabLeaderboard": generic(FunLabLeaderboard),
  "fancy-fun-lab-ui:FunLabLevelUp": generic(FunLabLevelUp),
  "fancy-fun-lab-ui:FunLabProfileSummary": generic(FunLabProfileSummary),
  "fancy-fun-lab-ui:FunLabXpFeed": generic(FunLabXpFeed),
};
