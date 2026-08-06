"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, Sparkles, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { SourceChip, type SourceChipData } from "@/components/ui/SourceChip";
import { Markdown } from "@/components/notes/Markdown";
import { SourcePane } from "@/components/notes/SourcePane";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { cn } from "@/lib/cn";
import { useJobChannel } from "@/lib/useJobChannel";
import type { Note, NoteSection } from "@/lib/types";
import { regenerateNoteSection, requestNotes } from "../../generate-actions";

const DEPTH_LABEL: Record<string, string> = {
  quick: "Quick recap",
  standard: "Standard",
  comprehensive: "Comprehensive",
};

export function NoteReader({
  note,
  sections,
  chipsByChunk,
  plan,
  courseId,
}: {
  note: Note;
  sections: NoteSection[];
  chipsByChunk: Record<string, SourceChipData>;
  plan: "free" | "plus";
  courseId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [openChunk, setOpenChunk] = React.useState<string | null>(null);
  const [regenerating, setRegenerating] = React.useState<Set<string>>(new Set());
  const [progress, setProgress] = React.useState<{ idx: number; total: number } | null>(null);
  const [pending, startTransition] = React.useTransition();

  // Live section-by-section progress while generating (docs/05 §7.1).
  useJobChannel(note.status === "generating" || note.status === "queued" ? courseId : null, (e) => {
    if (e.stage === "notes_section" && typeof e.idx === "number" && typeof e.total === "number") {
      setProgress({ idx: e.idx + 1, total: e.total });
    }
    if (e.stage === "notes" && e.status === "ready") router.refresh();
    if (e.stage === "failed" && e.artifact === "notes") router.refresh();
  });
  useJobChannel(regenerating.size > 0 ? note.id : null, (e) => {
    if (e.stage === "section_regenerated" && typeof e.sectionId === "string") {
      setRegenerating((s) => {
        const next = new Set(s);
        next.delete(e.sectionId as string);
        return next;
      });
      router.refresh();
    }
  });

  function onRegenerate(sectionId: string) {
    setRegenerating((s) => new Set(s).add(sectionId));
    startTransition(async () => {
      const res = await regenerateNoteSection(sectionId);
      if (!res.ok) {
        setRegenerating((s) => {
          const next = new Set(s);
          next.delete(sectionId);
          return next;
        });
        toast(res.error ?? "Couldn't regenerate — try again.", { kind: "error" });
      }
    });
  }

  // ---- generating / failed / empty states -------------------------------
  if (note.status === "queued" || note.status === "generating") {
    return (
      <div className="reading-measure mx-auto">
        <h1 className="text-h1 mb-1">{note.title}</h1>
        <p className="text-small mb-6 flex items-center gap-2 text-ink-2">
          <OllieAnimated mode="thinking" size={28} />
          {progress
            ? `Generating section ${progress.idx} of ${progress.total}…`
            : "Ollie is reading your materials…"}
        </p>
        <div className="flex flex-col gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton className="mb-3 h-6 w-2/5" />
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (note.status === "failed") {
    return (
      <Card className="mx-auto max-w-[520px] p-0">
        <EmptyState
          ollie={<OllieAnimated mode="concerned" size={72} />}
          message="Generation hiccuped — retry."
          action={
            <div className="flex gap-2">
              <Button
                loading={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await requestNotes({ courseId, depth: note.depth });
                    if (res.ok && res.data) router.push(`/courses/${courseId}/notes/${res.data.noteId}`);
                    else toast(res.error ?? "Couldn't retry.", { kind: "error" });
                  })
                }
              >
                Retry
              </Button>
              <Button variant="secondary" onClick={() => router.push(`/courses/${courseId}?tab=materials`)}>
                Add materials
              </Button>
            </div>
          }
        />
      </Card>
    );
  }

  if (sections.length === 0) {
    return (
      <Card className="mx-auto max-w-[520px] p-0">
        <EmptyState
          message="This note came back empty. Add more materials and Ollie will try again."
          action={
            <Button onClick={() => router.push(`/courses/${courseId}?tab=materials`)}>Add materials</Button>
          }
        />
      </Card>
    );
  }

  // ---- ready ------------------------------------------------------------
  return (
    <div className={cn("flex gap-0", openChunk && "lg:-mr-6")}>
      <article className={cn("min-w-0 flex-1", openChunk ? "lg:pr-6" : "")}>
        <div className="reading-measure mx-auto">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-h1">{note.title}</h1>
            <span className="text-micro rounded-full bg-bg-subtle px-2 py-0.5 font-medium text-ink-2">
              {DEPTH_LABEL[note.depth] ?? note.depth}
            </span>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            {plan === "plus" ? (
              <a
                href={`/api/pdf/note/${note.id}`}
                className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-ctl border border-border bg-surface px-3 text-[13px] font-semibold text-ink transition-all duration-150 hover:border-primary-border"
              >
                <Download className="size-3.5" aria-hidden /> Export PDF
              </a>
            ) : (
              <button
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("hootly:paywall", { detail: { context: "feature:PDF export" } })
                  )
                }
                className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-ctl border border-border bg-surface px-3 text-[13px] font-semibold text-ink-2 transition-all duration-150 hover:border-primary-border hover:text-primary"
              >
                <Lock className="size-3.5" aria-hidden /> Export PDF
                <span className="text-micro rounded-full bg-primary-soft px-1.5 py-0.5 font-semibold text-primary">Plus</span>
              </button>
            )}
          </div>

          {/* Topic-mode badge keys off topic_mode, never off grounded (docs/06 §1.1) */}
          {note.topic_mode && (
            <div className="mb-6 rounded-card border border-border bg-bg-subtle px-4 py-3">
              <p className="text-small text-ink-2">
                📖 From general knowledge — add your class materials to make this course-specific.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-8">
            {sections.map((section) => {
              const chips = section.source_chunk_ids
                .map((id) => chipsByChunk[id])
                .filter((c): c is SourceChipData => Boolean(c));
              const isRegenerating = regenerating.has(section.id);
              const ungrounded = !section.grounded && !note.topic_mode;

              return (
                <section
                  key={section.id}
                  className={cn(
                    "group relative",
                    ungrounded && "border-l-2 border-l-warning pl-4"
                  )}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h2 className="text-h2">{section.heading}</h2>
                    <button
                      onClick={() => onRegenerate(section.id)}
                      disabled={isRegenerating}
                      title="Regenerate section"
                      aria-label={`Regenerate section ${section.heading}`}
                      className="focus-ring shrink-0 rounded-ctl p-1.5 text-ink-3 opacity-0 transition-all duration-150 hover:bg-primary-soft hover:text-primary focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                    >
                      <Sparkles className={cn("size-4", isRegenerating && "animate-pulse")} aria-hidden />
                    </button>
                  </div>

                  {ungrounded && (
                    <p
                      className="text-small mb-2 flex items-center gap-1.5 text-warning"
                      title="Ollie couldn't verify this against your materials."
                    >
                      <AlertTriangle className="size-3.5" aria-hidden />
                      Ollie couldn't verify this against your materials.
                    </p>
                  )}

                  {isRegenerating ? (
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-11/12" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : (
                    <Markdown className="prose-notes text-body text-ink">{section.body_md}</Markdown>
                  )}

                  {chips.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {chips.map((chip) => (
                        <SourceChip
                          key={chip.chunkId}
                          source={chip}
                          onOpen={(s) => setOpenChunk(s.chunkId)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </article>

      {openChunk && (
        <div className="fixed inset-0 z-40 bg-bg lg:relative lg:inset-auto lg:z-auto lg:h-[calc(100vh-56px)] lg:w-[380px] lg:shrink-0">
          <SourcePane chunkId={openChunk} onClose={() => setOpenChunk(null)} />
        </div>
      )}
    </div>
  );
}
