"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Visually hidden title for a11y when no visible title is wanted */
  ariaTitle?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** wide = 720px (paywall); default 480px */
  wide?: boolean;
  hideClose?: boolean;
}

export function Modal({
  open,
  onOpenChange,
  title,
  ariaTitle,
  description,
  children,
  className,
  wide,
  hideClose,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fade-in fixed inset-0 z-50 bg-[rgb(23_23_28/40%)]" />
        <Dialog.Content
          className={cn(
            "modal-in fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-modal bg-surface shadow-lg focus:outline-none",
            wide ? "max-w-[720px]" : "max-w-[480px]",
            wide ? "p-0" : "p-6",
            className
          )}
        >
          {title ? (
            <Dialog.Title className="text-h2 mb-1 pr-8">{title}</Dialog.Title>
          ) : (
            <Dialog.Title className="sr-only">{ariaTitle ?? "Dialog"}</Dialog.Title>
          )}
          {description && (
            <Dialog.Description className="text-body mb-4 text-ink-2">
              {description}
            </Dialog.Description>
          )}
          {children}
          {!hideClose && (
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="focus-ring absolute right-4 top-4 rounded-full p-1 text-ink-3 transition-colors duration-150 hover:bg-bg-subtle hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </Dialog.Close>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
