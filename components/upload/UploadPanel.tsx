"use client";

import * as React from "react";
import { FileUp, Link2, ClipboardPaste, Camera, Lightbulb, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Meter } from "@/components/ui/Meter";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { env } from "@/lib/env";
import { ACCEPT_ATTR, kindForFilename, MAX_UPLOAD_BYTES } from "@/lib/upload";
import { useJobChannel, type JobEvent } from "@/lib/useJobChannel";
import {
  addNonFileMaterial,
  confirmUpload,
  requestUpload,
  retryMaterial,
} from "@/app/(app)/courses/[courseId]/actions";
import { LIMITS } from "@/lib/billing/limits";

export type UploadRowStatus = "uploading" | "queued" | "processing" | "ready" | "failed";

export interface UploadRow {
  key: string;
  materialId: string | null;
  filename: string;
  size: number | null;
  status: UploadRowStatus;
  pct: number;
  statusText: string;
  errorCode?: string;
  errorDetail?: string;
}

const TOPIC_PRESETS = ["AP Biology", "US History", "Algebra II", "Chemistry", "World Literature", "Physics"];

const STAGE_TEXT: Record<string, string> = {
  processing: "Preparing…",
  extracting: "Reading your material…",
  chunking: "Indexing sections…",
  embedding: "Teaching Ollie where everything lives…",
  ready: "Done",
  failed: "Failed",
};

function ProgressWatcher({
  materialId,
  onEvent,
}: {
  materialId: string;
  onEvent: (id: string, e: JobEvent) => void;
}) {
  useJobChannel(materialId, (e) => onEvent(materialId, e));
  return null;
}

/** The one upload surface (docs/05 §4.4), reused by the Materials tab modal and
 *  onboarding: dropzone + Quizlet/paste/photo/YouTube chips + topic presets +
 *  per-file progress with doc 04 §9 error copy + free-plan meter footer. */
