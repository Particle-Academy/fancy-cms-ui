/** fancy-mlm-ui components as kit islands. */
import { CommissionStatement, DownlineTree, RankProgress, ReferralStats } from "@particle-academy/fancy-mlm-ui";
import "@particle-academy/fancy-mlm-ui/styles.css";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "fancy-mlm-ui:CommissionStatement": generic(CommissionStatement),
  "fancy-mlm-ui:DownlineTree": generic(DownlineTree),
  "fancy-mlm-ui:RankProgress": generic(RankProgress),
  "fancy-mlm-ui:ReferralStats": generic(ReferralStats),
};
