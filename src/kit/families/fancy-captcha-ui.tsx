/** fancy-captcha-ui components as kit islands. */
import { Captcha } from "@particle-academy/fancy-captcha-ui";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "fancy-captcha-ui:Captcha": generic(Captcha),
};
