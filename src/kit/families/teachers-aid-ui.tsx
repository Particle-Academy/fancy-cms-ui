/** teachers-aid-ui components as kit islands. */
import { ChatTranscript } from "@particle-academy/teachers-aid-ui";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "teachers-aid-ui:ChatTranscript": generic(ChatTranscript),
};
