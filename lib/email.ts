import "server-only";
import { Resend } from "resend";
import { env, hasResendEnv } from "@/lib/env";

let resend: Resend | null = null;

function getResend(): Resend | null {
  // TODO(key-needed): remove the guard once RESEND_API_KEY is set.
  if (!hasResendEnv) return null;
  if (!resend) resend = new Resend(env.resendApiKey);
  return resend;
}

const FROM = "Hootly <hello@hootly.app>";

function shell(bodyHtml: string): string {
  // Design-system email shell: white, purple button, Ollie mark (docs/07 §3).
  return `<div style="font-family:-apple-system,Segoe UI,Inter,sans-serif;background:#FFFFFF;color:#17171C;padding:32px;max-width:520px;margin:0 auto">
  <div style="font-size:20px;font-weight:700;margin-bottom:24px">🦉 hootly</div>
  ${bodyHtml}
  <p style="color:#9494A6;font-size:12px;margin-top:32px">You're receiving this because you have a Hootly account.</p>
</div>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#7C3AED;color:#FFFFFF;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:10px">${label}</a>`;
}

export async function sendExportReadyEmail(to: string, url: string): Promise<void> {
  const client = getResend();
  if (!client) return;
  try {
    await client.emails.send({
      from: FROM,
      to,
      subject: "Your Hootly export is ready 🦉",
      html: shell(
        `<h1 style="font-size:20px;margin:0 0 8px">Your export is ready</h1>
         <p style="color:#5C5C6B;line-height:1.6;margin:0 0 20px">Everything you've made — notes, cards, quizzes, and your original files — in one zip. The link works for 7 days.</p>
         ${button(url, "Download my data")}`
      ),
    });
  } catch {
    // Email failures never break the job.
  }
}

export async function sendPaymentFailedEmail(to: string, portalUrl: string): Promise<void> {
  const client = getResend();
  if (!client) return;
  try {
    await client.emails.send({
      from: FROM,
      to,
      subject: "Payment issue on your Hootly Plus plan",
      html: shell(
        `<h1 style="font-size:20px;margin:0 0 8px">Your payment didn't go through</h1>
         <p style="color:#5C5C6B;line-height:1.6;margin:0 0 20px">Everything keeps working for 7 days while you update your card. No rush, no lockout.</p>
         ${button(portalUrl, "Update payment method")}`
      ),
    });
  } catch {
    // Ignore.
  }
}

export async function sendRefundEmail(to: string, amount: string): Promise<void> {
  const client = getResend();
  if (!client) return;
  try {
    await client.emails.send({
      from: FROM,
      to,
      subject: "Your Hootly refund is on its way",
      html: shell(
        `<h1 style="font-size:20px;margin:0 0 8px">Refunded ${amount}</h1>
         <p style="color:#5C5C6B;line-height:1.6;margin:0 0 20px">Full refund, no questions — it'll land back on your card in 5–10 business days. Your notes, cards, and quizzes stay readable forever. Ollie will miss you.</p>`
      ),
    });
  } catch {
    // Ignore.
  }
}
