"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { signOut } from "@/app/(auth)/actions";

/** Top bar: breadcrumb left, Feedback ghost + avatar menu right (docs/05 shell). */
export function TopBar({
  displayName,
  avatarUrl,
  courseNames,
}: {
  displayName: string;
  avatarUrl: string | null;
  courseNames: Record<string, string>;
}) {
  const pathname = usePathname();

  const crumbs: { label: string; href?: string }[] = [];
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "home") crumbs.push({ label: "Home" });
  else if (parts[0] === "trash") crumbs.push({ label: "Trash" });
  else if (parts[0] === "settings") crumbs.push({ label: "Settings" });
  else if (parts[0] === "courses" && parts[1]) {
    crumbs.push({ label: "My Courses", href: "/home" });
    const name = courseNames[parts[1]] ?? "Course";
    crumbs.push({ label: name, href: parts.length > 2 ? `/courses/${parts[1]}` : undefined });
    if (parts[2]) {
      const map: Record<string, string> = {
        notes: "Notes", cards: "Flashcards", review: "Review", quiz: "Quiz",
        exam: "Exam", chat: "Tutor", plan: "Plan",
      };
      crumbs.push({ label: map[parts[2]] ?? parts[2] });
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-6 backdrop-blur">
      <nav aria-label="Breadcrumb" className="text-small flex items-center gap-1.5 text-ink-2">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-ink-3" aria-hidden>/</span>}
            {c.href ? (
              <Link href={c.href} className="focus-ring rounded hover:text-ink">{c.label}</Link>
            ) : (
              <span className={i === crumbs.length - 1 ? "font-medium text-ink" : undefined}>{c.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <a
          href="mailto:feedback@hootly.app?subject=Hootly feedback"
          className="focus-ring rounded-ctl px-3 py-1.5 text-[13px] font-semibold text-primary transition-colors duration-150 hover:bg-primary-soft"
        >
          Feedback
        </a>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="focus-ring flex size-8 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-[13px] font-semibold text-primary"
              aria-label="Account menu"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                displayName.slice(0, 1).toUpperCase()
              )}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="fade-in-up z-50 min-w-[180px] rounded-card border border-border bg-surface p-1.5 shadow-md"
            >
              <DropdownMenu.Item asChild>
                <Link href="/settings" className="focus-ring block cursor-pointer rounded-ctl px-3 py-2 text-[14px] text-ink outline-none hover:bg-bg-subtle data-[highlighted]:bg-bg-subtle">
                  Settings
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link href="/settings?tab=billing" className="focus-ring block cursor-pointer rounded-ctl px-3 py-2 text-[14px] text-ink outline-none hover:bg-bg-subtle data-[highlighted]:bg-bg-subtle">
                  Billing
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item asChild>
                <button
                  onClick={() => void signOut()}
                  className="focus-ring block w-full cursor-pointer rounded-ctl px-3 py-2 text-left text-[14px] text-ink outline-none hover:bg-bg-subtle data-[highlighted]:bg-bg-subtle"
                >
                  Sign out
                </button>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
