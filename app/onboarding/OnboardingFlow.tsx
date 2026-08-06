"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { OlliePixel } from "@/components/ollie/OlliePixel";
import { UploadPanel, type UploadRow } from "@/components/upload/UploadPanel";
import { GenerationTheater } from "./GenerationTheater";
import { cn } from "@/lib/cn";
import type { Course, Profile } from "@/lib/types";
import {
  createOnboardingCourse, setFamiliarity, setStudyLevel, setUserType,
  startCourseBuild, trackStep,
} from "./actions";

const STEPS = ["who", "level", "course", "materials", "calibrate", "building"] as const;
type Step = (typeof STEPS)[number];
/** Progress dots cover the five interactive steps; 'building' is a payoff, not a step. */
const DOT_STEPS: Step[] = ["who", "level", "course", "materials", "calibrate"];

const LEVELS: { value: string; label: string; sub: string }[] = [
  { value: "college", label: "College", sub: "Intro courses, majors, finals" },
  { value: "grad", label: "Grad school", sub: "Master's, PhD, quals" },
  { value: "high_school", label: "High school", sub: "AP, IB, honors, regular" },
  { value: "med", label: "Med school", sub: "Pre-clinical, Step 1 & 2, rotations" },
  { value: "professional_cert", label: "Professional certs", sub: "NCLEX, Bar, CPA, PMP, AWS" },
  { value: "standardized_test", label: "Standardized tests", sub: "SAT, ACT, MCAT, GRE, LSAT" },
  { value: "other", label: "Other", sub: "" },
];

const FAMILIARITY: { value: "new" | "some" | "well"; label: string }[] = [
  { value: "new", label: "New to this — I'm starting fresh" },
  { value: "some", label: "Some background — I know the basics" },
  { value: "well", label: "Know it well — I want to go deeper" },
];

