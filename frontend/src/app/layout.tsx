import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hospital Bill Auditor (India) | AI-Assisted Regulatory Audit Platform",
  description:
    "Deterministic hospital bill auditing platform for India grounded in CGHS, PMJAY, NPPA, and State Clinical Establishment regulations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans min-h-screen flex flex-col selection:bg-teal-500 selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
