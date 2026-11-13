/** fancy-motion's React surfaces as kit islands. Reveal and MotionStage hold child nodes. */
import { MotionStage, Reveal, TimelineDock } from "@particle-academy/fancy-motion/react";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "fancy-motion:Reveal": generic(Reveal, { children: "slot" }),
  "fancy-motion:MotionStage": generic(MotionStage, { children: "slot" }),
  "fancy-motion:TimelineDock": generic(TimelineDock),
};
