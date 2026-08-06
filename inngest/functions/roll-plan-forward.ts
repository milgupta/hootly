import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";

/** Daily 07:00 (docs/04 §6): move overdue incomplete plan items to today,
 *  annotating the original day ("moved from Mon" in the plan UI). */
export const rollPlanForward = inngest.createFunction(
  { id: "roll-plan-forward" },
  { cron: "0 7 * * *" },
  async ({ step }) => {
    const admin = createAdminClient();
    if (!admin) return { skipped: "no service role key" }; // TODO(key-needed)

    const today = new Date().toISOString().slice(0, 10);
    const moved = await step.run("roll-forward", async () => {
      const { data: overdue } = await admin
        .from("study_plan_items")
        .select("id, due_date")
        .is("completed_at", null)
        .lt("due_date", today);
      for (const item of overdue ?? []) {
        await admin
          .from("study_plan_items")
          .update({ due_date: today, moved_from: item.due_date })
          .eq("id", item.id);
      }
      return overdue?.length ?? 0;
    });
    return { moved };
  }
);
