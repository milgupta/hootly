import Link from "next/link";

/** Shared 68ch reading layout for /legal/* (docs/05 §11.5, docs/03 §3). */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-10 md:px-6 md:pt-14">
      <div className="reading-measure mx-auto">
        {children}

        <nav aria-label="Other policies" className="mt-16 border-t border-border pt-6">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link href="/legal/terms" className="focus-ring text-small rounded text-ink-2 transition-colors duration-150 hover:text-ink">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link href="/legal/privacy" className="focus-ring text-small rounded text-ink-2 transition-colors duration-150 hover:text-ink">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/legal/refunds" className="focus-ring text-small rounded text-ink-2 transition-colors duration-150 hover:text-ink">
                Refund Policy
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
