import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendExportReadyEmail } from "@/lib/email";

/** export-account (docs/04 §6): gather user JSON + files → zip to storage →
 *  email a signed link (Resend). GDPR/CCPA self-serve export. */
export const exportAccount = inngest.createFunction(
  { id: "export-account", retries: 1 },
  { event: "account/export" },
  async ({ event, step }) => {
    const userId = event.data.userId as string;
    const admin = createAdminClient();
    if (!admin) return { skipped: "no service role key" }; // TODO(key-needed)

    const zipPath = await step.run("build-zip", async () => {
      const tables = [
        "profiles", "courses", "materials", "notes", "note_sections", "flashcards",
        "card_reviews", "quizzes", "quiz_questions", "quiz_attempts", "attempt_answers",
        "chat_threads", "chat_messages", "study_plan_items", "subscriptions", "usage_counters",
      ] as const;
      const payload: Record<string, unknown> = { exported_at: new Date().toISOString() };
      for (const table of tables) {
        const column = table === "profiles" ? "id" : "user_id";
        const { data } = await admin.from(table).select("*").eq(column, userId);
        payload[table] = data ?? [];
      }

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.file("hootly-data.json", JSON.stringify(payload, null, 2));

      // Original uploaded files.
      const { data: materials } = await admin
        .from("materials")
        .select("id, title, storage_path")
        .eq("user_id", userId)
        .not("storage_path", "is", null);
      const files = zip.folder("files");
      for (const m of materials ?? []) {
        const { data: blob } = await admin.storage.from("materials").download(m.storage_path as string);
        if (blob) {
          const ext = (m.storage_path as string).split(".").pop() ?? "bin";
          files?.file(`${m.title.replace(/[^\w\-. ]/g, "_")}-${(m.id as string).slice(0, 8)}.${ext}`,
            Buffer.from(await blob.arrayBuffer()));
        }
      }

      const content = await zip.generateAsync({ type: "nodebuffer" });
      const path = `${userId}/exports/hootly-export-${Date.now()}.zip`;
      const { error } = await admin.storage.from("materials").upload(path, content, {
        contentType: "application/zip",
        upsert: true,
      });
      if (error) throw new Error(error.message);
      return path;
    });

    await step.run("email-link", async () => {
      const { data: signed } = await admin.storage
        .from("materials")
        .createSignedUrl(zipPath, 60 * 60 * 24 * 7);
      const { data: profile } = await admin
        .from("profiles")
        .select("email, display_name")
        .eq("id", userId)
        .maybeSingle();
      if (signed?.signedUrl && profile?.email) {
        await sendExportReadyEmail(profile.email, signed.signedUrl);
      }
      return "sent";
    });

    return { ok: true };
  }
);
