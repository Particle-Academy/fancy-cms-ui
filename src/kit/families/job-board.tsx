/** job-board components as kit islands. */
import { JobBoard, JobCard, JobDetail, ApplicationList, EmployerJobList } from "@particle-academy/job-board";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "job-board:JobBoard": generic(JobBoard),
  "job-board:JobCard": generic(JobCard),
  "job-board:JobDetail": generic(JobDetail),
  "job-board:ApplicationList": generic(ApplicationList),
  "job-board:EmployerJobList": generic(EmployerJobList),
};
