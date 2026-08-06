import { purgeTrash } from "./purge-trash";
import { rollPlanForward } from "./roll-plan-forward";
import { ingestMaterial } from "./ingest-material";
import { buildCourse } from "./build-course";
import { generateNotes } from "./generate-notes";
import { regenerateSection } from "./regenerate-section";
import { generateCards } from "./generate-cards";
import { generateQuiz } from "./generate-quiz";
import { generatePlan } from "./generate-plan";
import { exportAccount } from "./export-account";

/** All Inngest functions served at /api/inngest. */
export const functions = [
  ingestMaterial,
  buildCourse,
  generateNotes,
  regenerateSection,
  generateCards,
  generateQuiz,
  generatePlan,
  exportAccount,
  rollPlanForward,
  purgeTrash,
];
