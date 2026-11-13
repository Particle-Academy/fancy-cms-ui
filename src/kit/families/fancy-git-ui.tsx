/** fancy-git-ui components as kit islands. */
import { BranchPicker, CommitHistory, DiffViewer, RepositoryBrowser, ReviewList, WorkingTree } from "@particle-academy/fancy-git-ui";
import "@particle-academy/fancy-git-ui/styles.css";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "fancy-git-ui:BranchPicker": generic(BranchPicker),
  "fancy-git-ui:CommitHistory": generic(CommitHistory),
  "fancy-git-ui:DiffViewer": generic(DiffViewer),
  "fancy-git-ui:RepositoryBrowser": generic(RepositoryBrowser),
  "fancy-git-ui:ReviewList": generic(ReviewList),
  "fancy-git-ui:WorkingTree": generic(WorkingTree),
};
