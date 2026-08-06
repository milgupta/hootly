"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { OllieMark } from "@/components/ollie/OllieMark";
import { OllieStory } from "@/components/ollie/OllieStory";
import { signInWithGoogle, signInWithMagicLink } from "./actions";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export function AuthScreen({ mode }: { mode: "signup" | "login" }) {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [resendIn, setResendIn] = React.useState(0);

  const isEdu = /\.edu$/i.test(email.trim());

  React.useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  function sendLink(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await signInWithMagicLink(formData);
      if (res.ok && res.sentTo) {
        setSentTo(res.sentTo);
        setResendIn(30);
      } else if (res.error) {
        setError(res.error);
      }
    });
  }

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left: form */}
      <div className="flex items-center justify-center bg-bg px-6 py-12">
        <div className="w-full max-w-[380px]">
          <Link href="/" className="focus-ring inline-flex items-center gap-2 rounded-ctl">
            <OllieMark size={36} />
            <span className="text-h3 lowercase">hootly</span>
          </Link>
          <h2 className="text-h2 mt-8">
            {mode === "signup" ? "Create your account" : "Welcome back."}
          </h2>
          <p className="text-body mt-1 text-ink-2">
            {mode === "signup"
              ? "Your all-nighters just got shorter."
              : "Ollie kept your seat warm."}
          </p>

          {sentTo ? (
            <div className="mt-8 rounded-card border border-border bg-bg-subtle p-5">
              <p className="text-body">
                Check your email — link sent to <strong className="font-semibold">{sentTo}</strong>.
                It expires in 15 minutes.
              </p>
              <form action={sendLink} className="mt-3">
                <input type="hidden" name="email" value={sentTo} />
                <Button variant="secondary" size="sm" disabled={resendIn > 0} loading={pending} type="submit">
                  {resendIn > 0 ? `Resend (${resendIn}s)` : "Resend"}
                </Button>
              </form>
            </div>
          ) : (
            <>
              <form
                action={() =>
                  startTransition(async () => {
                    const res = await signInWithGoogle();
                    if (res?.error) setError(res.error);
                  })
                }
                className="mt-8"
              >
                <Button variant="secondary" className="w-full" type="submit" disabled={pending}>
                  <GoogleIcon />
                  Continue with Google
                </Button>
              </form>

              <div className="my-5 flex items-center gap-3" role="separator" aria-label="or">
                <span className="h-px flex-1 bg-border" />
                <span className="text-small text-ink-3">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <form action={sendLink} className="flex flex-col gap-3">
                <Input
                  name="email"
                  type="email"
                  label="Email"
                  placeholder="you@school.edu"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={error ?? undefined}
                  required
                />
                {isEdu && (
                  <p className="text-small rounded-ctl bg-primary-soft px-3 py-2 text-primary">
                    🎓 .edu detected — your 20% student discount will apply automatically.
                  </p>
                )}
                <Button type="submit" loading={pending} className="w-full">
                  Send magic link
                </Button>
              </form>
            </>
          )}

          <p className="text-small mt-6 text-ink-3">
            By continuing you agree to our{" "}
            <Link href="/legal/terms" className="focus-ring rounded underline hover:text-ink-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="focus-ring rounded underline hover:text-ink-2">
              Privacy Policy
            </Link>
            .
          </p>
          <p className="text-small mt-3 text-ink-2">
            {mode === "signup" ? (
              <>Already have an account? <Link href="/login" className="focus-ring rounded font-medium text-primary hover:text-primary-hover">Log in</Link></>
            ) : (
              <>New here? <Link href="/signup" className="focus-ring rounded font-medium text-primary hover:text-primary-hover">Create an account</Link></>
            )}
          </p>
        </div>
      </div>

      {/* Right: storybook panel */}
      <div className="gradient-hero-glow hidden flex-col items-center justify-center gap-8 bg-bg px-6 py-12 lg:flex">
        <OllieStory width={300} />
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {["Real free plan", "Cancel in 2 clicks", "AI that cites sources"].map((t) => (
            <span key={t} className="text-small font-medium text-ink-2">
              <span className="text-success">✓</span> {t}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
