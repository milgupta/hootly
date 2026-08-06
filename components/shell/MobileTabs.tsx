"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, BookOpen, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/cn";

/** Mobile (<768px): bottom tab bar — Home, Courses, Add, Settings (docs/05 shell).
 *  "Add" opens the upload sheet on the current course, or Home to pick one. */
export function MobileTabs({ firstCourseId }: { firstCourseId: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  const tabs = [
    { href: "/home", label: "Home", icon: Home, active: pathname === "/home" },
    {
      href: firstCourseId ? `/courses/${firstCourseId}` : "/home",
      label: "Courses",
      icon: BookOpen,
      active: pathname.startsWith("/courses"),
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Mobile navigation"
    >
      {tabs.map((t) => (
        <Link
          key={t.label}
          href={t.href}
          className={cn(
            "focus-ring flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
            t.active ? "text-primary" : "text-ink-2"
          )}
          aria-current={t.active ? "page" : undefined}
        >
          <t.icon className="size-5" aria-hidden />
          {t.label}
        </Link>
      ))}
      <button
        onClick={() =>
          router.push(firstCourseId ? `/courses/${firstCourseId}?tab=materials&add=1` : "/home")
        }
        className="focus-ring flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink-2"
      >
        <Plus className="size-5" aria-hidden />
        Add
      </button>
      <Link
        href="/settings"
        className={cn(
          "focus-ring flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
          pathname.startsWith("/settings") ? "text-primary" : "text-ink-2"
        )}
        aria-current={pathname.startsWith("/settings") ? "page" : undefined}
      >
        <Settings className="size-5" aria-hidden />
        Settings
      </Link>
    </nav>
  );
}
