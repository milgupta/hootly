"use client";

import * as React from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

export interface TabDef {
  value: string;
  label: React.ReactNode;
}

export function Tabs({
  tabs,
  value,
  onValueChange,
  children,
  className,
}: {
  tabs: TabDef[];
  value: string;
  onValueChange: (v: string) => void;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange} className={className}>
      <RadixTabs.List className="flex gap-1 border-b border-border" aria-label="Tabs">
        {tabs.map((t) => (
          <RadixTabs.Trigger
            key={t.value}
            value={t.value}
            className={cn(
              "focus-ring relative -mb-px rounded-t-[8px] px-3.5 py-2 text-[14px] font-medium text-ink-2 transition-colors duration-150",
              "hover:text-ink",
              "data-[state=active]:text-primary data-[state=active]:font-semibold",
              "data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary"
            )}
          >
            {t.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export const TabPanel = RadixTabs.Content;
