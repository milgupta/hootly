"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Meter } from "@/components/ui/Meter";
import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SourceChip } from "@/components/ui/SourceChip";
import { OllieMark } from "@/components/ollie/OllieMark";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { OlliePixel } from "@/components/ollie/OlliePixel";
import { OllieStory } from "@/components/ollie/OllieStory";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-h2 mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default function DevUIPage() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [destructiveOpen, setDestructiveOpen] = React.useState(false);
  const [tab, setTab] = React.useState("overview");

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-10">
      <h1 className="text-h1 mb-2">UI primitives</h1>
      <p className="text-body mb-10 text-ink-2">
        Eyeball each component against the 18-point ship gate (docs/03 §8).
      </p>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Generate flashcards</Button>
          <Button variant="secondary">Add materials</Button>
          <Button variant="ghost">Maybe later</Button>
          <Button variant="danger">Delete course</Button>
          <Button loading>Generating…</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <h3 className="text-h3 mb-1">Resting card</h3>
            <p className="text-body text-ink-2">Border + shadow-xs, white surface.</p>
          </Card>
          <Card clickable>
            <h3 className="text-h3 mb-1">Clickable card</h3>
            <p className="text-body text-ink-2">Hovers to primary border + shadow-md.</p>
          </Card>
          <Card selected>
            <h3 className="text-h3 mb-1">Selected card</h3>
            <p className="text-body text-ink-2">Primary-soft fill + check.</p>
          </Card>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="grid max-w-xl grid-cols-1 gap-4">
          <Input label="Course name" placeholder="e.g. BIO 172 — Human Physiology" />
          <Input label="With error" defaultValue="not-an-email" error="Enter a valid email address." />
          <Input label="Disabled" disabled placeholder="Disabled" />
        </div>
      </Section>

      <Section title="Modal & Toast">
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button variant="secondary" onClick={() => setDestructiveOpen(true)}>Destructive modal</Button>
          <Button variant="secondary" onClick={() => toast("Course moved to Trash", { kind: "success", actionLabel: "Undo", onAction: () => toast("Restored", { kind: "info" }) })}>
            Toast with Undo
          </Button>
        </div>
        <Modal open={modalOpen} onOpenChange={setModalOpen} title="A standard modal" description="20px radius, shadow-lg, 180ms fade+scale.">
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => setModalOpen(false)}>Confirm</Button>
          </div>
        </Modal>
        <Modal open={destructiveOpen} onOpenChange={setDestructiveOpen} title="Delete BIO 172?">
          <div className="mb-4 flex items-start gap-3">
            <OllieAnimated mode="concerned" size={56} />
            <p className="text-body text-ink-2">
              Everything inside — notes, 42 cards, 3 quizzes — moves to Trash for 30 days.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDestructiveOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => setDestructiveOpen(false)}>Delete course</Button>
          </div>
        </Modal>
      </Section>

      <Section title="Tabs">
        <Tabs
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "notes", label: "Notes" },
            { value: "cards", label: "Flashcards" },
          ]}
          value={tab}
          onValueChange={setTab}
        >
          <TabPanel value="overview" className="py-4 text-body text-ink-2">Overview content</TabPanel>
          <TabPanel value="notes" className="py-4 text-body text-ink-2">Notes content</TabPanel>
          <TabPanel value="cards" className="py-4 text-body text-ink-2">Flashcards content</TabPanel>
        </Tabs>
      </Section>

      <Section title="Meters & progress (trust UI)">
        <div className="grid max-w-md gap-4">
          <Meter used={2} limit={3} label="uploads" />
          <Meter used={45} limit={50} label="AI flashcards" />
          <Meter used={0} limit={Infinity} label="uploads" />
          <ProgressBar value={64} ariaLabel="Upload progress" />
        </div>
      </Section>

      <Section title="Skeletons">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </Section>

      <Section title="Empty state">
        <Card className="p-0">
          <EmptyState
            message="It's quiet in here. Add your first course and Ollie gets to work."
            action={<Button>Add a course</Button>}
          />
        </Card>
      </Section>

      <Section title="Source chips">
        <div className="flex flex-wrap gap-2">
          <SourceChip source={{ chunkId: "a", materialTitle: "Slides wk3", page: 14 }} onOpen={() => toast("Opens split-pane")} />
          <SourceChip source={{ chunkId: "b", materialTitle: "Lecture 5 recording", startSeconds: 221 }} onOpen={() => toast("Opens transcript at 03:41")} />
        </div>
      </Section>

      <Section title="Ollie">
        <div className="flex flex-wrap items-end gap-8">
          <div className="text-center"><OllieMark size={16} /><p className="text-small mt-2 text-ink-2">16px</p></div>
          <div className="text-center"><OllieMark size={48} /><p className="text-small mt-2 text-ink-2">Mark</p></div>
          <div className="text-center"><OllieAnimated mode="idle" size={80} /><p className="text-small mt-2 text-ink-2">Idle (blinks)</p></div>
          <div className="text-center"><OllieAnimated mode="thinking" size={80} /><p className="text-small mt-2 text-ink-2">Thinking</p></div>
          <div className="text-center"><OllieAnimated mode="success" size={80} /><p className="text-small mt-2 text-ink-2">Success</p></div>
          <div className="text-center"><OllieAnimated mode="concerned" size={80} /><p className="text-small mt-2 text-ink-2">Concerned</p></div>
          <div className="text-center"><OlliePixel size={64} /><p className="text-small mt-2 text-ink-2">Pixel</p></div>
          <div className="text-center"><OllieStory width={180} /><p className="text-small mt-2 text-ink-2">Storybook</p></div>
        </div>
      </Section>

      <Section title="Typography">
        <div className="flex flex-col gap-3">
          <p className="text-display">Display 44/52</p>
          <p className="text-h1">H1 28/36 — Page title</p>
          <p className="text-h2">H2 20/28 — Section title</p>
          <p className="text-h3">H3 16/24 — Card title</p>
          <p className="text-body reading-measure">
            Body 15/24 — The reading measure caps at 68ch because full-width paragraphs are
            the number-one vibecoded tell. Real apostrophes ('), en-dashes – and tabular
            numerals on stats.
          </p>
          <p className="text-small text-ink-2">Small 13/20 — meta and labels</p>
          <p className="text-micro uppercase text-ink-3">Micro 12/16 overline</p>
        </div>
      </Section>
    </main>
  );
}
