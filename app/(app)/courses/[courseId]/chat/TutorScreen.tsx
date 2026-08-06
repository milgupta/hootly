"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { CitedMarkdown } from "@/components/chat/CitedMarkdown";
import { SourcePane } from "@/components/notes/SourcePane";
import { cn } from "@/lib/cn";
import { LIMITS } from "@/lib/billing/limits";
import type { ChatMessage, ChatThread, Citation, Course } from "@/lib/types";
import { createThread, deleteThread, setSocratic } from "./actions";

interface PendingMessage {
  role: "user" | "assistant";
  content_md: string;
  citations: Citation[];
  used_general_knowledge: boolean;
  streaming?: boolean;
}

export function TutorScreen({
  course,
  threads,
  activeThread,
  messages,
  plan,
  tutorUsed,
  suggestions,
}: {
  course: Course;
  threads: ChatThread[];
  activeThread: ChatThread | null;
  messages: ChatMessage[];
  plan: "free" | "plus";
  tutorUsed: number;
  suggestions: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [input, setInput] = React.useState("");
  const [live, setLive] = React.useState<PendingMessage[]>([]);
  const [streaming, setStreaming] = React.useState(false);
  const [socratic, setSocraticState] = React.useState(activeThread?.socratic ?? false);
  const [openChunk, setOpenChunk] = React.useState<string | null>(null);
  const [used, setUsed] = React.useState(tutorUsed);
  const [pending, startTransition] = React.useTransition();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const autoScroll = React.useRef(true);

  const all: PendingMessage[] = React.useMemo(
    () => [
      ...messages.map((m) => ({
        role: m.role,
        content_md: m.content_md,
        citations: (m.citations ?? []) as Citation[],
        used_general_knowledge: m.used_general_knowledge,
      })),
      ...live,
    ],
    [messages, live]
  );

  // Auto-scroll, pausing when the user scrolls up (docs/03 §5 streaming text).
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el && autoScroll.current) el.scrollTop = el.scrollHeight;
  }, [all, streaming]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  const remaining = plan === "free" ? Math.max(0, LIMITS.free.tutor_messages.limit - used) : Infinity;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    let threadId = activeThread?.id;
    if (!threadId) {
      const res = await createThread(course.id);
      if (!res.ok || !res.data) {
        toast(res.error ?? "Couldn't start a chat.", { kind: "error" });
        return;
      }
      threadId = res.data.threadId;
      router.replace(`/courses/${course.id}/chat?thread=${threadId}`, { scroll: false });
    }

    setInput("");
    autoScroll.current = true;
    setLive((l) => [
      ...l,
      { role: "user", content_md: trimmed, citations: [], used_general_knowledge: false },
      { role: "assistant", content_md: "", citations: [], used_general_knowledge: false, streaming: true },
    ]);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, message: trimmed }),
      });

      if (res.status === 402) {
        setLive((l) => l.slice(0, -2));
        setStreaming(false);
        window.dispatchEvent(
          new CustomEvent("hootly:paywall", { detail: { context: "limit:tutor_messages" } })
        );
        return;
      }
      if (!res.ok || !res.body) {
        setLive((l) => l.slice(0, -1));
        setStreaming(false);
        toast(
          res.status === 503
            ? "Ollie isn't connected on this deployment yet."
            : "Ollie couldn't answer — try again.",
          { kind: "error" }
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const usedGeneral = /^\s*GENERAL_KNOWLEDGE\s*$/m.test(acc.split("\n")[0] ?? "");
        const body = usedGeneral ? acc.replace(/^\s*GENERAL_KNOWLEDGE\s*\n?/, "") : acc;
        setLive((l) => {
          const next = [...l];
          next[next.length - 1] = {
            role: "assistant",
            content_md: body,
            citations: [],
            used_general_knowledge: usedGeneral,
            streaming: true,
          };
          return next;
        });
      }
      setStreaming(false);
      setUsed((u) => u + 1);
      // Refresh to pick up the persisted message with resolved citations.
      setLive([]);
      router.refresh();
    } catch {
      setStreaming(false);
      setLive((l) => l.slice(0, -1));
      toast("Connection dropped — your message was saved. Try again.", { kind: "error" });
    }
  }

  return (
    <div className="flex h-[calc(100vh-104px)] gap-4">
      {/* Thread list */}
      <div className="hidden w-[220px] shrink-0 flex-col gap-2 lg:flex">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            startTransition(async () => {
              const res = await createThread(course.id);
              if (res.ok && res.data) router.push(`/courses/${course.id}/chat?thread=${res.data.threadId}`);
              else toast(res.error ?? "Couldn't start a chat.", { kind: "error" });
            })
          }
          loading={pending}
        >
          <Plus className="size-3.5" aria-hidden /> New chat
        </Button>
        <nav className="flex flex-col gap-0.5 overflow-y-auto" aria-label="Chat threads">
          {threads.map((t) => (
            <div key={t.id} className="group flex items-center gap-1">
              <button
                onClick={() => router.push(`/courses/${course.id}/chat?thread=${t.id}`)}
                className={cn(
                  "focus-ring min-w-0 flex-1 truncate rounded-ctl px-3 py-2 text-left text-[13px] font-medium transition-colors duration-150",
                  activeThread?.id === t.id
                    ? "bg-primary-soft text-primary"
                    : "text-ink-2 hover:bg-bg-subtle hover:text-ink"
                )}
              >
                {t.title}
              </button>
              <button
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteThread(t.id);
                    if (res.ok) { toast("Chat moved to Trash", { kind: "success" }); router.refresh(); }
                    else toast(res.error ?? "Couldn't delete.", { kind: "error" });
                  })
                }
                aria-label={`Delete chat ${t.title}`}
                className="focus-ring rounded p-1 text-ink-3 opacity-0 transition-opacity duration-150 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </nav>
      </div>

      {/* Chat */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
          <h1 className="text-h2 truncate">Ask Ollie</h1>
          <label className="flex shrink-0 cursor-pointer items-center gap-2">
            <span
              className="text-small text-ink-2"
              title="Ollie guides you to the answer instead of giving it away."
            >
              Socratic mode
            </span>
            <button
              role="switch"
              aria-checked={socratic}
              aria-label="Socratic mode"
              onClick={() => {
                const next = !socratic;
                setSocraticState(next);
                if (activeThread) {
                  startTransition(async () => {
                    const res = await setSocratic(activeThread.id, next);
                    if (!res.ok) {
                      setSocraticState(!next);
                      toast(res.error ?? "Couldn't save.", { kind: "error" });
                    }
                  });
                }
              }}
              className={cn(
                "focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150",
                socratic ? "bg-primary" : "bg-border"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full bg-white shadow-xs transition-transform duration-150",
                  socratic ? "translate-x-[22px]" : "translate-x-0.5"
                )}
              />
            </button>
          </label>
        </div>

        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto pr-1">
          {all.length === 0 ? (
            <EmptyState
              ollie={<OllieAnimated mode="idle" size={72} />}
              message={`Ask anything about ${course.name}. Ollie answers from your materials and shows you where each answer came from.`}
              action={
                suggestions.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {suggestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => void send(q)}
                        className="focus-ring rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-all duration-150 hover:border-primary-border hover:text-primary"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                ) : undefined
              }
            />
          ) : (
            <div className="flex flex-col gap-5 pb-2">
              {all.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <p className="text-body max-w-[80%] rounded-card rounded-br-[4px] bg-primary-soft px-4 py-2.5 text-ink">
                      {m.content_md}
                    </p>
                  </div>
                ) : (
                  <div key={i} className="flex gap-3">
                    <div className="shrink-0 pt-0.5">
                      <OllieAnimated mode={m.streaming ? "thinking" : "idle"} size={32} />
                    </div>
                    <div className="min-w-0 flex-1">
                      {m.used_general_knowledge && (
                        <p className="text-small mb-2 flex items-center gap-1.5 rounded-ctl bg-warning-soft px-3 py-1.5 text-warning">
                          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                          Not found in your materials — answered from general knowledge.
                        </p>
                      )}
                      {m.content_md ? (
                        <CitedMarkdown
                          body={m.content_md}
                          citations={m.citations}
                          onOpenSource={setOpenChunk}
                        />
                      ) : (
                        <p className="text-body text-ink-3">Thinking…</p>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Meter above composer at ≤5 remaining (docs/05 §7.6) */}
        {plan === "free" && remaining <= 5 && (
          <p className={cn("text-small mt-2", remaining === 0 ? "text-warning" : "text-ink-2")}>
            {remaining} free {remaining === 1 ? "message" : "messages"} left this month.
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="mt-3 flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder={`Ask anything about ${course.name}…`}
            aria-label="Message Ollie"
            className="focus-ring max-h-32 min-h-10 flex-1 resize-y rounded-ctl border border-border bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-3"
          />
          <Button type="submit" disabled={!input.trim() || streaming} aria-label="Send">
            <Send className="size-4" aria-hidden />
          </Button>
        </form>
      </div>

      {openChunk && (
        <div className="fixed inset-0 z-40 bg-bg lg:relative lg:inset-auto lg:z-auto lg:w-[340px] lg:shrink-0">
          <SourcePane chunkId={openChunk} onClose={() => setOpenChunk(null)} />
        </div>
      )}
    </div>
  );
}
