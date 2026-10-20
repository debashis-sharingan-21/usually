import type { Metadata } from "next";
import "./globals.css";
import LenisProvider from "@/components/LenisProvider";

export const metadata: Metadata = {
  title: "Usually — Your Money Has Habits",
  description: "A slow and steady personal finance companion. Learns your spending habits locally on your machine with paper-inspired clarity.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F7F5EE] text-[#292D29] antialiased selection:bg-[#E8C95D]/60 selection:text-[#292D29]">
        <LenisProvider>
          <div className="min-h-screen flex flex-col">{children}</div>
        </LenisProvider>
      </body>
    </html>
  );
}