export function OnboardingFlow({
  initialStep,
  profile,
  course,
  plan,
  uploadsUsed,
}: {
  initialStep: Step;
  profile: Profile | null;
  course: Course | null;
  plan: "free" | "plus";
  uploadsUsed: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = React.useState<Step>(initialStep);
  const [courseId, setCourseId] = React.useState<string | null>(course?.id ?? null);
  const [courseName, setCourseName] = React.useState(course?.name ?? "");
  const [examDate, setExamDate] = React.useState(course?.exam_date ?? "");
  const [userType, setUserTypeState] = React.useState(profile?.user_type ?? "");
  const [level, setLevelState] = React.useState(profile?.study_level ?? "");
  const [familiarity, setFamiliarityState] = React.useState<"new" | "some" | "well" | "">(
    course?.familiarity ?? ""
  );
  const [rows, setRows] = React.useState<UploadRow[]>([]);
  const [topicChosen, setTopicChosen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const stepStart = React.useRef(Date.now());

  const dotIndex = DOT_STEPS.indexOf(step);

  const go = React.useCallback(
    (next: Step, id?: string | null) => {
      void trackStep(step as Exclude<Step, never>, (Date.now() - stepStart.current) / 1000);
      stepStart.current = Date.now();
      setStep(next);
      const target = id ?? courseId;
      router.replace(`/onboarding?step=${next}${target ? `&course=${target}` : ""}`, { scroll: false });
    },
    [router, step, courseId]
  );

  // Auto-advance 250ms after a single-select (docs/05 §4).
  function selectAndAdvance(fn: () => Promise<void>, next: Step) {
    startTransition(async () => {
      await fn();
      window.setTimeout(() => go(next), 250);
    });
  }

  const readyMaterialCount = rows.filter((r) => r.status === "ready" || r.status === "processing" || r.status === "queued").length;
  const canBuild = readyMaterialCount > 0 || topicChosen;

  return (
    <div className="gradient-hero-glow min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[840px] flex-col px-5 py-6">
        {/* Header: back, progress dots, skip */}
        <div className="mb-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div>
            {step !== "who" && step !== "building" && (
              <button
                onClick={() => {
                  const i = STEPS.indexOf(step);
                  if (i > 0) go(STEPS[i - 1]!);
                }}
                className="focus-ring text-small flex items-center gap-1.5 rounded-ctl px-2 py-1 font-medium text-ink-2 transition-colors duration-150 hover:text-ink"
              >
                <ArrowLeft className="size-4" aria-hidden /> Back
              </button>
            )}
          </div>
          <div className="flex flex-col items-center gap-1.5">
            {step !== "building" && (
              <>
                <div className="flex gap-1.5" role="progressbar" aria-valuenow={dotIndex + 1} aria-valuemin={1} aria-valuemax={5}>
                  {DOT_STEPS.map((s, i) => (
                    <span
                      key={s}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-200",
                        i === dotIndex ? "w-6 bg-primary" : i < dotIndex ? "w-1.5 bg-primary" : "w-1.5 bg-primary-soft"
                      )}
                    />
                  ))}
                </div>
                <span className="text-micro text-ink-3">Step {dotIndex + 1} of 5</span>
              </>
            )}
          </div>
          <div className="text-right">
            {step === "materials" && (
              <button
                onClick={() => {
                  setTopicChosen(true);
                  go("calibrate");
                }}
                className="focus-ring text-small rounded-ctl px-2 py-1 font-medium text-primary transition-colors duration-150 hover:text-primary-hover"
              >
                I don't have materials yet →
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center pb-10">
          {/* 4.1 who */}
          {step === "who" && (
            <div className="flex flex-col items-center gap-6">
              <OlliePixel size={72} />
              <h1 className="text-h1 text-center">Who's studying?</h1>
              <div className="grid w-full max-w-[560px] grid-cols-1 gap-3 sm:grid-cols-3">
                {(["student", "teacher", "professional"] as const).map((t) => (
                  <Card
                    key={t}
                    clickable
                    selected={userType === t}
                    onClick={() =>
                      selectAndAdvance(async () => {
                        setUserTypeState(t);
                        const res = await setUserType(t);
                        if (!res.ok) toast(res.error ?? "Couldn't save.", { kind: "error" });
                      }, "level")
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectAndAdvance(async () => {
                          setUserTypeState(t);
                          await setUserType(t);
                        }, "level");
                      }
                    }}
                    className="text-center capitalize"
                  >
                    <p className="text-h3">{t}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* 4.2 level */}
          {step === "level" && (
            <div className="flex flex-col items-center gap-6">
              <h1 className="text-h1 text-center">What are you studying for?</h1>
              <div className="flex w-full max-w-[560px] flex-col gap-2">
                {LEVELS.map((l, i) => (
                  <Card
                    key={l.value}
                    clickable
                    selected={level === l.value}
                    className="fade-in-up flex items-baseline justify-between gap-3 py-3.5"
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() =>
                      selectAndAdvance(async () => {
                        setLevelState(l.value as typeof level);
                        const res = await setStudyLevel(l.value);
                        if (!res.ok) toast(res.error ?? "Couldn't save.", { kind: "error" });
                      }, "course")
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectAndAdvance(async () => {
                          setLevelState(l.value as typeof level);
                          await setStudyLevel(l.value);
                        }, "course");
                      }
                    }}
                  >
                    <span className="text-body-strong">{l.label}</span>
                    {l.sub && <span className="text-small text-ink-2">{l.sub}</span>}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* 4.3 course */}
          {step === "course" && (
            <div className="mx-auto flex w-full max-w-[480px] flex-col gap-5">
              <h1 className="text-h1 text-center">Let's set up your first course.</h1>
              <Input
                label="Course name"
                placeholder="e.g. BIO 172 — Human Physiology"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                maxLength={120}
                autoFocus
              />
              <Input
                label="When's the exam? (optional)"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
              <Button
                loading={pending}
                disabled={!courseName.trim()}
                onClick={() =>
                  startTransition(async () => {
                    const res = await createOnboardingCourse({
                      courseId,
                      name: courseName,
                      examDate: examDate || null,
                    });
                    if (res.ok && res.data) {
                      setCourseId(res.data.courseId);
                      go("materials", res.data.courseId);
                    } else {
                      toast(res.error ?? "Couldn't create the course.", { kind: "error" });
                    }
                  })
                }
              >
                Next
              </Button>
            </div>
          )}

          {/* 4.4 materials */}
          {step === "materials" && courseId && (
            <div className="mx-auto flex w-full max-w-[600px] flex-col gap-5">
              <h1 className="text-h1 text-center">Feed Ollie your materials.</h1>
              <UploadPanel
                courseId={courseId}
                plan={plan}
                uploadsUsed={uploadsUsed}
                showTopicOption
                onTopicChosen={() => setTopicChosen(true)}
                onRowsChange={setRows}
              />
              <Button disabled={!canBuild} onClick={() => go("calibrate")}>
                Build my study set
              </Button>
            </div>
          )}

          {/* 4.5 calibrate */}
          {step === "calibrate" && (
            <div className="flex flex-col items-center gap-6">
              <h1 className="text-h1 text-center">How well do you know this already?</h1>
              <div className="flex w-full max-w-[520px] flex-col gap-3">
                {FAMILIARITY.map((f) => (
                  <Card
                    key={f.value}
                    clickable
                    selected={familiarity === f.value}
                    onClick={() =>
                      selectAndAdvance(async () => {
                        setFamiliarityState(f.value);
                        if (courseId) {
                          const res = await setFamiliarity(courseId, f.value);
                          if (!res.ok) toast(res.error ?? "Couldn't save.", { kind: "error" });
                          const build = await startCourseBuild(courseId);
                          if (!build.ok) toast(build.error ?? "Couldn't start generation.", { kind: "error" });
                        }
                      }, "building")
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectAndAdvance(async () => {
                          setFamiliarityState(f.value);
                          if (courseId) {
                            await setFamiliarity(courseId, f.value);
                            await startCourseBuild(courseId);
                          }
                        }, "building");
                      }
                    }}
                  >
                    <p className="text-body-strong">{f.label}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* 4.6 building — generation theater */}
          {step === "building" && courseId && (
            <GenerationTheater
              courseId={courseId}
              onRetry={() =>
                startTransition(async () => {
                  const res = await startCourseBuild(courseId);
                  if (!res.ok) toast(res.error ?? "Couldn't retry.", { kind: "error" });
                })
              }
              onOpenCourse={({ warmupQuizId }) =>
                router.push(
                  `/courses/${courseId}?firstvalue=1${warmupQuizId ? `&warmup=${warmupQuizId}` : ""}`
                )
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
