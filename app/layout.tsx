import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Hootly — The AI study platform students actually trust",
    template: "%s · Hootly",
  },
  description:
    "Upload your slides, notes, or lectures. Hootly builds your notes, flashcards, quizzes, and a tutor that cites its sources — in about a minute.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Hootly — The AI study platform students actually trust",
    description:
      "Notes, flashcards, quizzes, and a tutor that cites its sources — built from your own course materials.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-bg text-ink">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