export function UploadPanel({
  courseId,
  plan,
  uploadsUsed,
  showTopicOption = false,
  onTopicChosen,
  onRowsChange,
  autoOpenPicker = false,
}: {
  courseId: string;
  plan: "free" | "plus";
  uploadsUsed: number;
  /** Onboarding: show "Just give me a topic" + escape hatch. */
  showTopicOption?: boolean;
  onTopicChosen?: (topic: string) => void;
  onRowsChange?: (rows: UploadRow[]) => void;
  autoOpenPicker?: boolean;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<UploadRow[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const [pasteOpen, setPasteOpen] = React.useState<"pasted" | "quizlet" | null>(null);
  const [pasteTitle, setPasteTitle] = React.useState("");
  const [pasteText, setPasteText] = React.useState("");
  const [ytOpen, setYtOpen] = React.useState(false);
  const [ytUrl, setYtUrl] = React.useState("");
  const [topicOpen, setTopicOpen] = React.useState(false);
  const [customTopic, setCustomTopic] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const fileInput = React.useRef<HTMLInputElement>(null);
  const photoInput = React.useRef<HTMLInputElement>(null);
  const [localUsed, setLocalUsed] = React.useState(uploadsUsed);

  const rowsRef = React.useRef(rows);
  rowsRef.current = rows;
  const emit = React.useCallback(
    (next: UploadRow[]) => {
      setRows(next);
      onRowsChange?.(next);
    },
    [onRowsChange]
  );

  React.useEffect(() => {
    if (autoOpenPicker) fileInput.current?.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenPicker]);

  const updateRow = React.useCallback(
    (key: string, patch: Partial<UploadRow>) => {
      emit(rowsRef.current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    },
    [emit]
  );

  const onJobEvent = React.useCallback(
    (materialId: string, e: JobEvent) => {
      const row = rowsRef.current.find((r) => r.materialId === materialId);
      if (!row) return;
      if (e.stage === "failed") {
        updateRow(row.key, {
          status: "failed",
          statusText: "Failed",
          errorCode: e.error_code,
          errorDetail: e.error_detail,
        });
      } else if (e.stage === "ready") {
        updateRow(row.key, { status: "ready", pct: 100, statusText: "Done" });
      } else if (e.stage) {
        updateRow(row.key, {
          status: "processing",
          pct: Math.max(row.pct, e.pct ?? 0),
          statusText: STAGE_TEXT[e.stage] ?? "Processing…",
        });
      }
    },
    [updateRow]
  );

  async function uploadFile(file: File) {
    const key = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const kind = kindForFilename(file.name);
    if (!kind) {
      emit([
        ...rowsRef.current,
        {
          key, materialId: null, filename: file.name, size: file.size,
          status: "failed", pct: 0, statusText: "Failed",
          errorCode: "unsupported_format",
          errorDetail: "This file type isn't supported — see the list of formats we read.",
        },
      ]);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      emit([
        ...rowsRef.current,
        {
          key, materialId: null, filename: file.name, size: file.size,
          status: "failed", pct: 0, statusText: "Failed",
          errorCode: "file_too_large",
          errorDetail: `Max 100MB — this file is ${Math.round(file.size / 1024 / 1024)}MB.`,
        },
      ]);
      return;
    }

    emit([
      ...rowsRef.current,
      { key, materialId: null, filename: file.name, size: file.size, status: "uploading", pct: 0, statusText: "Uploading…" },
    ]);

    const res = await requestUpload({ courseId, filename: file.name, byteSize: file.size });
    if (!res.ok || !res.data) {
      if (res.code === "limit_reached") {
        updateRow(key, { status: "failed", statusText: "Failed", errorCode: "limit_reached", errorDetail: "Free upload limit reached." });
        window.dispatchEvent(new CustomEvent("hootly:paywall", { detail: { context: "limit:uploads" } }));
        return;
      }
      updateRow(key, { status: "failed", statusText: "Failed", errorCode: res.code, errorDetail: res.error });
      return;
    }
    const { materialId, path, token } = res.data;
    updateRow(key, { materialId });

    // PUT to the signed upload URL with real progress (docs/05 §4.4 per-file bars).
    const url = `${env.supabaseUrl}/storage/v1/object/upload/sign/materials/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}?token=${encodeURIComponent(token)}`;
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            updateRow(key, { pct: Math.round((evt.loaded / evt.total) * 40) });
          }
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("network"));
        xhr.send(file);
      });
    } catch {
      updateRow(key, { status: "failed", statusText: "Failed", errorDetail: "Upload interrupted — check your connection and retry." });
      return;
    }

    updateRow(key, { status: "queued", pct: 45, statusText: "Queued…" });
    setLocalUsed((u) => u + 1);
    const confirmed = await confirmUpload(materialId);
    if (!confirmed.ok) {
      updateRow(key, { status: "failed", statusText: "Failed", errorDetail: confirmed.error });
    }
  }

  function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) void uploadFile(file);
  }

  function addNonFile(kind: "pasted" | "quizlet" | "youtube" | "topic", payload: { title?: string; text?: string; url?: string }) {
    startTransition(async () => {
      const res = await addNonFileMaterial({ courseId, kind, ...payload });
      if (!res.ok || !res.data) {
        if (res.code === "limit_reached") {
          window.dispatchEvent(new CustomEvent("hootly:paywall", { detail: { context: "limit:uploads" } }));
        } else {
          toast(res.error ?? "Couldn't add that.", { kind: "error" });
        }
        return;
      }
      const label =
        kind === "pasted" ? payload.title || "Pasted notes"
        : kind === "quizlet" ? "Quizlet import"
        : kind === "youtube" ? "YouTube video"
        : payload.title || "Topic";
      if (kind !== "topic") setLocalUsed((u) => u + 1);
      emit([
        ...rowsRef.current,
        {
          key: res.data.materialId, materialId: res.data.materialId, filename: label,
          size: null, status: "queued", pct: 10, statusText: "Queued…",
        },
      ]);
      setPasteOpen(null); setPasteText(""); setPasteTitle("");
      setYtOpen(false); setYtUrl("");
      setTopicOpen(false);
      if (kind === "topic") onTopicChosen?.(payload.title ?? "Topic");
    });
  }

  const remaining = plan === "free" ? Math.max(0, LIMITS.free.uploads - localUsed) : Infinity;

  return (
    <div className="flex flex-col gap-4">
      {rows.map(
        (r) => r.materialId && <ProgressWatcher key={r.key} materialId={r.materialId} onEvent={onJobEvent} />
      )}

      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInput.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={cn(
          "focus-ring flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed px-6 py-10 text-center transition-all duration-150",
          dragOver ? "border-primary bg-primary-soft" : "border-border bg-bg-subtle hover:border-primary-border"
        )}
      >
        <FileUp className="size-6 text-primary" aria-hidden />
        <p className="text-body text-ink">
          Drop lectures, notes, slides, photos, or recordings — PDF, PPTX, DOCX, TXT, images, audio, video
        </p>
        <Button variant="secondary" size="sm" type="button" onClick={(e) => { e.stopPropagation(); fileInput.current?.click(); }}>
          Browse files
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Import from Quizlet", icon: ClipboardPaste, onClick: () => setPasteOpen("quizlet") },
          { label: "Paste notes", icon: ClipboardPaste, onClick: () => setPasteOpen("pasted") },
          { label: "Photo of handwritten notes", icon: Camera, onClick: () => photoInput.current?.click() },
          { label: "YouTube link", icon: Link2, onClick: () => setYtOpen(true) },
        ].map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={chip.onClick}
            className="focus-ring flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-all duration-150 hover:border-primary-border hover:text-primary"
          >
            <chip.icon className="size-3.5" aria-hidden />
            {chip.label}
          </button>
        ))}
      </div>

      {showTopicOption && (
        <>
          <div className="flex items-center gap-3" role="separator" aria-label="or">
            <span className="h-px flex-1 bg-border" />
            <span className="text-small text-ink-3">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="secondary" type="button" onClick={() => setTopicOpen(true)}>
            <Lightbulb className="size-4" aria-hidden />
            💡 Just give me a topic
          </Button>
        </>
      )}

      {/* Upload rows */}
      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.key} className="rounded-card border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-small min-w-0 flex-1 truncate font-medium text-ink" title={row.filename}>
                  {row.filename}
                </span>
                {row.size != null && (
                  <span className="text-micro shrink-0 text-ink-3 tabular-nums">
                    {(row.size / 1024 / 1024).toFixed(1)}MB
                  </span>
                )}
                <span
                  className={cn(
                    "text-micro shrink-0 font-medium",
                    row.status === "failed" ? "text-danger" : row.status === "ready" ? "text-success" : "text-ink-2"
                  )}
                >
                  {row.statusText}
                </span>
              </div>
              {row.status !== "failed" && row.status !== "ready" && (
                <ProgressBar value={row.pct} className="mt-2" ariaLabel={`${row.filename} progress`} />
              )}
              {row.status === "failed" && (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-ctl bg-danger-soft px-3 py-2">
                  <span className="text-small text-ink">{row.errorDetail ?? "Something went wrong."}</span>
                  <span className="flex shrink-0 gap-1">
                    {row.materialId && row.errorCode !== "limit_reached" && (
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => {
                          updateRow(row.key, { status: "queued", pct: 10, statusText: "Queued…", errorCode: undefined, errorDetail: undefined });
                          void retryMaterial(row.materialId as string);
                        }}
                      >
                        <RotateCcw className="size-3.5" aria-hidden /> Retry
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" aria-label={`Remove ${row.filename}`} onClick={() => emit(rowsRef.current.filter((r) => r.key !== row.key))}>
                      <X className="size-3.5" aria-hidden /> Remove
                    </Button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Free meter footer — visible BEFORE the action (trust rule) */}
      {plan === "free" && (
        <div className="border-t border-border pt-3">
          <Meter used={Math.min(localUsed, LIMITS.free.uploads)} limit={LIMITS.free.uploads} showLabel={false} />
          <p className={cn("text-small mt-1", remaining <= 1 ? "text-warning" : "text-ink-2")}>
            Uploads: {Math.min(localUsed, LIMITS.free.uploads)} of {LIMITS.free.uploads} free
          </p>
        </div>
      )}

      {/* Paste / Quizlet modal */}
      <Modal
        open={pasteOpen !== null}
        onOpenChange={(o) => !o && setPasteOpen(null)}
        title={pasteOpen === "quizlet" ? "Import from Quizlet" : "Paste notes"}
        description={
          pasteOpen === "quizlet"
            ? "In Quizlet: ⋯ → Export → copy, then paste here (term and definition per line)."
            : "Paste anything — lecture notes, a study guide, a chapter."
        }
      >
        <div className="flex flex-col gap-3">
          {pasteOpen === "pasted" && (
            <Input label="Title (optional)" value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="e.g. Week 3 lecture notes" />
          )}
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            placeholder={pasteOpen === "quizlet" ? "mitochondria\tpowerhouse of the cell\n…" : "Paste your notes here…"}
            className="focus-ring w-full resize-y rounded-ctl border border-border bg-surface p-3 text-[14px] text-ink placeholder:text-ink-3"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPasteOpen(null)}>Cancel</Button>
            <Button
              loading={pending}
              disabled={!pasteText.trim()}
              onClick={() => pasteOpen && addNonFile(pasteOpen, { title: pasteTitle || undefined, text: pasteText })}
            >
              {pasteOpen === "quizlet" ? "Import cards" : "Add notes"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* YouTube modal */}
      <Modal open={ytOpen} onOpenChange={setYtOpen} title="Add a YouTube link" description="We read the video's captions — no captions, no dice (we'll tell you).">
        <div className="flex flex-col gap-3">
          <Input label="YouTube URL" value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setYtOpen(false)}>Cancel</Button>
            <Button loading={pending} disabled={!ytUrl.trim()} onClick={() => addNonFile("youtube", { url: ytUrl })}>
              Add video
            </Button>
          </div>
        </div>
      </Modal>

      {/* Topic preset modal */}
      <Modal open={topicOpen} onOpenChange={setTopicOpen} title="Pick a topic" description="Ollie will build from well-established textbook knowledge — artifacts carry a “From general knowledge” badge until you add real materials.">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {TOPIC_PRESETS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addNonFile("topic", { title: t })}
                className="focus-ring rounded-ctl border border-border bg-surface px-3 py-2.5 text-[14px] font-medium text-ink transition-all duration-150 hover:border-primary-border hover:bg-primary-soft"
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <Input label="Type my own" value={customTopic} onChange={(e) => setCustomTopic(e.target.value)} placeholder="e.g. Organic chemistry" />
            <Button loading={pending} disabled={!customTopic.trim()} onClick={() => addNonFile("topic", { title: customTopic })}>
              Use topic
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
