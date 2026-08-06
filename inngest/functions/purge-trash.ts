import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { hardDeleteTrashed } from "@/lib/trash";

/** Nightly purge (docs/04 §6, cron 0 6 * * *): hard-delete rows soft-deleted >30 days
 *  ago (+ their storage objects), and purge accounts past the 30-day deletion grace. */
export const purgeTrash = inngest.createFunction(
  { id: "purge-trash" },
  { cron: "0 6 * * *" },
  async ({ step }) => {
    const admin = createAdminClient();
    if (!admin) return { skipped: "no service role key" }; // TODO(key-needed)

    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();

    await step.run("purge-trashed-rows", async () => {
      await hardDeleteTrashed(admin, null, cutoff);
      return "done";
    });

    await step.run("purge-deleted-accounts", async () => {
      const { data: doomed } = await admin
        .from("profiles")
        .select("id")
        .lt("deletion_requested_at", cutoff);
      for (const profile of doomed ?? []) {
        // Remove the user's storage prefix first, then the auth user (cascades all rows).
        const { data: objects } = await admin.storage.from("materials").list(profile.id, { limit: 1000 });
        if (objects && objects.length > 0) {
          // List nested material folders and remove their files.
          const paths: string[] = [];
          for (const entry of objects) {
            const { data: files } = await admin.storage
              .from("materials")
              .list(`${profile.id}/${entry.name}`, { limit: 100 });
            for (const f of files ?? []) paths.push(`${profile.id}/${entry.name}/${f.name}`);
          }
          if (paths.length > 0) await admin.storage.from("materials").remove(paths);
        }
        await admin.auth.admin.deleteUser(profile.id);
      }
      return `purged ${doomed?.length ?? 0} accounts`;
    });

    return { ok: true };
  }
);
