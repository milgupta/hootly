import Link from "next/link";
import { OllieMark } from "@/components/ollie/OllieMark";
import { MarketingNav } from "./_components/MarketingNav";

/**
 * Marketing shell (docs/05 §1): sticky blurring nav + the minimal footer.
 * Footer is product · pricing · legal · contact · socials — no SEO link dump,
 * no duplicated links.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <MarketingNav />
      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-bg-subtle">
        <div className="mx-auto max-w-[1200px] px-4 py-12 md:px-6">
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <div className="flex items-center gap-2">
              <OllieMark size={24} title="Hootly" />
              <span className="text-[16px] font-bold tracking-[-0.01em] text-ink">
                hootly
              </span>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:gap-16">
              <div>
                <h2 className="text-micro mb-3 uppercase text-ink-3">Product</h2>
                <ul className="flex flex-col gap-2">
                  <li>
                    <Link href="/#how-it-works" className="focus-ring text-small rounded text-ink-2 transition-colors duration-150 hover:text-ink">
                      How it works
                    </Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="focus-ring text-small rounded text-ink-2 transition-colors duration-150 hover:text-ink">
                      Pricing
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-micro mb-3 uppercase text-ink-3">Legal</h2>
                <ul className="flex flex-col gap-2">
                  <li>
                    <Link href="/legal/terms" className="focus-ring text-small rounded text-ink-2 transition-colors duration-150 hover:text-ink">
                      Terms
                    </Link>
                  </li>
                  <li>
                    <Link href="/legal/privacy" className="focus-ring text-small rounded text-ink-2 transition-colors duration-150 hover:text-ink">
                      Privacy
                    </Link>
                  </li>
                  <li>
                    <Link href="/legal/refunds" className="focus-ring text-small rounded text-ink-2 transition-colors duration-150 hover:text-ink">
                      Refunds
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-micro mb-3 uppercase text-ink-3">Contact</h2>
                <ul className="flex flex-col gap-2">
                  <li>
                    <a href="mailto:support@hootly.app" className="focus-ring text-small rounded text-ink-2 transition-colors duration-150 hover:text-ink">
                      support@hootly.app
                    </a>
                  </li>
                  <li className="flex gap-3">
                    <a
                      href="https://www.tiktok.com/@hootlyapp"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="focus-ring text-small rounded text-ink-2 transition-colors duration-150 hover:text-ink"
                    >
                      TikTok
                    </a>
                    <a
                      href="https://www.instagram.com/hootlyapp"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="focus-ring text-small rounded text-ink-2 transition-colors duration-150 hover:text-ink"
                    >
                      Instagram
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <p className="text-small mt-10 border-t border-border pt-6 text-ink-3">
            <span className="tabular-nums">&copy; {year}</span> Hootly
          </p>
        </div>
      </footer>

    </div>
  );
}
