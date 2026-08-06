import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/data";
import { stripChunkMarkers } from "@/lib/ai/rag";
import type { NoteSection } from "@/lib/types";

/** PDF export (docs/04 §7) — Plus-gated, @react-pdf/renderer. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const { noteId } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));

  const plan = await getPlan(user.id);
  if (plan !== "plus") {
    return NextResponse.json({ error: "plus_required" }, { status: 402 });
  }

  const { data: note } = await supabase
    .from("notes")
    .select("id, title, depth, topic_mode")
    .eq("id", noteId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!note) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: sections } = await supabase
    .from("note_sections")
    .select("*")
    .eq("note_id", noteId)
    .order("idx");

  const { renderToBuffer, Document, Page, Text, View, StyleSheet } = await import("@react-pdf/renderer");
  const React = (await import("react")).default;

  const styles = StyleSheet.create({
    page: { paddingTop: 56, paddingBottom: 56, paddingHorizontal: 56, fontSize: 11, lineHeight: 1.6, color: "#17171C" },
    title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
    meta: { fontSize: 9, color: "#9494A6", marginBottom: 22 },
    heading: { fontSize: 14, fontWeight: 700, marginTop: 18, marginBottom: 6 },
    body: { marginBottom: 6 },
    badge: { fontSize: 9, color: "#5C5C6B", marginBottom: 14 },
    footer: { position: "absolute", bottom: 28, left: 56, right: 56, fontSize: 8, color: "#9494A6" },
  });

  const children = [
    React.createElement(Text, { key: "t", style: styles.title }, note.title),
    React.createElement(
      Text,
      { key: "m", style: styles.meta },
      `${note.depth} · exported from Hootly on ${new Date().toLocaleDateString()}`
    ),
  ];
  if (note.topic_mode) {
    children.push(
      React.createElement(
        Text,
        { key: "b", style: styles.badge },
        "From general knowledge — add your class materials to make this course-specific."
      )
    );
  }
  for (const section of (sections ?? []) as NoteSection[]) {
    children.push(
      React.createElement(Text, { key: `h-${section.id}`, style: styles.heading }, section.heading)
    );
    // Strip chunk markers and light markdown syntax for the print rendering.
    const body = stripChunkMarkers(section.body_md)
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1");
    for (const [i, para] of body.split(/\n{2,}/).filter(Boolean).entries()) {
      children.push(
        React.createElement(Text, { key: `p-${section.id}-${i}`, style: styles.body }, para.trim())
      );
    }
  }

  const doc = React.createElement(
    Document,
    { title: note.title },
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(View, null, ...children),
      React.createElement(
        Text,
        { style: styles.footer, fixed: true },
        "Made with Hootly · hootly.app"
      )
    )
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(doc as any);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${note.title.replace(/[^\w\-. ]/g, "_")}.pdf"`,
    },
  });
}
