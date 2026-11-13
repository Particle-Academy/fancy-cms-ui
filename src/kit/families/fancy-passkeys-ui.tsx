/** fancy-passkeys-ui components as kit islands. */
import { PasskeyStatus } from "@particle-academy/fancy-passkeys-ui";
import "@particle-academy/fancy-passkeys-ui/styles.css";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "fancy-passkeys-ui:PasskeyStatus": generic(PasskeyStatus),
};
