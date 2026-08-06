"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  ChevronLeft,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Meter } from "@/components/ui/Meter";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { cn } from "@/lib/cn";
import { LIMITS } from "@/lib/billing/limits";
import { useJobChannel } from "@/lib/useJobChannel";
import { masteryState, type Course, type Flashcard, type MasteryState } from "@/lib/types";
import { restore } from "@/app/(app)/trash/actions";
import { requestCards } from "../generate-actions";
import { createCard, deleteCards, favoriteCard, suspendCard, updateCard } from "./actions";

type Filter = "all" | "learning" | "reviewing" | "mastered" | "favorites";

const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["learning", "Learning"],
  ["reviewing", "Reviewing"],
  ["mastered", "Mastered"],
  ["favorites", "Favorites"],
];

const STATE_DOT: Record<MasteryState, string> = {
  learning: "bg-warning",
  reviewing: "bg-primary",
  mastered: "bg-success",
};

const STATE_LABEL: Record<MasteryState, string> = {
  learning: "Learning",
  reviewing: "Reviewing",
  mastered: "Mastered",
};

const COUNT_OPTIONS = [10, 20, 30] as const;

function dueLabel(iso: string): { text: string; overdue: boolean } {
  const due = new Date(iso).getTime();
  const now = Date.now();
  if (due <= now) return { text: "Due now", overdue: true };
  const hours = Math.round((due - now) / 3_600_000);
  if (hours < 24) return { text: `in ${Math.max(1, hours)}h`, overdue: false };
  return {
    text: new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    overdue: false,
  };
}

/** Styled checkbox — no unstyled browser controls in production (docs/03 §8.18). */
function CheckBox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "focus-ring flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-all duration-150 active:scale-95",
        checked
          ? "border-primary bg-primary text-white"
          : "border-border bg-surface hover:border-primary-border"
      )}
    >
      {checked && <Check className="size-3" aria-hidden />}
    </button>
  );
}

