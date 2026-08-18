import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ResumeAI",
  description: "AI resume rewriting workspace for job seekers",
};

const designContract = `<!--
IMPECCABLE-DIRECTION: Folded Materials Desk
THESIS: ResumeAI is a 折纸材料台 for job seekers; truthful source material is folded toward a target JD by visible human decisions.
OWN-WORLD: warm paper, vermilion fold states, clay crease lines, washi notes, compact material sheets, source/status footers.
STORY: job seekers lay out experience material, crease it with a JD, confirm AI folds, and assemble a resume sheet.
FIRST VIEWPORT: the workspace opens with a visible fold path, editable material paper, and next actions that preserve user control.
FORM: replacement visual world, Operate mode, inferred from the user brief without a blocking choice round.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full career-surface text-[#1c1714]">
        <div aria-hidden="true" hidden dangerouslySetInnerHTML={{ __html: designContract }} />
        {children}
      </body>
    </html>
  );
}
