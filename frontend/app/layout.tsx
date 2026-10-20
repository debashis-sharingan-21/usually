import type { Metadata } from "next";
import "./globals.css";
import LenisProvider from "@/components/LenisProvider";

export const metadata: Metadata = {
  title: "Usually — Your Money Has Habits",
  description: "A polished, local-first personal finance companion that learns recurring patterns from your statement history and produces witty, evidence-backed observations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#07080a] text-slate-100 antialiased selection:bg-[#c6ff00] selection:text-black">
        <LenisProvider>
          <div className="noise-overlay" />
          <div className="min-h-screen flex flex-col">{children}</div>
        </LenisProvider>
      </body>
    </html>
  );
}
