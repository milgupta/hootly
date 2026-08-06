import Link from "next/link";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { OllieMark } from "@/components/ollie/OllieMark";

/** 404 — copy verbatim from docs/05 §11. Ollie in an apologetic pose + one recovery action. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="mx-auto flex h-14 w-full max-w-[1200px] items-center px-4 md:h-16 md:px-6">
        <Link href="/" className="focus-ring flex items-center gap-2 rounded-ctl py-1 pr-1">
          <OllieMark size={26} title="Hootly" />
          <span className="text-[17px] font-bold tracking-[-0.01em] text-ink">hootly</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-24">
        <div className="flex flex-col items-center text-center">
          {/* Hero glow sits behind the art only — never under text (docs/03 §1). */}
          <div className="relative flex justify-center">
            <div
              className="gradient-hero-glow pointer-events-none absolute inset-x-[-120px] -top-4 bottom-0"
              aria-hidden
            />
            <OllieAnimated mode="concerned" size={96} />
          </div>
          <h1 className="text-h1 mt-8 text-ink">This page flew off.</h1>
          <p className="text-body mt-2 max-w-[46ch] text-ink-2">
            The page may have been moved or deleted.
          </p>
          <Link
            href="/"
            className="gradient-button-depth focus-ring mt-8 inline-flex h-10 items-center justify-center rounded-ctl px-4 text-[15px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[0.98]"
          >
            Go home
          </Link>
        </div>
      </main>
    </div>
  );
}
