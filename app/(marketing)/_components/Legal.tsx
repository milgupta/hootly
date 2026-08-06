import * as React from "react";

/**
 * Shared building blocks for /legal/* — standard 68ch reading layout (docs/05 §11.5,
 * docs/03 §2: measure 60–75ch, body 15/24). No gradients, no color that doesn't mean
 * something; the only accent is the primary-soft callout used for our six standing
 * commitments so they're impossible to miss in a wall of policy text.
 */

export function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <article>
      <h1 className="text-h1 text-ink">{title}</h1>
      <p className="text-small mt-2 tabular-nums text-ink-3">Last updated {updated}</p>
      <div className="mt-10 flex flex-col gap-10">{children}</div>
    </article>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h2 text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function LegalP({ children }: { children: React.ReactNode }) {
  return <p className="text-body text-ink-2">{children}</p>;
}

export function LegalList({ items }: { items: ReadonlyArray<React.ReactNode> }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="text-body flex gap-2.5 text-ink-2">
          <span className="mt-2.5 size-1 shrink-0 rounded-full bg-ink-3" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** One of the six commitments this document hard-codes. */
export function LegalCommitment({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-primary-border bg-primary-soft p-5">
      <p className="text-micro uppercase text-primary">{label}</p>
      <p className="text-body mt-2 text-ink">{children}</p>
    </div>
  );
}
