/** fancy-x-files-ui's well-known file editors as kit islands; the value stays in the page. */
import { AgentsEditor, HumansTxtEditor, LlmsTxtEditor, RobotsEditor, SecurityTxtEditor, SitemapEditor, XFilePreview, XFilesManager } from "@particle-academy/fancy-x-files-ui";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

const edit = { state: { value: "value", change: "onChange" } };

export const islands: Record<string, IslandComponent> = {
  "fancy-x-files-ui:RobotsEditor": generic(RobotsEditor, edit),
  "fancy-x-files-ui:LlmsTxtEditor": generic(LlmsTxtEditor, edit),
  "fancy-x-files-ui:SecurityTxtEditor": generic(SecurityTxtEditor, edit),
  "fancy-x-files-ui:HumansTxtEditor": generic(HumansTxtEditor, edit),
  "fancy-x-files-ui:SitemapEditor": generic(SitemapEditor, edit),
  "fancy-x-files-ui:AgentsEditor": generic(AgentsEditor, edit),
  "fancy-x-files-ui:XFilePreview": generic(XFilePreview),
  "fancy-x-files-ui:XFilesManager": generic(XFilesManager, edit),
};