export function CardsManager({
  course,
  cards,
  plan,
  cardsGenerated,
}: {
  course: Course;
  cards: Flashcard[];
  plan: "free" | "plus";
  cardsGenerated: number;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Flashcard | null>(null);
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<string[] | null>(null);
  const [front, setFront] = React.useState("");
  const [back, setBack] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [focus, setFocus] = React.useState("");
  const [count, setCount] = React.useState<number>(20);
  const [generating, setGenerating] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  // Generation is a background job — refresh the table when Ollie finishes (docs/04 §8).
  useJobChannel(generating ? course.id : null, (e) => {
    if (e.stage === "cards" && e.status === "ready") {
      setGenerating(false);
      toast("New cards are ready.", { kind: "success" });
      router.refresh();
    }
    if (e.stage === "failed" && e.artifact === "cards") {
      setGenerating(false);
      toast(
        typeof e.error_detail === "string" ? e.error_detail : "Ollie couldn't write those cards.",
        { kind: "error" }
      );
      router.refresh();
    }
  });

  const dueCount = cards.filter(
    (c) => !c.suspended && new Date(c.fsrs_due).getTime() <= Date.now()
  ).length;

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (q && !c.front.toLowerCase().includes(q) && !c.back.toLowerCase().includes(q))
        return false;
      if (filter === "favorites") return c.favorited;
      if (filter === "all") return true;
      return masteryState(c) === filter;
    });
  }, [cards, query, filter]);

  const allVisibleSelected = visible.length > 0 && visible.every((c) => selected.has(c.id));
  const selectedIds = [...selected];

  const cardsLimit = LIMITS.free.cards_generated;
  const remainingGen = plan === "free" ? Math.max(0, cardsLimit - cardsGenerated) : Infinity;

  function toggleSelected(id: string, next: boolean) {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  function toggleAllVisible(next: boolean) {
    setSelected((prev) => {
      const copy = new Set(prev);
      for (const c of visible) {
        if (next) copy.add(c.id);
        else copy.delete(c.id);
      }
      return copy;
    });
  }

  function openNew() {
    setFront("");
    setBack("");
    setFormError(null);
    setNewOpen(true);
  }

  function openEdit(card: Flashcard) {
    setFront(card.front);
    setBack(card.back);
    setFormError(null);
    setEditing(card);
  }

  function onCreate() {
    if (!front.trim() || !back.trim()) {
      setFormError("Front and back can't be empty.");
      return;
    }
    startTransition(async () => {
      const res = await createCard({ courseId: course.id, front, back });
      if (!res.ok) {
        setFormError(res.error ?? "Couldn't save the card — try again.");
        return;
      }
      setNewOpen(false);
      toast("Card added.", { kind: "success" });
      router.refresh();
    });
  }

  function onUpdate() {
    if (!editing) return;
    if (!front.trim() || !back.trim()) {
      setFormError("Front and back can't be empty.");
      return;
    }
    const cardId = editing.id;
    startTransition(async () => {
      const res = await updateCard({ cardId, front, back });
      if (!res.ok) {
        setFormError(res.error ?? "Couldn't save the card — try again.");
        return;
      }
      setEditing(null);
      toast("Card saved.", { kind: "success" });
      router.refresh();
    });
  }

  function onFavorite(card: Flashcard) {
    startTransition(async () => {
      const res = await favoriteCard(card.id, !card.favorited);
      if (!res.ok) toast(res.error ?? "Couldn't update the card.", { kind: "error" });
      else router.refresh();
    });
  }

  function onSuspend(card: Flashcard) {
    startTransition(async () => {
      const res = await suspendCard(card.id, !card.suspended);
      if (!res.ok) {
        toast(res.error ?? "Couldn't update the card.", { kind: "error" });
        return;
      }
      toast(card.suspended ? "Card is back in the review queue." : "Card suspended.", {
        kind: "success",
      });
      router.refresh();
    });
  }

  function onDelete(ids: string[]) {
    setConfirmDelete(null);
    startTransition(async () => {
      const res = await deleteCards(ids);
      if (!res.ok) {
        toast(res.error ?? "Couldn't delete — try again.", { kind: "error" });
        return;
      }
      setSelected(new Set());
      toast(ids.length === 1 ? "Card moved to Trash" : `${ids.length} cards moved to Trash`, {
        kind: "success",
        actionLabel: "Undo",
        onAction: () => {
          void Promise.all(ids.map((id) => restore("flashcard", id))).then(() => router.refresh());
        },
      });
      router.refresh();
    });
  }

  function onGenerate() {
    startTransition(async () => {
      const res = await requestCards({
        courseId: course.id,
        count,
        customFocus: focus.trim() ? focus.trim() : null,
      });
      if (!res.ok) {
        if (res.code === "limit_reached") {
          setGenerateOpen(false);
          window.dispatchEvent(
            new CustomEvent("hootly:paywall", { detail: { context: "limit:cards_generated" } })
          );
          return;
        }
        toast(res.error ?? "Couldn't start generation — try again.", { kind: "error" });
        return;
      }
      setGenerateOpen(false);
      setGenerating(true);
      setFocus("");
      toast(`Ollie's writing ${count} cards — they'll show up here.`, { kind: "info" });
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <Link
          href={`/courses/${course.id}`}
          className="focus-ring text-small mb-2 inline-flex items-center gap-1 rounded-ctl text-ink-2 transition-colors duration-150 hover:text-ink"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {course.name}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h1">Flashcards</h1>
          <span className="text-small text-ink-2 tabular-nums">
            {cards.length === 0
              ? "None yet"
              : `${cards.length} card${cards.length === 1 ? "" : "s"}${dueCount > 0 ? ` · ${dueCount} due` : ""}`}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
              aria-hidden
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cards"
              aria-label="Search cards"
              className="focus-ring h-10 w-full rounded-ctl border border-border bg-surface pl-9 pr-3 text-[15px] text-ink placeholder:text-ink-3 transition-all duration-150 focus:border-primary focus:outline-none"
            />
          </div>
          <Button variant="secondary" onClick={openNew}>
            <Plus className="size-4" aria-hidden /> New card
          </Button>
          <Button variant="secondary" onClick={() => setGenerateOpen(true)} loading={generating}>
            <Sparkles className="size-4" aria-hidden /> Generate more
          </Button>
          <Button onClick={() => router.push(`/courses/${course.id}/review`)} disabled={dueCount === 0}>
            <Play className="size-4" aria-hidden />
            {dueCount > 0 ? `Review ${dueCount} due` : "Nothing due"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter cards">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "focus-ring rounded-full border px-3 py-1 text-[13px] font-medium transition-all duration-150 active:scale-[0.98]",
                filter === value
                  ? "border-primary-border bg-primary-soft text-primary"
                  : "border-border bg-surface text-ink-2 hover:border-primary-border hover:text-ink"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Trust UI: the meter is visible BEFORE the Generate action (docs/03 §4, 04 §5). */}
        {plan === "free" && (
          <div className="max-w-[320px]">
            <Meter
              used={Math.min(cardsGenerated, cardsLimit)}
              limit={cardsLimit}
              metric="cards_generated"
              showLabel={false}
            />
            <p
              className={cn(
                "text-small mt-1 tabular-nums",
                remainingGen <= 10 ? "text-warning" : "text-ink-2"
              )}
            >
              AI flashcards: {Math.min(cardsGenerated, cardsLimit)} of {cardsLimit} free used
              {remainingGen > 0 ? ` · ${remainingGen} left` : " · limit reached"}
            </p>
          </div>
        )}
      </div>

      {/* Bulk bar — ghost at first touch; red only at the confirm step (docs/03 §4). */}
      {selectedIds.length > 0 && (
        <div className="fade-in-up mb-3 flex flex-wrap items-center gap-3 rounded-card border border-primary-border bg-primary-soft px-4 py-2.5">
          <span className="text-small font-medium text-ink tabular-nums">
            {selectedIds.length} selected
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            onClick={() => setConfirmDelete(selectedIds)}
          >
            <Trash2 className="size-3.5" aria-hidden /> Delete
          </Button>
        </div>
      )}

      {/* Table */}
      {cards.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            ollie={<OllieAnimated mode="idle" size={72} />}
            message="No cards yet. Ollie can write a set from your materials, or you can add one yourself."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setGenerateOpen(true)}>
                  <Sparkles className="size-4" aria-hidden /> Generate flashcards
                </Button>
                <Button variant="secondary" onClick={openNew}>
                  <Plus className="size-4" aria-hidden /> New card
                </Button>
              </div>
            }
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            ollie={<OllieAnimated mode="concerned" size={72} />}
            message="No cards match that. Try a different search or filter."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-bg-subtle">
                <th className="w-10 px-4 py-3">
                  <CheckBox
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    label="Select all cards"
                  />
                </th>
                <th className="text-small px-4 py-3 font-medium text-ink-2">Front</th>
                <th className="text-small px-4 py-3 font-medium text-ink-2">State</th>
                <th className="text-small px-4 py-3 font-medium text-ink-2">Due</th>
                <th className="w-10 px-4 py-3">
                  <span className="sr-only">Favorite</span>
                </th>
                <th className="w-10 px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((card) => {
                const state = masteryState(card);
                const due = dueLabel(card.fsrs_due);
                return (
                  <tr
                    key={card.id}
                    className={cn(
                      "border-b border-border transition-colors duration-150 last:border-0 hover:bg-bg-subtle",
                      selected.has(card.id) && "bg-primary-soft hover:bg-primary-soft"
                    )}
                  >
                    <td className="px-4 py-3">
                      <CheckBox
                        checked={selected.has(card.id)}
                        onChange={(next) => toggleSelected(card.id, next)}
                        label={`Select card: ${card.front.slice(0, 40)}`}
                      />
                    </td>
                    <td className="text-body max-w-[42ch] px-4 py-3">
                      <button
                        onClick={() => openEdit(card)}
                        className="focus-ring block w-full truncate rounded-ctl text-left hover:text-primary"
                        title={card.front}
                      >
                        {card.front}
                      </button>
                      {card.suspended && (
                        <span className="text-micro mt-1 inline-block rounded-full bg-bg-subtle px-2 py-0.5 text-ink-2">
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-small inline-flex items-center gap-1.5 text-ink-2">
                        <span
                          className={cn("size-2 shrink-0 rounded-full", STATE_DOT[state])}
                          aria-hidden
                        />
                        {STATE_LABEL[state]}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "text-small px-4 py-3 tabular-nums",
                        card.suspended ? "text-ink-3" : due.overdue ? "text-primary" : "text-ink-2"
                      )}
                    >
                      {card.suspended ? "—" : due.text}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onFavorite(card)}
                        aria-pressed={card.favorited}
                        aria-label={card.favorited ? "Remove from favorites" : "Add to favorites"}
                        className={cn(
                          "focus-ring rounded-ctl p-1 transition-all duration-150 hover:bg-bg-subtle active:scale-95",
                          card.favorited ? "text-warning" : "text-ink-3 hover:text-ink-2"
                        )}
                      >
                        <Star
                          className="size-4"
                          fill={card.favorited ? "currentColor" : "none"}
                          aria-hidden
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            className="focus-ring rounded-ctl p-1.5 text-ink-2 transition-colors duration-150 hover:bg-bg-subtle hover:text-ink"
                            aria-label={`Actions for card: ${card.front.slice(0, 40)}`}
                          >
                            <MoreHorizontal className="size-4" aria-hidden />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            align="end"
                            sideOffset={6}
                            className="fade-in-up z-50 min-w-[170px] rounded-card border border-border bg-surface p-1.5 shadow-md"
                          >
                            <DropdownMenu.Item asChild>
                              <button
                                onClick={() => openEdit(card)}
                                className="focus-ring flex w-full items-center gap-2 rounded-ctl px-3 py-2 text-left text-[14px] text-ink outline-none data-[highlighted]:bg-bg-subtle"
                              >
                                <Pencil className="size-4" aria-hidden /> Edit
                              </button>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item asChild>
                              <button
                                onClick={() => onSuspend(card)}
                                className="focus-ring flex w-full items-center gap-2 rounded-ctl px-3 py-2 text-left text-[14px] text-ink outline-none data-[highlighted]:bg-bg-subtle"
                              >
                                <EyeOff className="size-4" aria-hidden />
                                {card.suspended ? "Unsuspend" : "Suspend"}
                              </button>
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator className="my-1 h-px bg-border" />
                            <DropdownMenu.Item asChild>
                              <button
                                onClick={() => setConfirmDelete([card.id])}
                                className="focus-ring flex w-full items-center gap-2 rounded-ctl px-3 py-2 text-left text-[14px] text-danger outline-none data-[highlighted]:bg-danger-soft"
                              >
                                <Trash2 className="size-4" aria-hidden /> Delete
                              </button>
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* New card */}
      <Modal open={newOpen} onOpenChange={setNewOpen} title="New card">
        <div className="flex flex-col gap-4">
          <Input
            label="Front"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            placeholder="What's the question?"
            autoFocus
            maxLength={2000}
          />
          <Input
            label="Back"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            placeholder="What's the answer?"
            maxLength={4000}
            error={formError ?? undefined}
          />
          <p className="text-small text-ink-2">Cards you write yourself don&apos;t use your free AI limit.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onCreate} loading={pending}>
              Add card
            </Button>
          </div>
        </div>
      </Modal>

      {/* Inline edit */}
      <Modal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit card"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Front"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            autoFocus
            maxLength={2000}
          />
          <Input
            label="Back"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            maxLength={4000}
            error={formError ?? undefined}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={onUpdate} loading={pending}>
              Save card
            </Button>
          </div>
        </div>
      </Modal>

      {/* Generate more */}
      <Modal open={generateOpen} onOpenChange={setGenerateOpen} title="Generate more flashcards">
        <div className="flex flex-col gap-4">
          <Input
            label="Focus on… (optional)"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="e.g. definitions only"
            maxLength={300}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium text-ink">How many?</span>
            <div className="flex gap-2" role="group" aria-label="How many cards">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  aria-pressed={count === n}
                  className={cn(
                    "focus-ring h-10 flex-1 rounded-ctl border text-[15px] font-medium tabular-nums transition-all duration-150 active:scale-[0.98]",
                    count === n
                      ? "border-primary-border bg-primary-soft text-primary"
                      : "border-border bg-surface text-ink-2 hover:border-primary-border hover:text-ink"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {plan === "free" && (
            <div className="rounded-card border border-border bg-bg-subtle p-4">
              <Meter
                used={Math.min(cardsGenerated, cardsLimit)}
                limit={cardsLimit}
                metric="cards_generated"
                showLabel={false}
              />
              <p className="text-small mt-1.5 text-ink-2 tabular-nums">
                {Math.min(cardsGenerated, cardsLimit)} of {cardsLimit} free AI flashcards used
                {remainingGen > 0
                  ? ` — ${remainingGen} left on the free plan.`
                  : " — you're at the free limit."}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onGenerate} loading={pending}>
              <Sparkles className="size-4" aria-hidden /> Generate {count} cards
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm — the single confirm for one card or a bulk selection. */}
      <Modal
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        ariaTitle="Delete cards"
      >
        <div className="mb-4 flex items-start gap-3">
          <OllieAnimated mode="concerned" size={56} />
          <div>
            <h2 className="text-h2 mb-1">
              {confirmDelete?.length === 1
                ? "Delete this card?"
                : `Delete ${confirmDelete?.length ?? 0} cards?`}
            </h2>
            <p className="text-body text-ink-2">
              {confirmDelete?.length === 1 ? "It moves" : "They move"} to Trash for 30 days — you
              can put {confirmDelete?.length === 1 ? "it" : "them"} back any time.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() => confirmDelete && onDelete(confirmDelete)}
          >
            {confirmDelete?.length === 1 ? "Delete card" : `Delete ${confirmDelete?.length ?? 0} cards`}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
