/** classroom components as kit islands (read-only views; enrolment and grading stay on the server). */
import { CertificateView, CurriculumOverview, LessonView, QuestionRenderer } from "@particle-academy/classroom";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "classroom:CurriculumOverview": generic(CurriculumOverview),
  "classroom:LessonView": generic(LessonView),
  "classroom:CertificateView": generic(CertificateView),
  "classroom:QuestionRenderer": generic(QuestionRenderer, { state: { value: "value", change: "onChange" } }),
};
