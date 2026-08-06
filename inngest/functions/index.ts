import { purgeTrash } from "./purge-trash";
import { rollPlanForward } from "./roll-plan-forward";

/** All Inngest functions served at /api/inngest (grows per milestone). */
export const functions = [purgeTrash, rollPlanForward];
