"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trash2, ChevronDown, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { OllieMark } from "@/components/ollie/OllieMark";
import { Meter } from "@/components/ui/Meter";
import type { Course, Plan } from "@/lib/types";

export function Sidebar({
  courses,
  plan,
  uploadsUsed,
  uploadsLimit,
  displayName,
  avatarUrl,
}: {
  courses: Pick<Course, "id" | "name" | "emoji">[];
  plan: Plan;
  uploadsUsed: number;
  uploadsLimit: number;
  displayName: string;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const [coursesOpen, setCoursesOpen] = React.useState(true);

  const navItem = (href: string, label: string, icon: React.ReactNode, active: boolean) => (
    <Link
      href={href}
      className={cn(
        "focus-ring flex items-center gap-2.5 rounded-ctl px-3 py-2 text-[14px] font-medium transition-colors duration-150",
        active ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-[#F2F2F7] hover:text-ink"
      )}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-border bg-bg-subtle md:flex">
      <div className="px-4 pb-2 pt-5">
        <Link href="/home" className="focus-ring flex items-center gap-2 rounded-ctl px-2">
          <OllieMark size={28} />
          <span className="text-h3 lowercase">hootly</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Main">
        <div className="flex flex-col gap-0.5">
          {navItem("/home", "Home", <Home className="size-4" aria-hidden />, pathname === "/home")}

          <button
            onClick={() => setCoursesOpen((o) => !o)}
            className="focus-ring flex items-center justify-between rounded-ctl px-3 py-2 text-[14px] font-medium text-ink-2 transition-colors duration-150 hover:bg-[#F2F2F7] hover:text-ink"
            aria-expanded={coursesOpen}
          >
            <span className="flex items-center gap-2.5">
              <span aria-hidden>📚</span> My Courses
            </span>
            <ChevronDown
              className={cn("size-4 transition-transform duration-150", !coursesOpen && "-rotate-90")}
              aria-hidden
            />
          </button>
          {coursesOpen && (
            <div className="ml-3 flex flex-col gap-0.5 border-l border-border pl-2">
              {courses.length === 0 && (
                <span className="px-3 py-1.5 text-[13px] text-ink-3">No courses yet</span>
              )}
              {courses.map((c) => {
                const active = pathname.startsWith(`/courses/${c.id}`);
                return (
                  <Link
                    key={c.id}
                    href={`/courses/${c.id}`}
                    className={cn(
                      "focus-ring truncate rounded-ctl px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
                      active ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-[#F2F2F7] hover:text-ink"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <span aria-hidden className="mr-1.5">{c.emoji}</span>
                    {c.name}
                  </Link>
                );
              })}
            </div>
          )}

          {navItem("/trash", "Trash", <Trash2 className="size-4" aria-hidden />, pathname === "/trash")}
        </div>
      </nav>

      <div className="flex flex-col gap-3 border-t border-border p-3">
        {plan === "free" && (
          <div className="rounded-card border border-border bg-surface p-3 shadow-xs">
            <p className="text-small mb-1.5 font-medium text-ink">
              Free plan — {uploadsUsed}/{uploadsLimit} uploads used
            </p>
            <Meter used={uploadsUsed} limit={uploadsLimit} showLabel={false} />
            <Link
              href="/settings?tab=billing"
              className="focus-ring text-small mt-2 inline-block rounded font-semibold text-primary hover:text-primary-hover"
            >
              See plans
            </Link>
          </div>
        )}
        <div className="flex items-center justify-between px-1">
          <Link
            href="/settings"
            className="focus-ring flex items-center gap-2 rounded-ctl px-2 py-1.5 text-[14px] font-medium text-ink-2 transition-colors duration-150 hover:bg-[#F2F2F7] hover:text-ink"
          >
            <Settings className="size-4" aria-hidden />
            Settings
          </Link>
          <span
            className="flex size-7 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-[12px] font-semibold text-primary"
            title={displayName}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              displayName.slice(0, 1).toUpperCase()
            )}
          </span>
        </div>
      </div>
    </aside>
  );
}
